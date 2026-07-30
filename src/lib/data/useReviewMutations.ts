/**
 * useReviewMutations — 리뷰 작성/수정/삭제 (P-085/KB-73 실연결).
 *
 * 성공 시 무효화: ['food', foodId] 프리픽스(상세 평점 + 리뷰 목록 전 필터) +
 * ['me','reviews'] — 목 시절 수동 캐시 삽입 폐기, 서버 재조회가 진실.
 * PATCH는 buildReviewUpdate(풀 페이로드)만 통과 — "생략=제거" 함정 봉쇄.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { buildReviewUpdate, type ReviewUpdateWire } from '@/lib/api/reviewAdapter';

function useInvalidateReviews() {
  const qc = useQueryClient();
  return (foodId: string) => {
    void qc.invalidateQueries({ queryKey: ['food', foodId] }); // 상세(평점)·리뷰 목록
    void qc.invalidateQueries({ queryKey: ['me', 'reviews'] });
  };
}

export function useCreateReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: { foodId: string; rating: number; content?: string; imagePaths?: string[] }) => {
      await api.post('/reviews', {
        foodId: Number(input.foodId),
        rating: input.rating,
        ...(input.content ? { content: input.content } : {}),
        ...(input.imagePaths?.length ? { imagePaths: input.imagePaths } : {}),
      });
    },
    onSuccess: (_d, v) => invalidate(v.foodId),
  });
}

export function useUpdateReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: {
      reviewId: string;
      foodId: string;
      current: { rating: number; body: string | null; photos?: string[] };
      changes: { rating?: number; body?: string | null };
    }) => {
      const body: ReviewUpdateWire = buildReviewUpdate(input.current, input.changes);
      await api.patch(`/reviews/${input.reviewId}`, body);
    },
    onSuccess: (_d, v) => invalidate(v.foodId),
  });
}

export function useDeleteReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (input: { reviewId: string; foodId: string }) => {
      await api.del(`/reviews/${input.reviewId}`);
    },
    onSuccess: (_d, v) => invalidate(v.foodId),
  });
}
