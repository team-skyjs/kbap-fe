/**
 * useProcessedFoods (KB-812) — 가공식품 검색·상세. dev Swagger 3.2: `GET /api/processed-foods?query=&cursor=&size=` ·
 * `/api/processed-foods/{id}` (X-API-Version 3.2 필수, 비회원 허용). 와이어 변환은 lib/api/processedFoodAdapter.
 * - KB-865 v4: 검색어 없이도 요청한다(대표 상품 먼저) — 구서버는 400(FOOD-003)이고 그게 "v4 미배포" 신호다
 *   (browseUnsupported). 유형(type)은 v4가 확인된 뒤에만 보낸다(화면이 게이트 — 구서버는 모르는 파라미터를 무시해 거른 척이 된다).
 * - 상세 404 PFOOD-001 = 없음, 410 PFOOD-002 = 생산종료 — 재시도로 바뀌지 않는 상태라 retry 0.
 * - 상세 키에 회원 여부 — avoidance가 회원만 오고 비회원은 null(로그인 뒤 같은 캐시를 쓰면 대조가 안 보인다).
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { adaptProcessedDetail, adaptProcessedSummary, type DetailWire, type PackagedType, type ProcessedFoodDetail, type SearchPageWire } from '../api/processedFoodAdapter';
import { useIsGuest } from '../auth/useSession';

export const PROCESSED_FOOD_API_VERSION = '3.2';
export const PROCESSED_PAGE_SIZE = 20;
const headers = { headers: { 'X-API-Version': PROCESSED_FOOD_API_VERSION } };

export type ProcessedListFilter = { type?: PackagedType | null };

export async function fetchProcessedSearch(query: string, cursor?: string, filter: ProcessedListFilter = {}) {
  const parts = [
    query ? `query=${encodeURIComponent(query)}` : null,
    filter.type ? `type=${filter.type}` : null,
    cursor ? `cursor=${encodeURIComponent(cursor)}` : null,
    `size=${PROCESSED_PAGE_SIZE}`,
  ];
  const page = await api.get<SearchPageWire>(`/api/processed-foods?${parts.filter(Boolean).join('&')}`, headers);
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

/** 검색어 없는 둘러보기를 구서버가 거절(400) = v4 미배포 — 화면은 검색 안내로 폴백(4xx는 기본 재시도 0 — queryClient) */
export function browseUnsupported(e: unknown): boolean {
  return e instanceof ApiError && e.status === 400;
}

/** 목록·검색 한 벌. 키에 회원 여부 — 판정(verdict)이 회원만 오므로 로그인 전후 캐시를 나눈다(회피 설정 변경은 useUpdateMe가 전면 무효화). */
export function useProcessedSearch(query: string, filter: ProcessedListFilter = {}) {
  const term = query.trim();
  const guest = useIsGuest();
  const type = filter.type ?? null;
  return useInfiniteQuery({
    queryKey: ['processedFoods', 'search', term, type, guest ? 'guest' : 'member'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchProcessedSearch(term, pageParam, { type }),
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
