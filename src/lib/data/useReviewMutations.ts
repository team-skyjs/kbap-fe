/**
 * useReviewMutations — 리뷰 작성/수정/삭제 (P-085/KB-73 실연결 · P-086 플래그 봉인).
 *
 * FLAGS.reviewsLiveEnabled=false(현행) → **P-077 목 경로**: 리뷰 API 호출 0,
 * React Query 캐시(['me','reviews'] + 음식 목록 첫 페이지)에 직접 반영 — 화면
 * 코드 무변. 무효화도 안 한다(재조회가 목 삽입분을 지움 — P-077 시맨틱 유지).
 *
 * on(실연결) → POST/PATCH/DELETE + `['food',foodId]` 프리픽스·['me','reviews']
 * 무효화(서버 재조회가 진실). PATCH는 buildReviewUpdate(풀 페이로드)만 통과 —
 * "생략=제거" 함정 봉쇄.
 */
import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import i18n from '../i18n';
import { api } from '@/lib/api/client';
import { buildReviewUpdate, type ReviewUpdateWire } from '@/lib/api/reviewAdapter';
import type { Review, ReviewPage, User } from '@/lib/api/types';
import { FLAGS } from '@/lib/flags';

function useInvalidateReviews() {
  const qc = useQueryClient();
  return (foodId: string) => {
    void qc.invalidateQueries({ queryKey: ['food', foodId] }); // 상세(평점)·리뷰 목록
    void qc.invalidateQueries({ queryKey: ['me', 'reviews'] });
  };
}

/* ---- P-086 목 경로 캐시 헬퍼 (P-077 시맨틱) ---- */

function mockInsert(qc: QueryClient, review: Review) {
  qc.setQueryData<Review[]>(['me', 'reviews'], (prev) => [review, ...(prev ?? [])]);
  qc.setQueryData<InfiniteData<ReviewPage>>(['food', review.foodId, 'reviews', 'all'], (prev) =>
    prev && prev.pages.length
      ? { ...prev, pages: [{ ...prev.pages[0], items: [review, ...prev.pages[0].items] }, ...prev.pages.slice(1)] }
      : prev,
  );
}

export function useCreateReview() {
  const qc = useQueryClient();
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: { foodId: string; rating: number; content?: string; imagePaths?: string[]; place?: { name: string; roadAddress: string } | null }) => {
      if (!FLAGS.reviewsLiveEnabled) {
        const me = qc.getQueryData<User>(['me', i18n.language]);
        mockInsert(qc, {
          id: `my-${Date.now()}`,
          foodId: input.foodId,
          rating: input.rating,
          body: input.content ?? null,
          photos: input.imagePaths ?? [],
          createdAt: new Date().toISOString(),
          memberId: me?.id,
          authorNationality: me?.nationality ?? null,
          authorRankTier: me?.rank.tier ?? null,
          anonymized: false,
          bodyLanguage: i18n.language,
          translatedBody: null,
          place: input.place ?? null, // P-095: 장소 목 저장 (live 전송은 계약 배포 시 스왑)
          likes: 0,
        });
        return;
      }
      await api.post('/reviews', {
        foodId: Number(input.foodId),
        rating: input.rating,
        ...(input.content ? { content: input.content } : {}),
        ...(input.imagePaths?.length ? { imagePaths: input.imagePaths } : {}),
      });
    },
    onSuccess: (_d, v) => {
      if (FLAGS.reviewsLiveEnabled) invalidate(v.foodId);
    },
  });
}

export function useUpdateReview() {
  const qc = useQueryClient();
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: {
      reviewId: string;
      foodId: string;
      current: { rating: number; body: string | null; photos?: string[] };
      changes: { rating?: number; body?: string | null };
    }) => {
      if (!FLAGS.reviewsLiveEnabled) {
        const body = (input.changes.body !== undefined ? input.changes.body : input.current.body)?.trim() || null;
        qc.setQueryData<Review[]>(['me', 'reviews'], (prev) =>
          (prev ?? []).map((r) =>
            r.id === input.reviewId ? { ...r, rating: input.changes.rating ?? r.rating, body } : r,
          ),
        );
        return;
      }
      const body: ReviewUpdateWire = buildReviewUpdate(input.current, input.changes);
      await api.patch(`/reviews/${input.reviewId}`, body);
    },
    onSuccess: (_d, v) => {
      if (FLAGS.reviewsLiveEnabled) invalidate(v.foodId);
    },
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: { reviewId: string; foodId: string }) => {
      if (!FLAGS.reviewsLiveEnabled) {
        qc.setQueryData<Review[]>(['me', 'reviews'], (prev) => (prev ?? []).filter((r) => r.id !== input.reviewId));
        return;
      }
      await api.del(`/reviews/${input.reviewId}`);
    },
    onSuccess: (_d, v) => {
      if (FLAGS.reviewsLiveEnabled) invalidate(v.foodId);
    },
  });
}

/** 캐시 전역 좋아요 반전 — 내리뷰 + 음식 리뷰 infinite 전 필터 키('all'·국적). */
function flipLikeCaches(qc: QueryClient, input: { reviewId: string; foodId: string }) {
  const flip = (r: Review): Review =>
    r.id === input.reviewId
      ? { ...r, myLike: !r.myLike, likes: Math.max(0, (r.likes ?? 0) + (r.myLike ? -1 : 1)) }
      : r;
  qc.setQueryData<Review[]>(['me', 'reviews'], (prev) => prev?.map(flip));
  qc.getQueryCache()
    .findAll({ queryKey: ['food', input.foodId, 'reviews'] })
    .forEach((query) => {
      qc.setQueryData<InfiniteData<ReviewPage>>(query.queryKey, (prev) =>
        prev ? { ...prev, pages: prev.pages.map((p) => ({ ...p, items: p.items.map(flip) })) } : prev,
      );
    });
}

/** 현재 myLike — 캐시가 진실(화면도 이걸 그린다). 내리뷰 → 음식 캐시 순. */
function currentMyLike(qc: QueryClient, input: { reviewId: string; foodId: string }): boolean {
  const mine = qc.getQueryData<Review[]>(['me', 'reviews'])?.find((r) => r.id === input.reviewId);
  if (mine) return mine.myLike === true;
  for (const query of qc.getQueryCache().findAll({ queryKey: ['food', input.foodId, 'reviews'] })) {
    const data = query.state.data as InfiniteData<ReviewPage> | undefined;
    for (const p of data?.pages ?? []) {
      const r = p.items.find((x) => x.id === input.reviewId);
      if (r) return r.myLike === true;
    }
  }
  return false;
}

/**
 * P-095(KB-257) 목 → P-108 실연결: `POST /reviews/{id}/like?liked=` (응답 Unit).
 * 낙관적 토글(캐시 반전) + 실패 롤백(역반전). 서버값(likeCount·likedByMe)은
 * 다음 재조회가 진실 — 표시 전용(정렬 미반영) 유지. off = 목 캐시 토글만.
 */
export function useToggleReviewLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reviewId: string; foodId: string }) => {
      const next = !currentMyLike(qc, input);
      flipLikeCaches(qc, input); // 낙관 반영 (off 경로는 이게 전부 — P-095 목 시맨틱)
      if (!FLAGS.reviewsLiveEnabled) return;
      try {
        await api.post(`/reviews/${input.reviewId}/like?liked=${next}`);
      } catch (e) {
        flipLikeCaches(qc, input); // 실패 롤백
        throw e;
      }
    },
  });
}
