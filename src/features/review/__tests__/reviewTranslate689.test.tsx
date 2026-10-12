/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-689(P-434) — 번역 2차: X 방식. 스펙 = spec translate-2026-10-02.md **2차 절** · 레퍼런스 translate-ref-x-before/after.png.
 * 본문 **위 왼쪽** 한 줄 라벨: 번역 전 "Show translation"(#1B95E0) → 번역 중 "Translating…"(#536471) →
 * 번역 후 "Translated from {언어}"(#536471, 누르면 원문). 원문 언어 = 응답 sourceLanguage(KB-688 · null·없음 = "Translated").
 * KB-703(예진 10/2): 원문 언어 == 요청 언어여도 **라벨은 사라지지 않는다** — 일반 번역 결과처럼 표시(받은 글 · "Translated from ○○").
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
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { language?: string }) => (o?.language ? `${k}:${o.language}` : k), i18n: { language: mockLang } }),
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { get language() { return mockLang; }, t: (k: string) => k, getFixedT: () => (k: string) => k } })); // KB-703 ②: useAppLanguage가 읽는 값 = 앱 언어 시나리오와 같게
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
import { StyleSheet } from 'react-native';
import { TRANSLATE_LABEL, TRANSLATE_LABEL_BOX, TRANSLATE_LABEL_LINE_H } from '@/components/TranslateButton';

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
/** 라벨 Text(호스트) — 색·크기 단언용 */
const labelText = (t: ReactTestRenderer) => {
  const texts = btn(t).findAll((n) => typeof n.type === 'string' && n.props?.style != null && typeof n.props.children === 'string');
  return { text: texts[0].props.children as string, style: StyleSheet.flatten(texts[0].props.style) as { color?: string; fontSize?: number } };
};
const RES = (over: Record<string, unknown> = {}) => ({ targetType: 'REVIEW', targetId: 53, language: 'ko', text: '정말 맛있는 국', sourceLanguage: 'en', ...over });

beforeEach(() => {
  mockLang = 'ko';
  mockPost.mockReset();
  mockToast.mockReset();
});

it('상수 = 스펙 값(레퍼런스 픽셀 실측) — 번역 전 #1B95E0 · 번역 중/후 #536471 · 글자 12.5', () => {
  expect(TRANSLATE_LABEL).toEqual({ idleColor: '#1B95E0', mutedColor: '#536471', fontSize: 12.5 });
});

it('Codex #223 P2(2차): 터치 = **실제 레이아웃 상자 44**(hitSlop 없음) · 상자가 부모(래퍼) 안 · 시각 간격 무변 · 라벨이 본문 위 z', () => {
  const t = render(REVIEW());
  const b = btn(t);
  expect(b.props.hitSlop).toBeUndefined(); // 부모 경계에서 잘리는 hitSlop에 기대지 않는다
  const box = StyleSheet.flatten(b.props.style) as { paddingTop: number; paddingBottom: number; marginTop?: number; marginBottom: number; zIndex?: number };
  expect(labelText(t).style).toEqual(expect.objectContaining({ lineHeight: TRANSLATE_LABEL_LINE_H }));
  const boxH = box.paddingTop + TRANSLATE_LABEL_LINE_H + box.paddingBottom;
  expect(boxH).toBeGreaterThanOrEqual(44);
  // 부모 안: 상자 위쪽은 래퍼 top에서 시작(음수 marginTop 금지) · 래퍼는 카드 gap(8) 안에서만 올라감
  expect(box.marginTop ?? 0).toBeGreaterThanOrEqual(0);
  let wrapper = b.parent;
  while (wrapper && !(typeof wrapper.type === 'string' && wrapper.props?.style)) wrapper = wrapper.parent;
  const wrap = StyleSheet.flatten(wrapper!.props.style) as { marginTop?: number };
  expect(wrap.marginTop).toBe(-box.paddingTop);
  // 위 확장 ≤ 두 카드의 실제 gap(숫자 8 직접 비교 금지 — 카드 gap을 줄이면 라벨 상자가 위 사진 터치를 덮는데 초록이 되는 것 방지)
  const fs = require('fs') as typeof import('fs');
  const gapOf = (file: string, styleKey: string) => Number(new RegExp(`\\b${styleKey}: \\{[^}]*\\bgap: (\\d+)`).exec(fs.readFileSync(file, 'utf8'))![1]);
  for (const g of [gapOf('src/features/review/FeedCard.tsx', 'card'), gapOf('src/app/food/[id]/reviews.tsx', 'item')]) {
    expect(box.paddingTop).toBeLessThanOrEqual(g);
  }
  // 상자 아래 끝이 래퍼 안: 래퍼 최소 높이 = padTop + 줄 + 간격 + 본문 한 줄(19)
  const BODY_LINE = 19;
  expect(boxH).toBeLessThanOrEqual(box.paddingTop + TRANSLATE_LABEL_LINE_H + TRANSLATE_LABEL_BOX.gapBelow + BODY_LINE);
  // 시각 위치 무변: 라벨 글자 = 앞 형제 + gap 8 − 8 + 8 · 본문 = 라벨 줄 + 6
  expect(wrap.marginTop! + box.paddingTop).toBe(0);
  expect(box.paddingBottom + box.marginBottom).toBe(6);
  expect(box.zIndex).toBe(1);
  // 라벨이 숨으면 래퍼 보정도 없다(본문 위치 무변)
});

it('라벨 숨김(플래그 off) = 래퍼 marginTop 보정 없음 — 본문 위치 그대로', () => {
  const flags = jest.requireMock('@/lib/flags') as { FLAGS: { contentTranslation: boolean } };
  flags.FLAGS.contentTranslation = false;
  try {
    const t = render(REVIEW());
    expect(btn(t)).toBeUndefined();
    const bodyText = t.root.findAll((x) => typeof x.props?.onTextLayout === 'function')[0];
    let p = bodyText.parent;
    const margins: unknown[] = [];
    while (p) {
      if (typeof p.type === 'string' && p.props?.style) margins.push((StyleSheet.flatten(p.props.style) as { marginTop?: number }).marginTop);
      p = p.parent;
    }
    expect(margins).not.toContain(-TRANSLATE_LABEL_BOX.padTop);
  } finally {
    flags.FLAGS.contentTranslation = true;
  }
});

it('라벨은 본문 **위**(같은 카드 안 렌더 순서) · 본문 아래 버튼 없음 · 번역 전 = "Show translation" #1B95E0 12.5', () => {
  const t = render(REVIEW());
  const s = out(t);
  expect(s.indexOf('translation.showTranslation')).toBeGreaterThan(-1);
  expect(s.indexOf('translation.showTranslation')).toBeLessThan(s.indexOf('Really good soup'));
  expect(labelText(t)).toEqual({ text: 'translation.showTranslation', style: expect.objectContaining({ color: '#1B95E0', fontSize: 12.5 }) });
});

it('번역 중 = 같은 자리 "Translating…" #536471 · 본문 원문 유지 · 비활성', async () => {
  let resolve!: (v: unknown) => void;
  mockPost.mockReturnValue(new Promise((r) => (resolve = r)));
  const t = render(REVIEW());
  await press(t);
  expect(labelText(t)).toEqual({ text: 'reviews.translating', style: expect.objectContaining({ color: '#536471', fontSize: 12.5 }) });
  expect(out(t)).toContain('Really good soup');
  expect(btn(t).props.disabled).toBe(true);
  await act(async () => {
    resolve(RES());
    await Promise.resolve();
  });
});

it('번역 후 = 본문 교체 + "Translated from {영어}" #536471 → 누르면 원문 + "Show translation"', async () => {
  mockPost.mockResolvedValue(RES());
  const t = render(REVIEW());
  await press(t);
  expect(out(t)).toContain('정말 맛있는 국');
  expect(out(t)).not.toContain('Really good soup');
  expect(labelText(t)).toEqual({ text: 'translation.translatedFrom:translation.lang.en', style: expect.objectContaining({ color: '#536471', fontSize: 12.5 }) });
  await press(t);
  expect(out(t)).toContain('Really good soup');
  expect(labelText(t).text).toBe('translation.showTranslation');
  expect(mockPost).toHaveBeenCalledTimes(1);
});

// 서버 KB-688 계약: 앱 10개 언어는 앱이 lang으로 보내는 코드와 글자까지 같게 정규화돼 온다 → 클라는 **정확 일치**만(재정규화 0)
it.each([
  ['en', 'translation.translatedFrom:translation.lang.en'],
  ['ja', 'translation.translatedFrom:translation.lang.ja'],
  ['zh-Hans', 'translation.translatedFrom:translation.lang.zh-Hans'],
  ['zh-Hant', 'translation.translatedFrom:translation.lang.zh-Hant'],
  ['es', 'translation.translatedFrom:translation.lang.es'],
  ['fr', 'translation.translated'], // 앱 10개 밖(서버는 언어 부분 소문자)
  ['en-US', 'translation.translated'], // 정규화 안 된 값 = 모르는 코드(서버 계약 위반 시에도 안전 폴백)
  [null, 'translation.translated'], // 판별 못 함
  ['', 'translation.translated'],
  [undefined, 'translation.translated'], // 구서버 — 키 없음(KB-688 배포 전 폴백)
])('sourceLanguage %j → %s', async (src, want) => {
  const res = RES();
  if (src === undefined) delete (res as Record<string, unknown>).sourceLanguage;
  else res.sourceLanguage = src;
  mockPost.mockResolvedValue(res);
  const t = render(REVIEW());
  await press(t);
  expect(labelText(t).text).toBe(want);
});

it('KB-703: sourceLanguage === language(같은 언어) → 라벨이 사라지지 않고 일반 번역 결과처럼 — "Translated from 한국어" · 받은 글 · 다시 누르면 원문', async () => {
  mockPost.mockResolvedValue(RES({ sourceLanguage: 'ko', language: 'ko', text: 'Really good soup' }));
  const t = render(REVIEW());
  await press(t);
  expect(btn(t)).toBeDefined(); // 탭 뒤 사라지는 경로 0
  expect(labelText(t).text).toBe('translation.translatedFrom:translation.lang.ko');
  expect(out(t)).toContain('Really good soup'); // 받은 글(원문과 같음)
  expect(mockToast).not.toHaveBeenCalled();
  rerender(t, REVIEW());
  expect(btn(t)).toBeDefined();
  await press(t);
  expect(labelText(t).text).toBe('translation.showTranslation');
});

it('KB-703: 같은 언어 응답 뒤 본문 수정 · 앱 언어 변경에도 라벨은 계속 있다(다시 "Show translation")', async () => {
  mockPost.mockResolvedValue(RES({ sourceLanguage: 'ko', language: 'ko', text: 'Really good soup' }));
  const t = render(REVIEW());
  await press(t);
  expect(btn(t)).toBeDefined();
  rerender(t, REVIEW({ body: 'Edited soup review' }));
  expect(labelText(t).text).toBe('translation.showTranslation');
  rerender(t, REVIEW());
  expect(btn(t)).toBeDefined();
  mockLang = 'ja';
  rerender(t, REVIEW());
  expect(labelText(t).text).toBe('translation.showTranslation');
});

it('#223 공부: 캐시 = 세션 동안 — 구독이 끊기고 기본 gc(5분)를 한참 넘겨도 유지 · 다시 보이면 요청 0 · 같은 언어 결과도 캐시에서(KB-703 — 라벨 유지)', async () => {
  jest.useFakeTimers();
  try {
    mockPost
      .mockResolvedValueOnce(RES()) // 리뷰 53 = 영어 → 번역
      .mockResolvedValueOnce(RES({ targetId: 54, sourceLanguage: 'ko', language: 'ko', text: 'Same lang' })); // 리뷰 54 = 같은 언어
    const t = render(REVIEW());
    await press(t);
    const t2Review = REVIEW({ id: '54', body: 'Same lang' });
    let t2!: ReactTestRenderer;
    act(() => {
      t2 = renderer.create(card(t2Review));
    });
    await press(t2);
    expect(btn(t2)).toBeDefined(); // KB-703: 같은 언어여도 라벨 유지
    act(() => t.unmount()); // 셀 가상화로 내려감 = 구독 해제
    act(() => t2.unmount());
    act(() => jest.advanceTimersByTime(60 * 60 * 1000)); // 기본 gcTime 5분 ≪ 1시간
    expect(qc.getQueryCache().findAll({ queryKey: ['translation'] }).length).toBe(2);
    let back!: ReactTestRenderer;
    act(() => {
      back = renderer.create(card(REVIEW()));
    });
    await press(back);
    expect(out(back)).toContain('정말 맛있는 국'); // 캐시에서 즉시
    let back2!: ReactTestRenderer;
    act(() => {
      back2 = renderer.create(card(t2Review));
    });
    expect(labelText(back2).text).toBe('translation.showTranslation'); // 라벨 있음(숨김 0)
    await press(back2);
    expect(labelText(back2).text).toBe('translation.translatedFrom:translation.lang.ko'); // 캐시에서 즉시
    expect(mockPost).toHaveBeenCalledTimes(2); // 재요청 0
  } finally {
    jest.useRealTimers();
  }
});

it('Codex #223 P2: 스크롤만 한 리뷰(탭 0)는 캐시 항목을 만들지 않는다 — 마운트 중에도·언마운트 뒤에도 0', () => {
  const t = render(REVIEW());
  const more: ReactTestRenderer[] = [];
  for (let i = 0; i < 5; i++) {
    act(() => {
      more.push(renderer.create(card(REVIEW({ id: String(100 + i), body: `Review ${i}` }))));
    });
  }
  expect(qc.getQueryCache().findAll({ queryKey: ['translation'] }).length).toBe(0);
  act(() => {
    t.unmount();
    more.forEach((m) => m.unmount());
  });
  expect(qc.getQueryCache().findAll({ queryKey: ['translation'] }).length).toBe(0);
});

it('Codex #223 P2: 실패한 번역은 캐시에 남지 않는다 — 실패 N건 뒤 항목 0 · 성공은 유지 · 실패 뒤 다시 누르면 재요청', async () => {
  mockPost
    .mockRejectedValueOnce(new ApiError('x', 503, 'TRANSLATION-001'))
    .mockRejectedValueOnce(new ApiError('x', 503, 'TRANSLATION-001'))
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce(RES());
  const t = render(REVIEW());
  const others = [1, 2].map((i) => {
    let r!: ReactTestRenderer;
    act(() => {
      r = renderer.create(card(REVIEW({ id: String(200 + i), body: `Other ${i}` })));
    });
    return r;
  });
  await press(t);
  await press(others[0]);
  await press(others[1]);
  expect(qc.getQueryCache().findAll({ queryKey: ['translation'] }).length).toBe(0);
  await press(t); // 실패 뒤 재시도 = 재요청 → 성공
  expect(mockPost).toHaveBeenCalledTimes(4);
  expect(qc.getQueryCache().findAll({ queryKey: ['translation'] }).length).toBe(1);
  expect(out(t)).toContain('정말 맛있는 국');
});

it('플래그 off = 훅이 캐시 항목을 만들지 않는다(라벨 없음)', () => {
  const flags = jest.requireMock('@/lib/flags') as { FLAGS: { contentTranslation: boolean } };
  flags.FLAGS.contentTranslation = false;
  try {
    render(REVIEW());
    expect(qc.getQueryCache().findAll({ queryKey: ['translation'] }).length).toBe(0);
  } finally {
    flags.FLAGS.contentTranslation = true;
  }
});

it('본문 접힘("more")과 함께 — 라벨은 접힘 대상 밖(본문 Text 위 별도 줄), 펼침 토글은 본문 아래', () => {
  const t = render(REVIEW());
  act(() => {
    t.root.findAll((x) => typeof x.props?.onTextLayout === 'function')[0].props.onTextLayout({ nativeEvent: { lines: Array(5).fill({}) } });
  });
  const clampText = t.root.findAll((x) => typeof x.props?.onTextLayout === 'function')[0];
  expect(JSON.stringify(clampText.props.children)).not.toContain('translation.');
  const s = out(t);
  expect(s.indexOf('translation.showTranslation')).toBeLessThan(s.indexOf('Really good soup'));
  expect(s.indexOf('Really good soup')).toBeLessThan(s.indexOf('"body-toggle"'));
});

// ── KB-703 ②: 서버 review.language가 앱 언어와 같으면 라벨을 **처음부터** 숨긴다(유일한 숨김 조건)
it('KB-703 ②: review.language === 앱 언어(ko) → 첫 렌더부터 라벨 없음 · 번역 요청 0', () => {
  const t = render(REVIEW({ language: 'ko' }));
  expect(btn(t)).toBeUndefined();
  expect(out(t)).toContain('Really good soup'); // 본문은 그대로
  expect(mockPost).not.toHaveBeenCalled();
});

it('KB-703 ②: language null·필드 없음(판별 불가·구서버)·다른 언어 → 지금처럼 라벨 표시, 안내 문구 없음', () => {
  for (const r of [REVIEW({ language: null }), REVIEW(), REVIEW({ language: 'en' })]) {
    const t = render(r);
    expect(labelText(t).text).toBe('translation.showTranslation');
  }
});

it('KB-703 ②: 앱 언어가 바뀌면 다시 판정 — ko 리뷰는 ko에서 숨김, ja로 바꾸면 라벨이 나타난다(구독형 언어)', () => {
  const t = render(REVIEW({ language: 'ko' }));
  expect(btn(t)).toBeUndefined();
  mockLang = 'ja';
  rerender(t, REVIEW({ language: 'ko' }));
  expect(labelText(t).text).toBe('translation.showTranslation');
  mockLang = 'ko';
  rerender(t, REVIEW({ language: 'ko' }));
  expect(btn(t)).toBeUndefined();
});

it('KB-703 ②: 어댑터 — 문자열만 그대로, 빈 값·없음·비문자 = null', () => {
  const { adaptReview } = jest.requireActual('@/lib/api/reviewAdapter') as typeof import('@/lib/api/reviewAdapter');
  const base = { reviewId: 1, rating: 5, content: 'x', imageUrls: [], createdAt: '2026-10-02' };
  expect(adaptReview({ ...base, language: 'ko' }).language).toBe('ko');
  expect(adaptReview({ ...base, language: '' }).language).toBeNull();
  expect(adaptReview({ ...base, language: null }).language).toBeNull();
  expect(adaptReview(base).language).toBeNull();
  expect(adaptReview({ ...base, language: 7 as unknown as string }).language).toBeNull();
});
