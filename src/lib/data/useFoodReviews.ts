/**
 * useFoodReviews — per-food reviews (P-085/KB-73 실연결).
 * GET /foods/{foodId}/reviews — keyset(cursor·hasNext·nextCursor) + countryCode
 * 필터(같은 국적, 서버측 정확 일치). 세션 없으면(게스트/웹 개발) mock — 게스트
 * 블러 고스트 렌더가 데이터 없이도 돌게. mock 경로는 필터를 클라이언트에서 흉내.
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ReviewPage } from '@/lib/api/types';
import { api } from '@/lib/api/client';
import { adaptReviewPage, type ReviewPageWire } from '@/lib/api/reviewAdapter';
import { hasBeSession } from '@/lib/auth/beAuth';
import { mockFoodReviews } from '@/lib/mocks/reviews';

export function useFoodReviews(foodId: string, countryCode?: string | null) {
  return useInfiniteQuery({
    queryKey: ['food', foodId, 'reviews', countryCode ?? 'all'],
    queryFn: async ({ pageParam }): Promise<ReviewPage> => {
      if (!(await hasBeSession())) {
        const page = mockFoodReviews(foodId);
        return countryCode
          ? { ...page, items: page.items.filter((r) => r.authorNationality === countryCode) }
          : page;
      }
      const q = new URLSearchParams();
      if (pageParam) q.set('cursor', pageParam);
      if (countryCode) q.set('countryCode', countryCode);
      const qs = q.toString();
      return adaptReviewPage(await api.get<ReviewPageWire>(`/foods/${foodId}/reviews${qs ? `?${qs}` : ''}`));
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor : undefined),
    enabled: !!foodId,
  });
}
