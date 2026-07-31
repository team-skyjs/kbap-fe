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
}));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/onboarding/submit', () => ({
  loadLocalSpice: jest.fn().mockResolvedValue(null),
  SPICE_KEY: 'kbap.profile.spice.v1',
}));

import { fetchFoodReviewsPage } from '../useFoodReviews';
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
    expect(api.get).toHaveBeenCalledWith('/reviews?cursor=42&countryCode=VN&foodId=7'); // #116 경로 통일
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
    expect(api.get).toHaveBeenCalledWith('/reviews/me'); // #116 경로 통일
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
  expect(api.post).toHaveBeenCalledWith('/reviews', { foodId: 7, rating: 5, content: 'live' });
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
