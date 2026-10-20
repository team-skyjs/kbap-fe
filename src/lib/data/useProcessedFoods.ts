/**
 * useProcessedFoods (KB-812) — 가공식품 검색·상세. dev Swagger 3.2: `GET /api/processed-foods?query=&cursor=&size=` ·
 * `/api/processed-foods/{id}` (X-API-Version 3.2 필수, 비회원 허용). 와이어 변환은 lib/api/processedFoodAdapter.
 * - 검색 중심: 빈 검색어는 서버 400(FOOD-003)이라 요청하지 않는다(전체 둘러보기 없음).
 * - 상세 404 PFOOD-001 = 없음, 410 PFOOD-002 = 생산종료 — 재시도로 바뀌지 않는 상태라 retry 0.
 * - 상세 키에 회원 여부 — avoidance가 회원만 오고 비회원은 null(로그인 뒤 같은 캐시를 쓰면 대조가 안 보인다).
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { adaptProcessedDetail, adaptProcessedSummary, type DetailWire, type ProcessedFoodDetail, type SearchPageWire } from '../api/processedFoodAdapter';
import { useIsGuest } from '../auth/useSession';

export const PROCESSED_FOOD_API_VERSION = '3.2';
export const PROCESSED_PAGE_SIZE = 20;
const headers = { headers: { 'X-API-Version': PROCESSED_FOOD_API_VERSION } };

export async function fetchProcessedSearch(query: string, cursor?: string) {
  const c = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
  const page = await api.get<SearchPageWire>(`/api/processed-foods?query=${encodeURIComponent(query)}${c}&size=${PROCESSED_PAGE_SIZE}`, headers);
  return { items: page.items.map(adaptProcessedSummary), hasNext: page.hasNext, nextCursor: page.nextCursor ?? null };
}
export async function fetchProcessedDetail(id: string): Promise<ProcessedFoodDetail> {
  return adaptProcessedDetail(await api.get<DetailWire>(`/api/processed-foods/${encodeURIComponent(id)}`, headers));
}

export type ProcessedUnavailable = 'gone' | 'discontinued';
/** 404 = 없음 · 410 = 생산종료 · 그 밖 = null(일시 실패 — 다시 시도) */
export function processedUnavailable(e: unknown): ProcessedUnavailable | null {
  if (!(e instanceof ApiError)) return null;
  if (e.code === 'PFOOD-002' || e.status === 410) return 'discontinued';
  if (e.code === 'PFOOD-001' || e.status === 404) return 'gone';
  return null;
}

export function useProcessedSearch(query: string) {
  const term = query.trim();
  return useInfiniteQuery({
    queryKey: ['processedFoods', 'search', term],
    enabled: term.length > 0,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchProcessedSearch(term, pageParam),
    // 커서 에코 가드(#112 문법) — 같은 커서가 다시 오면 끝
    getNextPageParam: (last, _pages, lastParam, allParams) =>
      last.hasNext && last.nextCursor != null && last.nextCursor !== lastParam && !allParams.includes(last.nextCursor) ? last.nextCursor : undefined,
    select: (data) => data.pages.flatMap((p) => p.items),
  });
}

export function useProcessedDetail(id: string | undefined) {
  const guest = useIsGuest();
  return useQuery({
    queryKey: ['processedFoods', 'detail', id, guest ? 'guest' : 'member'],
    queryFn: () => fetchProcessedDetail(id as string),
    enabled: !!id,
    retry: (n, e) => processedUnavailable(e) == null && n < 1,
  });
}
