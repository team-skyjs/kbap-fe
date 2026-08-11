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
import { api, apiLang } from '@/lib/api/client';
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
  // P-165(#144): 버전리스 이관 — GET /api/reviews (lang 필수, foodId는 선택이나
  // 이 훅은 음식별 호출만 — 전역 피드는 KB-307 별도).
  const q = new URLSearchParams();
  q.set('lang', apiLang());
  q.set('foodId', foodId);
  if (cursor) q.set('cursor', cursor);
  if (countryCode) q.set('countryCode', countryCode);
  return adaptReviewPage(await api.get<ReviewPageWire>(`/api/reviews?${q.toString()}`));
}

/** P-179(KB-307): 전역 최신 리뷰 피드 — GET /api/reviews에서 **foodId 생략**(#144).
 *  bearerAuth 필수(계약) — 게스트/봉인은 빈 페이지(화면이 게이트 담당). */
export async function fetchGlobalReviewsPage(cursor: string | null): Promise<ReviewPage> {
  if (!FLAGS.reviewsLiveEnabled || !(await hasBeSession())) return { items: [], hasNext: false, nextCursor: null };
  const q = new URLSearchParams();
  q.set('lang', apiLang());
  if (cursor) q.set('cursor', cursor);
  return adaptReviewPage(await api.get<ReviewPageWire>(`/api/reviews?${q.toString()}`));
}

export function useGlobalReviews(enabled = true) {
  return useInfiniteQuery({
    queryKey: ['reviews', 'global'],
    queryFn: ({ pageParam }) => fetchGlobalReviewsPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor : undefined),
    enabled,
  });
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
