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
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ko' } }) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'ko', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false, useSession: () => null }));
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client') as Record<string, unknown>;
  return { ...actual, api: { get: jest.fn(), post: (...a: unknown[]) => mockPost(...a), patch: jest.fn(), del: jest.fn() }, apiLang: () => 'ko' };
});
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a) }));

import { ApiError } from '@/lib/api/client';
import { FeedCard } from '../FeedCard';
import type { Review } from '@/lib/api/types';

const REVIEW = (over: Partial<Review> = {}): Review =>
  ({ id: '53', foodId: '7', rating: 5, body: 'Really good soup', createdAt: '2026-10-01', authorNationality: 'US', author: { nickname: 'Amy', memberId: 9 }, ...over }) as Review;

let qc: QueryClient;
function render(review: Review): ReactTestRenderer {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <FeedCard review={review} t={(k) => k} mine={false} onOpenFood={jest.fn()} onGuestHelpful={jest.fn()} onMore={jest.fn()} />
      </QueryClientProvider>,
    );
  });
  return tree;
}
const btn = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'translate-btn' && typeof n.props.onPress === 'function')[0];
const out = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
const press = async (t: ReactTestRenderer) => {
  await act(async () => {
    btn(t).props.onPress();
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockPost.mockReset();
  mockToast.mockReset();
});

it('본문 있는 리뷰 = "Translate" 버튼 항상 노출(언어 감지 없음)', () => {
  const t = render(REVIEW());
  expect(btn(t)).toBeTruthy();
  expect(out(t)).toContain('translation.translate');
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
  expect(out(t)).toContain('translation.seeOriginal');

  await press(t); // 원문 보기
  expect(out(t)).toContain('Really good soup');
  expect(out(t)).not.toContain('정말 맛있는 국');
  expect(out(t)).toContain('translation.translate');

  await press(t); // 다시 번역 — 캐시
  expect(out(t)).toContain('정말 맛있는 국');
  expect(mockPost).toHaveBeenCalledTimes(1);
});

it('503 TRANSLATION-001 → 토스트(에러 변형) + 원문 유지 · 버튼은 다시 "Translate"', async () => {
  mockPost.mockRejectedValue(new ApiError('translation failed', 503, 'TRANSLATION-001'));
  const t = render(REVIEW());
  await press(t);
  expect(mockToast).toHaveBeenCalledWith('translation.translateFailed', { error: true });
  expect(out(t)).toContain('Really good soup');
  expect(out(t)).toContain('translation.translate');
  expect(out(t)).not.toContain('translation.seeOriginal');
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

it('표면 경유 소스 잠금 — FeedCard·음식별 전체 리뷰 모두 공용 ReviewBody(본문 직접 렌더·옛 번역 훅 0)', () => {
  const fs = require('fs') as typeof import('fs');
  for (const f of ['src/features/review/FeedCard.tsx', 'src/app/food/[id]/reviews.tsx']) {
    const src = fs.readFileSync(f, 'utf8');
    expect(src).toContain('<ReviewBody');
    expect(src).not.toContain('<ExpandableBody');
    expect(src).not.toContain('useReviewTranslation');
  }
});
