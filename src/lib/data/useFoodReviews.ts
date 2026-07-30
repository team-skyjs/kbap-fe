/**
 * useFoodReviews — per-food reviews (P-085/KB-73 실연결 · P-086 플래그 봉인).
 *
 * FLAGS.reviewsLiveEnabled=false(현행) 또는 세션 없음 → **P-077 목 경로**
 * (리뷰 API 네트워크 호출 0 — BE 계약 변경 예고·prod 미배포 OTA 안전).
 * on + 세션 → GET /foods/{foodId}/reviews keyset(cursor·hasNext·nextCursor)
 * + countryCode 필터(서버 정확 일치). 목 경로는 필터를 클라이언트에서 흉내.
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ReviewPage } from '@/lib/api/types';
import { api } from '@/lib/api/client';
import { adaptReviewPage, type ReviewPageWire } from '@/lib/api/reviewAdapter';
import { hasBeSession } from '@/lib/auth/beAuth';
import { FLAGS } from '@/lib/flags';
import { mockFoodReviews } from '@/lib/mocks/reviews';

/** 훅 밖 분리 — 플래그 스위칭 유닛 잠금용 (P-086). */
export async function fetchFoodReviewsPage(
  foodId: string,
  cursor: string | null,
  countryCode?: string | null,
): Promise<ReviewPage> {
  if (!FLAGS.reviewsLiveEnabled || !(await hasBeSession())) {
    const page = mockFoodReviews(foodId);
    return countryCode
      ? { ...page, items: page.items.filter((r) => r.authorNationality === countryCode) }
      : page;
  }
  const q = new URLSearchParams();
  if (cursor) q.set('cursor', cursor);
  if (countryCode) q.set('countryCode', countryCode);
  const qs = q.toString();
  return adaptReviewPage(await api.get<ReviewPageWire>(`/foods/${foodId}/reviews${qs ? `?${qs}` : ''}`));
}

export function useFoodReviews(foodId: string, countryCode?: string | null) {
  return useInfiniteQuery({
    queryKey: ['food', foodId, 'reviews', countryCode ?? 'all'],
    queryFn: ({ pageParam }) => fetchFoodReviewsPage(foodId, pageParam, countryCode),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor : undefined),
    enabled: !!foodId,
  });
}
