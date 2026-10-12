/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-679(P-431) — 리뷰 본문 "Translate" 버튼. 스펙 = spec specs/001-personalized-menu-mvp/translate-2026-10-02.md
 * (예진 10/2: 모든 리뷰에 항상 노출 · 본문을 번역문으로 교체 · 버튼이 "See original"로 토글).
 * 공용 FeedCard(홈·리뷰 피드·음식 상세 3장·내 리뷰)로 검증 — 음식별 전체 리뷰도 같은 ReviewBody 경유(소스 잠금).
 * 계약 초안: POST /api/translations?lang= {targetType:"REVIEW", targetId} → {targetType,targetId,language,text} · 503 TRANSLATION-001.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({ useSegments: () => [], useRouter: () => ({ push: jest.fn() }) }));
let mockLang = 'ko'; // #220 공부 ②: 앱 언어 전환 시나리오용 가변
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: mockLang } }) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'ko', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false, useSession: () => null }));
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client') as Record<string, unknown>;
  return { ...actual, api: { get: jest.fn(), post: (...a: unknown[]) => mockPost(...a), patch: jest.fn(), del: jest.fn() }, apiLang: () => mockLang };
});
jest.mock('@/lib/flags', () => {
  const a = jest.requireActual('@/lib/flags') as { FLAGS: Record<string, unknown> };
  return { ...a, FLAGS: { ...a.FLAGS, contentTranslation: true } }; // 가변 사본 — off 케이스는 테스트 안에서 전환
});
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a) }));

import { ApiError } from '@/lib/api/client';
import { FeedCard } from '../FeedCard';
import type { Review } from '@/lib/api/types';

const REVIEW = (over: Partial<Review> = {}): Review =>
  ({ id: '53', foodId: '7', rating: 5, body: 'Really good soup', createdAt: '2026-10-01', authorNationality: 'US', author: { nickname: 'Amy', memberId: 9 }, ...over }) as Review;

let qc: QueryClient;
const card = (review: Review) => (
  <QueryClientProvider client={qc}>
    <FeedCard review={review} t={(k) => k} mine={false} onOpenFood={jest.fn()} onGuestHelpful={jest.fn()} onMore={jest.fn()} />
  </QueryClientProvider>
);
function render(review: Review): ReactTestRenderer {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(card(review));
  });
  return tree;
}
const rerender = (tree: ReactTestRenderer, review: Review) => act(() => tree.update(card(review)));
const btn = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'translate-btn' && typeof n.props.onPress === 'function')[0];
const out = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
const press = async (t: ReactTestRenderer) => {
  await act(async () => {
    btn(t).props.onPress();
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockLang = 'ko';
  mockPost.mockReset();
  mockToast.mockReset();
});

it('본문 있는 리뷰 = "Translate" 버튼 항상 노출(언어 감지 없음)', () => {
  const t = render(REVIEW());
  expect(btn(t)).toBeTruthy();
  expect(out(t)).toContain('translation.showTranslation');
});

it('빈 본문 리뷰(사진·별점만) = 버튼 없음', () => {
  expect(btn(render(REVIEW({ body: null })))).toBeUndefined();
  expect(btn(render(REVIEW({ body: '   ' })))).toBeUndefined();
});

it('탭 → 계약대로 요청 → 본문이 번역문으로 교체 · 버튼 "See original" → 재탭 = 원문 · 다시 번역 = 재요청 0', async () => {
  mockPost.mockResolvedValue({ targetType: 'REVIEW', targetId: 53, language: 'ko', text: '정말 맛있는 국' });
  const t = render(REVIEW());
  await press(t);
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost).toHaveBeenCalledWith('/api/translations?lang=ko', { targetType: 'REVIEW', targetId: 53 });
  expect(out(t)).toContain('정말 맛있는 국');
  expect(out(t)).not.toContain('Really good soup');
  expect(out(t)).toContain('translation.translated');

  await press(t); // 원문 보기
  expect(out(t)).toContain('Really good soup');
  expect(out(t)).not.toContain('정말 맛있는 국');
  expect(out(t)).toContain('translation.showTranslation');

  await press(t); // 다시 번역 — 캐시
  expect(out(t)).toContain('정말 맛있는 국');
  expect(mockPost).toHaveBeenCalledTimes(1);
});

it('요청 중 = 스피너 + "Translating…"(reviews.translating) · 버튼 비활성 · 본문은 원문 그대로 → 응답 오면 번역문 + See original', async () => {
  let resolve!: (v: unknown) => void;
  mockPost.mockReturnValue(new Promise((r) => (resolve = r)));
  const t = render(REVIEW());
  await press(t);
  expect(out(t)).toContain('reviews.translating');
  expect(out(t)).not.toContain('translation.showTranslation"');
  expect(out(t)).toContain('Really good soup');
  expect(btn(t).props.disabled).toBe(true);
  await act(async () => {
    resolve({ targetType: 'REVIEW', targetId: 53, language: 'ko', text: '정말 맛있는 국' });
    await Promise.resolve();
  });
  expect(out(t)).not.toContain('reviews.translating');
  expect(out(t)).toContain('translation.translated');
  expect(out(t)).toContain('정말 맛있는 국');
});

it('503 TRANSLATION-001 → 토스트(에러 변형) + 원문 유지 · 버튼은 다시 "Translate"', async () => {
  mockPost.mockRejectedValue(new ApiError('translation failed', 503, 'TRANSLATION-001'));
  const t = render(REVIEW());
  await press(t);
  expect(mockToast).toHaveBeenCalledWith('translation.translateFailed', { error: true });
  expect(out(t)).toContain('Really good soup');
  expect(out(t)).toContain('translation.showTranslation');
  expect(out(t)).not.toContain('translation.translated');
});

it('계약 보충: 안 보이는 리뷰(400 REVIEW-001) → 같은 처리 — 토스트 + 원문 유지', async () => {
  mockPost.mockRejectedValue(new ApiError('review not found', 400, 'REVIEW-001'));
  const t = render(REVIEW());
  await press(t);
  expect(mockToast).toHaveBeenCalledWith('translation.translateFailed', { error: true });
  expect(out(t)).toContain('Really good soup');
});

it('실패는 캐시하지 않는다 — 실패 뒤 다시 누르면 재요청', async () => {
  mockPost.mockRejectedValueOnce(new ApiError('x', 503, 'TRANSLATION-001')).mockResolvedValueOnce({ targetType: 'REVIEW', targetId: 53, language: 'ko', text: '정말 맛있는 국' });
  const t = render(REVIEW());
  await press(t);
  await press(t);
  expect(mockPost).toHaveBeenCalledTimes(2);
  expect(out(t)).toContain('정말 맛있는 국');
});

it('#220 공부 ①: 번역 보기 중 리뷰 본문이 바뀌면 → 새 원문이 보이고, 다시 번역하면 요청이 나간다(옛 번역 재사용 0)', async () => {
  mockPost
    .mockResolvedValueOnce({ targetType: 'REVIEW', targetId: 53, language: 'ko', text: '정말 맛있는 국' })
    .mockResolvedValueOnce({ targetType: 'REVIEW', targetId: 53, language: 'ko', text: '조금 짠 국' });
  const t = render(REVIEW());
  await press(t);
  expect(out(t)).toContain('정말 맛있는 국');
  rerender(t, REVIEW({ body: 'A bit salty soup' })); // 작성자가 수정 → 목록 재조회
  expect(out(t)).toContain('A bit salty soup');
  expect(out(t)).not.toContain('정말 맛있는 국');
  expect(out(t)).toContain('translation.showTranslation');
  await press(t);
  expect(mockPost).toHaveBeenCalledTimes(2);
  expect(out(t)).toContain('조금 짠 국');
});

it('#220 공부 ②: 번역 보기 → 앱 언어 변경 → 원문 · 한 번 탭 = 요청 1회 + 번역 표시(첫 탭이 먹히지 않음)', async () => {
  mockPost
    .mockResolvedValueOnce({ targetType: 'REVIEW', targetId: 53, language: 'ko', text: '정말 맛있는 국' })
    .mockResolvedValueOnce({ targetType: 'REVIEW', targetId: 53, language: 'ja', text: '本当においしいスープ' });
  const t = render(REVIEW());
  await press(t);
  mockLang = 'ja';
  rerender(t, REVIEW());
  expect(out(t)).toContain('Really good soup');
  expect(out(t)).toContain('translation.showTranslation');
  await press(t);
  expect(mockPost).toHaveBeenCalledTimes(2);
  expect(mockPost).toHaveBeenLastCalledWith('/api/translations?lang=ja', { targetType: 'REVIEW', targetId: 53 });
  expect(out(t)).toContain('本当においしいスープ');
});

it('#220 공부 메모 ③: 서버가 빈 text → 실패 처리(토스트 · 원문 · 미캐시 → 다음 탭 재요청)', async () => {
  mockPost.mockResolvedValueOnce({ targetType: 'REVIEW', targetId: 53, language: 'ko', text: '  ' }).mockResolvedValueOnce({ targetType: 'REVIEW', targetId: 53, language: 'ko', text: '정말 맛있는 국' });
  const t = render(REVIEW());
  await press(t);
  expect(mockToast).toHaveBeenCalledWith('translation.translateFailed', { error: true });
  expect(out(t)).toContain('Really good soup');
  expect(out(t)).not.toContain('translation.translated');
  await press(t);
  expect(mockPost).toHaveBeenCalledTimes(2);
  expect(out(t)).toContain('정말 맛있는 국');
});

it('#220 공부 메모 ①: 긴 본문(See more) → 짧은 본문으로 바뀌면 펼침 토글 잔상 0', () => {
  const t = render(REVIEW());
  const layout = (n: number) =>
    act(() => {
      t.root.findAll((x) => typeof x.props?.onTextLayout === 'function')[0].props.onTextLayout({ nativeEvent: { lines: Array(n).fill({}) } });
    });
  const hasToggle = () => t.root.findAll((x) => x.props?.testID === 'body-toggle').length > 0;
  layout(5);
  expect(hasToggle()).toBe(true);
  rerender(t, REVIEW({ body: 'Short' }));
  layout(1);
  expect(hasToggle()).toBe(false);
});

it('Codex #220 P1: 플래그 contentTranslation = 진단 채널만(production·preview off — 서버 KB-678 prod 배포 전 깨진 버튼 금지)', () => {
  const flagOn = (channel: string | null) => {
    let v: unknown;
    jest.isolateModules(() => {
      jest.doMock('expo-updates', () => ({ channel }));
      v = (jest.requireActual('@/lib/flags') as { FLAGS: { contentTranslation: boolean } }).FLAGS.contentTranslation;
    });
    return v;
  };
  expect([flagOn('production'), flagOn('preview'), flagOn('teamtest'), flagOn('teamtest-prod'), flagOn(null)]).toEqual([false, false, true, true, true]);
});

it('플래그 off = 버튼 없음 · 본문은 그대로', () => {
  const flags = jest.requireMock('@/lib/flags') as { FLAGS: { contentTranslation: boolean } };
  flags.FLAGS.contentTranslation = false;
  try {
    const t = render(REVIEW());
    expect(btn(t)).toBeUndefined();
    expect(out(t)).toContain('Really good soup');
  } finally {
    flags.FLAGS.contentTranslation = true;
  }
});

it('표면 경유 소스 잠금 — FeedCard·음식별 전체 리뷰 모두 공용 ReviewBody(본문 직접 렌더·옛 번역 훅 0)', () => {
  const fs = require('fs') as typeof import('fs');
  for (const f of ['src/features/review/FeedCard.tsx', 'src/app/food/[id]/reviews.tsx']) {
    const src = fs.readFileSync(f, 'utf8');
    expect(src).toContain('<ReviewBody');
    expect(src).not.toContain('<ExpandableBody');
    expect(src).not.toContain('useReviewTranslation');
  }
});
