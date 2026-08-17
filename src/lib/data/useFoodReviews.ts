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

/** P-229: 피드 필터 — 스웨거 실측(8/18) 지원 파라미터 2종뿐(countryCode ISO-2 정확
 *  일치 · foodId). 소팅·별점은 파라미터 부재 — 커서 페이지네이션이라 클라 로컬
 *  소팅은 로드된 페이지만 정렬하는 왜곡이므로 금지(BE 추가 대기, be-agenda). */
export interface GlobalFeedFilters {
  countryCode?: string | null;
  foodId?: string | null;
}

/** P-179(KB-307): 전역 최신 리뷰 피드 — GET /api/reviews (P-229: 서버 필터 2종).
 *  bearerAuth 필수(계약) — 게스트/봉인은 빈 페이지(화면이 게이트 담당). */
export async function fetchGlobalReviewsPage(cursor: string | null, filters: GlobalFeedFilters = {}): Promise<ReviewPage> {
  if (!FLAGS.reviewsLiveEnabled || !(await hasBeSession())) return { items: [], hasNext: false, nextCursor: null };
  const q = new URLSearchParams();
  q.set('lang', apiLang());
  if (cursor) q.set('cursor', cursor);
  if (filters.countryCode) q.set('countryCode', filters.countryCode); // 서버 필터 — 클라 필터 금지
  if (filters.foodId) q.set('foodId', filters.foodId);
  return adaptReviewPage(await api.get<ReviewPageWire>(`/api/reviews?${q.toString()}`));
}

export function useGlobalReviews(enabled = true, filters: GlobalFeedFilters = {}) {
  return useInfiniteQuery({
    // ⚠️ ['reviews','global'] 프리픽스 유지 — 좋아요 낙관 반영(likeInfiniteQueries)·
    // 작성 무효화(useInvalidateReviews)가 프리픽스 매칭이라 필터 키 확장에도 안전.
    queryKey: ['reviews', 'global', filters.countryCode ?? 'all', filters.foodId ?? 'all'],
    queryFn: ({ pageParam }) => fetchGlobalReviewsPage(pageParam, filters),
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
