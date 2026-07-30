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
    mutationFn: async (input: { foodId: string; rating: number; content?: string; imagePaths?: string[] }) => {
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
