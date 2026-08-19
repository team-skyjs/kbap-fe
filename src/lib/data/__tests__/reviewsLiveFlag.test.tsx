/**
 * P-086(KB-73): 리뷰 실연결 플래그 봉인 잠금 — off = P-077 목 경로(**리뷰 API
 * 네트워크 호출 0**), on = P-085 실 경로. 화면 코드 무변 전제라 페처/뮤테이션
 * 계층에서 스위칭을 잠근다.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';

const mockFlagState = { live: false };
jest.mock('@/lib/flags', () => ({
  FLAGS: {
    categoryUI: false,
    onboardingTriedDishes: false,
    guestMode: true,
    reviewsEnabled: true,
    reviewTranslationEnabled: false,
    get reviewsLiveEnabled() {
      return mockFlagState.live;
    },
  },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue(undefined),
    patch: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
  apiLang: () => 'en', // P-165: lang 필수 파라미터
}));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/onboarding/submit', () => ({
  loadLocalSpice: jest.fn().mockResolvedValue(null),
  SPICE_KEY: 'kbap.profile.spice.v1',
}));

import { fetchFoodReviewsPage, fetchGlobalReviewsPage } from '../useFoodReviews';
import { fetchMyReviews } from '../useMe';
import { useCreateReview } from '../useReviewMutations';
import type { Review, ReviewPage } from '@/lib/api/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client');

beforeEach(() => {
  jest.clearAllMocks();
  mockFlagState.live = false;
});

describe('목록 페처 — 플래그 스위칭', () => {
  it('off(봉인) → P-077 목 반환, 리뷰 API 호출 0 (+ countryCode는 클라 필터 흉내)', async () => {
    const all = await fetchFoodReviewsPage('kimchi-jjigae', null);
    expect(all.items.length).toBeGreaterThan(0);
    const th = await fetchFoodReviewsPage('kimchi-jjigae', null, 'TH');
    expect(th.items.every((r) => r.authorNationality === 'TH')).toBe(true);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('on + 세션 → 실 GET (cursor·countryCode 쿼리 부착)', async () => {
    mockFlagState.live = true;
    api.get.mockResolvedValueOnce({ items: [], hasNext: false, nextCursor: null });
    await fetchFoodReviewsPage('7', '42', 'VN');
    expect(api.get).toHaveBeenCalledWith('/api/reviews?lang=en&foodId=7&cursor=42&countryCode=VN'); // P-165(#144) 버전리스 + lang 필수
  });
});

describe('내 리뷰 페처 — 플래그 스위칭', () => {
  it('off(봉인) + 세션 → 빈 목록(P-077 시맨틱), 리뷰 API 호출 0', async () => {
    await expect(fetchMyReviews()).resolves.toEqual([]);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('on + 세션 → 실 GET /members/me/reviews (keyset 수집)', async () => {
    mockFlagState.live = true;
    api.get.mockResolvedValueOnce({
      items: [{ reviewId: 1, foodId: 7, memberId: 9, rating: 5, imageUrls: [], createdAt: '2026-07-30T00:00:00Z', author: null }],
      hasNext: false,
    });
    const mine = await fetchMyReviews();
    expect(api.get).toHaveBeenCalledWith('/api/reviews/me?lang=en'); // P-165(#144) 버전리스 + lang 필수
    expect(mine).toHaveLength(1);
    expect(mine[0].anonymized).toBe(true); // author null(탈퇴형) 방어 겸
  });
});

/* ---- 작성 뮤테이션 스위칭 (Harness — useUpdateMe.test 패턴) ---- */

function Harness({ input, onSettled }: { input: { foodId: string; rating: number; content?: string }; onSettled: () => void }) {
  const create = useCreateReview();
  React.useEffect(() => {
    create.mutate(input, { onSettled });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

async function runCreate(qc: QueryClient, input: { foodId: string; rating: number; content?: string }) {
  let settled!: () => void;
  const done = new Promise<void>((r) => (settled = r));
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <Harness input={input} onSettled={settled} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await done;
    await new Promise((r) => setTimeout(r, 0));
  });
}

it('작성 off(봉인) → POST 호출 0 + 캐시 직접 반영(내 리뷰 prepend·음식 목록 첫 페이지 삽입)', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['me', 'en'], { id: '9', nationality: 'KR', rank: { tier: 'Foodie' } });
  qc.setQueryData<InfiniteData<ReviewPage>>(['food', '7', 'reviews', 'all'], {
    pages: [{ items: [], hasNext: false, nextCursor: null }],
    pageParams: [null],
  });
  await runCreate(qc, { foodId: '7', rating: 4, content: 'good' });
  expect(api.post).not.toHaveBeenCalled();
  const mine = qc.getQueryData<Review[]>(['me', 'reviews'])!;
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({ foodId: '7', rating: 4, body: 'good', memberId: '9', authorNationality: 'KR' });
  const page = qc.getQueryData<InfiniteData<ReviewPage>>(['food', '7', 'reviews', 'all'])!;
  expect(page.pages[0].items).toHaveLength(1);
});

it('작성 on → 실 POST /reviews (foodId 수치화)', async () => {
  mockFlagState.live = true;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await runCreate(qc, { foodId: '7', rating: 5, content: 'live' });
  expect(api.post).toHaveBeenCalledWith('/api/reviews', { foodId: 7, rating: 5, servingSpeed: 0, staffKindness: 0, content: 'live' }); // P-236: 미평가 = 0
});

// P-211 ③ 재현 경로: 피드 발 작성 → 전역 피드(['reviews','global'])가 stale 마킹돼야
// 복귀 시 재조회로 새 리뷰가 보인다 — 누락 시 이 단언이 실패(P-196 like 족보의 무효화판).
it('P-211: 작성 성공 → 전역 피드·음식·내 리뷰 캐시 전부 무효화', async () => {
  mockFlagState.live = true;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const seed = { pages: [{ items: [], hasNext: false, nextCursor: null }], pageParams: [null] };
  qc.setQueryData<InfiniteData<ReviewPage>>(['reviews', 'global'], seed);
  qc.setQueryData<InfiniteData<ReviewPage>>(['food', '7', 'reviews', 'all'], seed);
  qc.setQueryData<Review[]>(['me', 'reviews'], []);
  await runCreate(qc, { foodId: '7', rating: 5 });
  expect(qc.getQueryState(['reviews', 'global'])?.isInvalidated).toBe(true);
  expect(qc.getQueryState(['food', '7', 'reviews', 'all'])?.isInvalidated).toBe(true);
  expect(qc.getQueryState(['me', 'reviews'])?.isInvalidated).toBe(true);
});

/* ---- P-095: 리뷰 좋아요 토글 (목 — 캐시 반영·API 호출 0) ---- */

function LikeHarness({ input, onSettled }: { input: { reviewId: string; foodId: string }; onSettled: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useToggleReviewLike } = require('../useReviewMutations') as typeof import('../useReviewMutations');
  const toggle = useToggleReviewLike();
  React.useEffect(() => {
    toggle.mutate(input, { onSettled });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

async function runLike(qc: QueryClient, input: { reviewId: string; foodId: string }) {
  let settled!: () => void;
  const done = new Promise<void>((r) => (settled = r));
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <LikeHarness input={input} onSettled={settled} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await done;
  });
}

it('좋아요 토글(목) → API 호출 0 + 내 리뷰·음식 리뷰 전 필터 캐시에 반영, 재탭 해제', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rv = { id: 'r1', foodId: '7', rating: 5, body: null, authorNationality: 'US', authorRankTier: null, anonymized: false, createdAt: '2026-07-31T00:00:00Z', likes: 2, myLike: false } as Review;
  qc.setQueryData(['me', 'reviews'], [rv]);
  qc.setQueryData<InfiniteData<ReviewPage>>(['food', '7', 'reviews', 'all'], { pages: [{ items: [rv], hasNext: false, nextCursor: null }], pageParams: [null] });
  await runLike(qc, { reviewId: 'r1', foodId: '7' });
  expect(api.post).not.toHaveBeenCalled();
  expect((qc.getQueryData<Review[]>(['me', 'reviews'])![0])).toMatchObject({ likes: 3, myLike: true });
  expect(qc.getQueryData<InfiniteData<ReviewPage>>(['food', '7', 'reviews', 'all'])!.pages[0].items[0]).toMatchObject({ likes: 3, myLike: true });
  await runLike(qc, { reviewId: 'r1', foodId: '7' }); // 재탭 = 해제
  expect((qc.getQueryData<Review[]>(['me', 'reviews'])![0])).toMatchObject({ likes: 2, myLike: false });
});

/* ---- P-196: 전역 피드 캐시(['reviews','global']) — 커뮤니티탭 무반영 반려 보수 ---- */

it('P-196: 피드에만 있는 리뷰 — 낙관 반영·next 정확(재탭=해제)·실패 롤백 전부 피드 캐시 포함', async () => {
  mockFlagState.live = true;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const feedRv = { ...LIKE_RV } as Review;
  qc.setQueryData<InfiniteData<ReviewPage>>(['reviews', 'global'], { pages: [{ items: [feedRv], hasNext: false, nextCursor: null }], pageParams: [null] });
  const feedItem = () => qc.getQueryData<InfiniteData<ReviewPage>>(['reviews', 'global'])!.pages[0].items[0];
  await runLike(qc, { reviewId: 'r1', foodId: '7' });
  expect(api.post).toHaveBeenCalledWith('/api/reviews/r1/like?liked=true');
  expect(feedItem()).toMatchObject({ likes: 3, myLike: true }); // 반려 전: 피드 캐시 미순회 = 반영 0
  await runLike(qc, { reviewId: 'r1', foodId: '7' }); // 재탭 — 반려 전: next가 항상 true(피드 미조회)
  expect(api.post).toHaveBeenLastCalledWith('/api/reviews/r1/like?liked=false');
  expect(feedItem()).toMatchObject({ likes: 2, myLike: false });
  api.post.mockRejectedValueOnce(new Error('boom'));
  await runLike(qc, { reviewId: 'r1', foodId: '7' }); // 실패 → 피드 캐시도 롤백
  expect(feedItem()).toMatchObject({ likes: 2, myLike: false });
});

/* ---- P-108: 좋아요 실연결 (on — POST + 낙관/롤백) ---- */

const LIKE_RV = { id: 'r1', foodId: '7', rating: 5, body: null, authorNationality: 'US', authorRankTier: null, anonymized: false, createdAt: '2026-08-03T00:00:00Z', likes: 2, myLike: false } as Review;

it('좋아요 on → POST /reviews/{id}/like?liked=목표상태 + 낙관 반영 유지', async () => {
  mockFlagState.live = true;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['me', 'reviews'], [LIKE_RV]);
  await runLike(qc, { reviewId: 'r1', foodId: '7' });
  expect(api.post).toHaveBeenCalledWith('/api/reviews/r1/like?liked=true'); // 현 false → 목표 true
  expect(qc.getQueryData<Review[]>(['me', 'reviews'])![0]).toMatchObject({ likes: 3, myLike: true });
  await runLike(qc, { reviewId: 'r1', foodId: '7' }); // 해제 = liked=false
  expect(api.post).toHaveBeenLastCalledWith('/api/reviews/r1/like?liked=false');
});

it('좋아요 on 실패 → 캐시 롤백(원값 복원)', async () => {
  mockFlagState.live = true;
  api.post.mockRejectedValueOnce(new Error('boom'));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(['me', 'reviews'], [LIKE_RV]);
  await runLike(qc, { reviewId: 'r1', foodId: '7' });
  expect(qc.getQueryData<Review[]>(['me', 'reviews'])![0]).toMatchObject({ likes: 2, myLike: false });
});

it('P-165(#144): 리뷰 경로 전수 버전리스 — v1 상대 경로(`/reviews`) 잔재 0', () => {
  const fs = require('fs');
  for (const f of [
    'src/lib/data/useFoodReviews.ts',
    'src/lib/data/useMe.ts',
    'src/lib/data/useReviewMutations.ts',
    'src/lib/data/useReviewTranslation.ts',
  ]) {
    const src = fs.readFileSync(f, 'utf8') as string;
    // api.*('/reviews…') 형태(=/api/v1/reviews로 나가는 상대 경로) 금지 — /api/reviews만 허용
    expect(src).not.toMatch(/api\.(get|post|patch|del)[^\n]*[`'"]\/reviews/);
  }
});

describe('P-179: 전역 리뷰 피드 페처', () => {
  it('on + 세션 → GET /api/reviews — foodId 무전송(전역) + lang 필수 + cursor', async () => {
    mockFlagState.live = true;
    api.get.mockResolvedValue({ items: [], hasNext: false, nextCursor: null });
    await fetchGlobalReviewsPage(null);
    expect(api.get).toHaveBeenCalledWith('/api/reviews?lang=en');
    await fetchGlobalReviewsPage('42');
    expect(api.get).toHaveBeenLastCalledWith('/api/reviews?lang=en&cursor=42');
  });

  it('off(봉인) → 호출 0 · 빈 페이지(게이트는 화면 몫)', async () => {
    await expect(fetchGlobalReviewsPage(null)).resolves.toEqual({ items: [], hasNext: false, nextCursor: null });
    expect(api.get).not.toHaveBeenCalled();
  });
});
