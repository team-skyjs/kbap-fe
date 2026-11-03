/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-941 리뷰 탭 첫 묶음 자동 번역 — 아래 목 구성은 KB-679 테스트와 같다(공용 ReviewBody·useContentTranslation).
 * (원 KB-679 설명:)
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
    useReducedMotion: () => true, // Codex #364: 내 아바타 로딩 스켈레톤(Shimmer)
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
// 앱 언어 = useAppLanguage(@/lib/i18n)와 훅(react-i18next)이 같은 값(앱에선 같은 인스턴스)
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { get language() { return mockLang; }, t: (k: string) => k, getFixedT: () => (k: string) => k, on: () => {}, off: () => {} } }));
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
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a) }));


import * as fs from 'fs';
import { FeedCard } from '../FeedCard';
import { AUTO_MAX_CONCURRENT } from '@/lib/data/useContentTranslation';
import type { Review } from '@/lib/api/types';

const REVIEW = (over: Partial<Review> = {}): Review =>
  ({ id: '53', foodId: '7', rating: 5, body: 'Really good soup', createdAt: '2026-10-01', authorNationality: 'US', author: { nickname: 'Amy', memberId: 9 }, language: 'en', ...over }) as Review;

let qc: QueryClient;
const cards = (reviews: Review[], auto: boolean) => (
  <QueryClientProvider client={qc}>
    {reviews.map((r) => <FeedCard key={r.id} review={r} t={(k) => k} mine={false} onOpenFood={jest.fn()} onGuestHelpful={jest.fn()} onMore={jest.fn()} autoTranslate={auto} />)}
  </QueryClientProvider>
);
function render(reviews: Review[], auto = true): ReactTestRenderer {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(cards(reviews, auto)); });
  return tree;
}
const out = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
const flush = () => act(async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); });
const btn = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'translate-btn' && typeof n.props.onPress === 'function')[0];
const ok = (text: string, language = 'en') => Promise.resolve({ targetType: 'REVIEW', targetId: 53, language, text });

beforeEach(() => { mockPost.mockReset(); mockToast.mockReset(); mockTrack.mockReset(); mockLang = 'ja'; });

it('첫 묶음(auto) · 앱 언어와 다른 리뷰 = 탭 없이 번역문부터 · "원문 보기" 토글 유지 · 계측 source=auto(수동 지표와 분리)', async () => {
  mockPost.mockReturnValueOnce(ok('とても美味しいスープ'));
  const t = render([REVIEW()]);
  await flush();
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(out(t)).toContain('とても美味しいスープ');
  expect(out(t)).not.toContain('Really good soup');
  expect(mockTrack).toHaveBeenCalledWith('review_translate_toggle', expect.objectContaining({ action: 'translate', result: 'ok', source: 'auto' }));
  await act(async () => { btn(t).props.onPress(); }); // 원문 보기
  expect(out(t)).toContain('Really good soup');
  expect(mockTrack).toHaveBeenLastCalledWith('review_translate_toggle', { action: 'original', target: 'review' }); // 수동 = source 없음
  await act(async () => { btn(t).props.onPress(); }); // 다시 번역 = 캐시(재요청 0)
  expect(out(t)).toContain('とても美味しいスープ');
  expect(mockPost).toHaveBeenCalledTimes(1);
});

it('같은 언어 리뷰 = 요청 0 · 판별 불가(language null) = 대상 · 2페이지 이후(auto off) = 탭 전 요청 0', async () => {
  render([REVIEW({ language: 'ja' })]);
  await flush();
  expect(mockPost).not.toHaveBeenCalled();
  mockPost.mockReturnValueOnce(ok('スープ'));
  render([REVIEW({ id: '54', language: null })]);
  await flush();
  expect(mockPost).toHaveBeenCalledTimes(1);
  mockPost.mockReset();
  const t = render([REVIEW({ id: '55' })], false);
  await flush();
  expect(mockPost).not.toHaveBeenCalled();
  expect(out(t)).toContain('Really good soup'); // 원문 + "번역 보기"(현행)
});

it('자동 요청 실패 = 원문 유지 · 토스트 0 · 계측 fail(source=auto)', async () => {
  mockPost.mockReturnValueOnce(Promise.reject(new Error('503')));
  const t = render([REVIEW()]);
  await flush();
  expect(out(t)).toContain('Really good soup');
  expect(mockToast).not.toHaveBeenCalled();
  expect(mockTrack).toHaveBeenCalledWith('review_translate_toggle', expect.objectContaining({ result: 'fail', source: 'auto' }));
});

it(`동시 요청 ${'≤'} AUTO_MAX_CONCURRENT(4) — 하나 끝나면 다음`, async () => {
  const pending: ((v: unknown) => void)[] = [];
  mockPost.mockImplementation(() => new Promise((r) => pending.push(r)));
  render(Array.from({ length: 10 }, (_, i) => REVIEW({ id: String(100 + i), body: `body ${i}` })));
  await flush();
  expect(AUTO_MAX_CONCURRENT).toBe(4);
  expect(mockPost).toHaveBeenCalledTimes(4);
  await act(async () => { pending[0]({ targetType: 'REVIEW', targetId: 100, language: 'en', text: '訳0' }); });
  await flush();
  expect(mockPost).toHaveBeenCalledTimes(5);
  await act(async () => { pending.slice(1).forEach((r, i) => r({ targetType: 'REVIEW', targetId: 101 + i, language: 'en', text: `訳${i + 1}` })); });
  await flush();
  await act(async () => { pending.slice(5).forEach((r, i) => r({ targetType: 'REVIEW', targetId: 105 + i, language: 'en', text: `訳${i + 5}` })); });
  await flush();
  expect(mockPost).toHaveBeenCalledTimes(10);
});

it('리뷰 탭 배선: 첫 API 묶음(pages[0])만 autoTranslate — 정렬·필터·새로고침으로 새 첫 페이지면 그 묶음', () => {
  const feed = fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8');
  expect(feed).toContain('const firstPageIds = new Set((feed.data?.pages[0]?.items ?? []).map((r) => r.id));');
  expect(feed).toContain('autoTranslate={firstPageIds.has(row.item.id)}');
  // 음식 상세·가공식품·홈 FeedCard는 auto 없음(비범위)
  for (const p of ['src/app/food/[id]/reviews.tsx', 'src/features/processedFood/PackagedReviews.tsx']) {
    if (fs.existsSync(p)) expect(fs.readFileSync(p, 'utf8')).not.toContain('autoTranslate');
  }
});

describe('KB-941 후속 — 서버 동봉 번역(KB-940) 캐시 시드', () => {
  const { adaptReview, adaptReviewPage } = jest.requireActual('@/lib/api/reviewAdapter') as typeof import('@/lib/api/reviewAdapter');
  const wire = (over: object = {}) => ({ reviewId: 53, rating: 5, body: 'Really good soup', createdAt: '2026-10-01', language: 'en', ...over }) as Parameters<typeof adaptReview>[0];

  it('어댑터: translation 키 → serverTranslation(요청 lang · 원문 언어 = 번역 어댑터 규칙) · 키 없음·빈 본문·요청 lang 모름 = 없음', () => {
    const r = adaptReview(wire({ translation: { text: 'とても美味しいスープ', sourceLanguage: 'en' } }), 'ja');
    expect(r.serverTranslation).toEqual({ lang: 'ja', value: { text: 'とても美味しいスープ', source: { kind: 'known', code: 'en' }, sameLanguage: false } });
    expect(adaptReview(wire({ translation: { text: 'x', sourceLanguage: null } }), 'ja').serverTranslation?.value.source).toEqual({ kind: 'unknown' });
    expect(adaptReview(wire(), 'ja').serverTranslation).toBeUndefined(); // 구 서버(키 없음)
    expect(adaptReview(wire({ translation: { text: '  ' } }), 'ja').serverTranslation).toBeUndefined();
    expect(adaptReview(wire({ translation: { text: 'x' } })).serverTranslation).toBeUndefined(); // 요청 lang 모름 = 시드 안 함
    expect(adaptReviewPage({ items: [wire({ translation: { text: 't' } })], hasNext: false } as never, 'ja').items[0].serverTranslation?.lang).toBe('ja');
  });

  it('동봉 번역 + 같은 요청 언어 = POST 0 · 처음부터 번역문 · 원문 보기 토글 그대로', async () => {
    const seeded = adaptReview(wire({ translation: { text: 'とても美味しいスープ', sourceLanguage: 'en' } }), 'ja');
    const t = render([{ ...REVIEW(), serverTranslation: seeded.serverTranslation }]);
    await flush();
    expect(mockPost).not.toHaveBeenCalled();
    expect(out(t)).toContain('とても美味しいスープ');
    await act(async () => { btn(t).props.onPress(); });
    expect(out(t)).toContain('Really good soup');
  });

  it('Codex #380 P2: 시드 항목 = gcTime ∞ — 5분+ 지나도(카드가 내려간 뒤) 남아 다른 표면(수동) 탭 = POST 0 · 즉시 번역문', async () => {
    jest.useFakeTimers();
    try {
      const tick = (ms: number) => act(async () => { for (let i = 0; i < 5; i++) { jest.advanceTimersByTime(ms); await Promise.resolve(); } });
      const seeded = adaptReview(wire({ translation: { text: 'とても美味しいスープ', sourceLanguage: 'en' } }), 'ja');
      const review = { ...REVIEW(), serverTranslation: seeded.serverTranslation };
      const t = render([review]);
      await tick(10);
      expect(out(t)).toContain('とても美味しいスープ');
      const client = qc;
      act(() => t.unmount()); // 첫 묶음 카드가 화면에서 내려감
      await tick(6 * 60_000); // 기본 gcTime(5분) 넘김
      let t2!: ReactTestRenderer;
      act(() => { t2 = renderer.create(<QueryClientProvider client={client}>{[<FeedCard key="m" review={REVIEW()} t={(k) => k} mine={false} onOpenFood={jest.fn()} onGuestHelpful={jest.fn()} onMore={jest.fn()} />]}</QueryClientProvider>); });
      await act(async () => { btn(t2).props.onPress(); });
      await tick(10);
      expect(mockPost).not.toHaveBeenCalled();
      expect(out(t2)).toContain('とても美味しいスープ');
    } finally {
      jest.useRealTimers();
    }
  });

  it('동봉 번역이 다른 요청 언어(ko)로 왔으면 시드 안 함 = 현행 자동 요청 · 동봉 없음(구 서버) = 자동 요청', async () => {
    const seededKo = adaptReview(wire({ translation: { text: '정말 맛있는 수프' } }), 'ko');
    mockPost.mockReturnValueOnce(ok('とても美味しいスープ'));
    const t = render([{ ...REVIEW(), serverTranslation: seededKo.serverTranslation }]);
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(out(t)).not.toContain('정말 맛있는 수프');
    expect(out(t)).toContain('とても美味しいスープ');
  });
});
