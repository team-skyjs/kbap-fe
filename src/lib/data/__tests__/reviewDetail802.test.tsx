/* eslint-disable import/first, @typescript-eslint/no-require-imports -- jest.mock 팩토리 안 require · 목 등록 뒤 import(레포 테스트 관례) */
/**
 * KB-802 데이터 계층 — 어댑터 koreanName(C-2) · 단건 조회(C-1) · 상세 쿼리 시드→갱신 · Helpful 상세↔피드 동기화 ·
 * 무효화 · REVIEW-001 피드 제거.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';

const mockFlagState = { live: true };
jest.mock('@/lib/flags', () => ({
  FLAGS: {
    reviewsEnabled: true,
    get reviewsLiveEnabled() {
      return mockFlagState.live;
    },
  },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/api/client', () => {
  class ApiError extends Error {
    status?: number;
    code?: string;
    constructor(message: string, mockStatus?: number, mockCode?: string) {
      super(message);
      this.status = mockStatus;
      this.code = mockCode;
    }
  }
  return {
    ApiError,
    api: { get: jest.fn(), post: jest.fn().mockResolvedValue(undefined), patch: jest.fn().mockResolvedValue(undefined), del: jest.fn().mockResolvedValue(undefined) },
    apiLang: () => 'en',
  };
});

import { adaptReview, type ReviewWire } from '@/lib/api/reviewAdapter';
import { fetchReview, isReviewNotFound, reviewDetailKey, useReview } from '../useFoodReviews';
import { findCachedReview, removeReviewFromFeeds, useDeleteReview, useToggleReviewLike } from '../useReviewMutations';
import type { Review, ReviewPage } from '@/lib/api/types';

const { api, ApiError } = require('@/lib/api/client');

const WIRE: ReviewWire = {
  reviewId: 42, rating: 5, servingSpeed: 4, staffKindness: 0, content: 'Broth was rich.', language: 'en',
  imageUrls: ['https://cdn/a.jpg'], createdAt: '1760572800000',
  author: { memberId: 7, nickname: 'foodie', countryCode: 'VN', tier: 'GOURMET', level: 2, score: 15 },
  authorWithdrawn: false, likeCount: 34, likedByMe: true,
  food: { foodId: 1, name: 'Seolleongtang', koreanName: '설렁탕', imageUrl: 'https://cdn/f.jpg' },
  place: null,
};
const RV = { id: 'r1', foodId: '7', rating: 5, body: 'x', authorNationality: 'US', authorRankTier: null, anonymized: false, createdAt: '2026-10-16T00:00:00Z', likes: 2, myLike: false } as Review;
const page = (items: Review[]): InfiniteData<ReviewPage> => ({ pages: [{ items, hasNext: false, nextCursor: null }], pageParams: [null] });
// gcTime Infinity = GC 타이머 없음(in-band 실행이 열린 타이머로 안 끝나는 것 방지)
const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });

const trees: renderer.ReactTestRenderer[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockFlagState.live = true;
});
afterEach(() => {
  act(() => trees.splice(0).forEach((t) => t.unmount()));
});

describe('어댑터 — food.koreanName → foodKoreanName (C-2)', () => {
  it('값 매핑 · lang=ko null · 구서버(필드 없음)·음식 없음 = null', () => {
    expect(adaptReview(WIRE).foodKoreanName).toBe('설렁탕');
    expect(adaptReview({ ...WIRE, food: { ...WIRE.food!, koreanName: null } }).foodKoreanName).toBeNull();
    expect(adaptReview({ ...WIRE, food: { foodId: 1, name: 'Seolleongtang' } }).foodKoreanName).toBeNull();
    expect(adaptReview({ ...WIRE, food: null }).foodKoreanName).toBeNull();
  });
});

describe('단건 조회 (C-1)', () => {
  it('GET /api/reviews/{id}?lang= → adaptReview 그대로', async () => {
    api.get.mockResolvedValueOnce(WIRE);
    const r = await fetchReview('42');
    expect(api.get).toHaveBeenCalledWith('/api/reviews/42?lang=en');
    expect(r).toMatchObject({ id: '42', foodId: '1', foodName: 'Seolleongtang', foodKoreanName: '설렁탕', likes: 34, myLike: true, staffKindness: 0 });
  });

  it('REVIEW-001 판별은 HTTP 상태가 아니라 code', () => {
    expect(isReviewNotFound(new ApiError('x', 400, 'REVIEW-001'))).toBe(true);
    expect(isReviewNotFound(new ApiError('x', 400, 'COMMON-002'))).toBe(false);
    expect(isReviewNotFound(new Error('REVIEW-001'))).toBe(false);
  });
});

/* ---- useReview: 시드 즉시 렌더 → 백그라운드 단건 갱신 ---- */

function Probe({ id, out }: { id: string; out: { data?: Review; error?: unknown }[] }) {
  const q = useReview(id);
  out.push({ data: q.data, error: q.error });
  return null;
}
async function mount(qc: QueryClient, id: string) {
  const out: { data?: Review; error?: unknown }[] = [];
  await act(async () => {
    trees.push(
      renderer.create(
        <QueryClientProvider client={qc}>
          <Probe id={id} out={out} />
        </QueryClientProvider>,
      ),
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0)); // 백그라운드 단건 응답 반영
  });
  return out;
}

describe('useReview — 키 [reviews,detail,id] · staleTime 0', () => {
  it('시드가 있으면 첫 렌더부터 그 값 → 마운트 때 단건 갱신으로 교체', async () => {
    const qc = newQc();
    qc.setQueryData(reviewDetailKey('42'), { ...RV, id: '42', likes: 1 });
    api.get.mockResolvedValueOnce({ ...WIRE, likeCount: 99 });
    const out = await mount(qc, '42');
    expect(out[0].data).toMatchObject({ id: '42', likes: 1 }); // 첫 프레임 = 시드(스켈레톤 없음)
    expect(api.get).toHaveBeenCalledWith('/api/reviews/42?lang=en'); // staleTime 0 → 갱신
    expect(out.at(-1)!.data).toMatchObject({ likes: 99 });
  });

  it('REVIEW-001 은 재시도하지 않는다(1회 호출)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } }); // retry 는 useReview 자체 함수
    api.get.mockRejectedValue(new ApiError('gone', 400, 'REVIEW-001'));
    const out = await mount(qc, '42');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(isReviewNotFound(out.at(-1)!.error)).toBe(true);
    api.get.mockReset();
  });

  it('봉인 플래그 off = 네트워크 0(시드만)', async () => {
    mockFlagState.live = false;
    const qc = newQc();
    qc.setQueryData(reviewDetailKey('r1'), RV);
    const out = await mount(qc, 'r1');
    expect(api.get).not.toHaveBeenCalled();
    expect(out.at(-1)!.data).toMatchObject({ id: 'r1' });
  });
});

/* ---- Helpful: 상세 ↔ 전역 피드 양쪽 ---- */

function Run({ fn, done }: { fn: () => Promise<unknown>; done: () => void }) {
  React.useEffect(() => {
    void fn().catch(() => {}).finally(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
function LikeOnce({ done }: { done: () => void }) {
  const toggle = useToggleReviewLike();
  return <Run fn={() => toggle.mutateAsync({ reviewId: 'r1', foodId: '7' })} done={done} />;
}
function DeleteOnce({ done }: { done: () => void }) {
  const del = useDeleteReview();
  return <Run fn={() => del.mutateAsync({ reviewId: 'r1', foodId: '7' })} done={done} />;
}
async function run(qc: QueryClient, C: React.ComponentType<{ done: () => void }>) {
  let done!: () => void;
  const p = new Promise<void>((r) => (done = r));
  await act(async () => {
    trees.push(
      renderer.create(
        <QueryClientProvider client={qc}>
          <C done={done} />
        </QueryClientProvider>,
      ),
    );
  });
  await act(async () => {
    await p;
  });
}

describe('Helpful 캐시 동기화 (R-11)', () => {
  const seed = () => {
    const qc = newQc();
    qc.setQueryData(reviewDetailKey('r1'), RV);
    qc.setQueryData(['reviews', 'global', 'all', 'all', 'latest', 0, 5], page([RV]));
    return qc;
  };
  const detail = (qc: QueryClient) => qc.getQueryData<Review>(reviewDetailKey('r1'))!;
  const feed = (qc: QueryClient) => qc.getQueryData<InfiniteData<ReviewPage>>(['reviews', 'global', 'all', 'all', 'latest', 0, 5])!.pages[0].items[0];

  it('상세에서 토글 → 상세·피드 둘 다 반영, 목표 상태는 상세 캐시 기준', async () => {
    const qc = seed();
    await run(qc, LikeOnce);
    expect(api.post).toHaveBeenCalledWith('/api/reviews/r1/like?liked=true');
    expect(detail(qc)).toMatchObject({ likes: 3, myLike: true });
    expect(feed(qc)).toMatchObject({ likes: 3, myLike: true });
  });

  it('상세 캐시만 최신(피드보다 앞섬) → next 는 상세 값으로 계산', async () => {
    const qc = seed();
    qc.setQueryData(reviewDetailKey('r1'), { ...RV, likes: 3, myLike: true }); // 단건 갱신이 이미 눌린 상태를 가져옴
    await run(qc, LikeOnce);
    expect(api.post).toHaveBeenCalledWith('/api/reviews/r1/like?liked=false');
    expect(detail(qc)).toMatchObject({ likes: 2, myLike: false });
  });

  it('실패 → 상세·피드 양쪽 롤백', async () => {
    const qc = seed();
    api.post.mockRejectedValueOnce(new Error('boom'));
    await run(qc, LikeOnce);
    expect(detail(qc)).toMatchObject({ likes: 2, myLike: false });
    expect(feed(qc)).toMatchObject({ likes: 2, myLike: false });
  });

  it('findCachedReview — 상세 캐시가 먼저', () => {
    const qc = seed();
    qc.setQueryData(reviewDetailKey('r1'), { ...RV, body: 'fresh' });
    expect(findCachedReview(qc, { reviewId: 'r1', foodId: '7' })?.body).toBe('fresh');
  });
});

describe('무효화·제거 (R-09·R-12)', () => {
  it('삭제 성공 → 상세 키 무효화(열린 상세가 재조회로 REVIEW-001 → notFound)', async () => {
    const qc = newQc();
    qc.setQueryData(reviewDetailKey('r1'), RV);
    await run(qc, DeleteOnce);
    expect(qc.getQueryState(reviewDetailKey('r1'))?.isInvalidated).toBe(true);
  });

  it('removeReviewFromFeeds — 전역 피드 전 필터 키에서 그 리뷰만 제거, 음식 리뷰 캐시는 무변', () => {
    const qc = newQc();
    const other = { ...RV, id: 'r2' };
    qc.setQueryData(['reviews', 'global', 'all'], page([RV, other]));
    qc.setQueryData(['reviews', 'global', 'US'], page([RV]));
    qc.setQueryData(['food', '7', 'reviews', 'all'], page([RV]));
    removeReviewFromFeeds(qc, 'r1');
    expect(qc.getQueryData<InfiniteData<ReviewPage>>(['reviews', 'global', 'all'])!.pages[0].items.map((r) => r.id)).toEqual(['r2']);
    expect(qc.getQueryData<InfiniteData<ReviewPage>>(['reviews', 'global', 'US'])!.pages[0].items).toEqual([]);
    expect(qc.getQueryData<InfiniteData<ReviewPage>>(['food', '7', 'reviews', 'all'])!.pages[0].items).toHaveLength(1);
  });
});
