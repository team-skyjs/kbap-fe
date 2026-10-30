/**
 * useProcessedFoods (KB-812) — 가공식품 검색·상세. dev Swagger 3.2: `GET /api/processed-foods?query=&cursor=&size=` ·
 * `/api/processed-foods/{id}` (X-API-Version 3.2 필수, 비회원 허용). 와이어 변환은 lib/api/processedFoodAdapter.
 * - KB-865 v4: 검색어 없이도 요청한다(대표 상품 먼저) — 구서버는 400(FOOD-003)이고 그게 "v4 미배포" 신호다
 *   (browseUnsupported). 유형(type)은 v4가 확인된 뒤에만 보낸다(화면이 게이트 — 구서버는 모르는 파라미터를 무시해 거른 척이 된다).
 * - 상세 404 PFOOD-001 = 없음, 410 PFOOD-002 = 생산종료 — 재시도로 바뀌지 않는 상태라 retry 0.
 * - 상세 키에 회원 여부 — avoidance가 회원만 오고 비회원은 null(로그인 뒤 같은 캐시를 쓰면 대조가 안 보인다).
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, apiLang, ApiError } from '../api/client';
import { adaptProcessedDetail, adaptProcessedSummary, type DetailWire, type PackagedType, type ProcessedFoodDetail, type ProcessedVerdict, type SearchPageWire } from '../api/processedFoodAdapter';
import { useIsGuest } from '../auth/useSession';
import { useMe } from './useMe';
import { useAppLanguage } from '../i18n/useAppLanguage';
import { PROCESSED_FOOD_API_VERSION } from './processedFoodApiVersion';

/** 판정 캐시 키 — 판정(verdict)은 회피 설정마다, 번역은 언어마다 다르다 — 캐시 키에 회피 코드 집합을 묶어 다른 설정의 판정이 보이지 않게(Codex #338 P1: 설정을 바꾼 뒤 재조회가 끝날 때까지 옛 판정이 남았다).
 *  비회원 = 'guest' · 회원 = 정렬한 코드(프로필 도착 전 = 'member:?' — 도착하면 키가 바뀌어 새로 받는다) */
export function useVerdictKey(): string {
  const guest = useIsGuest();
  const { data: me } = useMe();
  // Codex #338 R4: 번역(이름·원재료·알레르기 표시)은 요청 언어마다 다르다 — 언어도 키에(음식 상세 키와 같은 방식, 구독으로 KB-695)
  const lang = useAppLanguage();
  if (guest) return `${lang}|guest`;
  if (!me) return `${lang}|member:?`;
  return `${lang}|member:${me.restrictions.map((r) => r.code).sort().join(',')}`;
}

export { PROCESSED_FOOD_API_VERSION };
export const PROCESSED_PAGE_SIZE = 20;
const headers = { headers: { 'X-API-Version': PROCESSED_FOOD_API_VERSION } };

/** KB-927: verdicts = 서버 판정 필터(여러 개면 OR, `verdict=A&verdict=B`). 비회원·회피 0개면 서버가 무시 — 화면이 칩째 숨긴다 */
export type ProcessedListFilter = { type?: PackagedType | null; verdicts?: readonly ProcessedVerdict[] | null };

export async function fetchProcessedSearch(query: string, cursor?: string, filter: ProcessedListFilter = {}) {
  const parts = [
    query ? `query=${encodeURIComponent(query)}` : null,
    filter.type ? `type=${filter.type}` : null,
    ...(filter.verdicts ?? []).map((v) => `verdict=${v}`),
    cursor ? `cursor=${encodeURIComponent(cursor)}` : null,
    `size=${PROCESSED_PAGE_SIZE}`,
    `lang=${apiLang()}`, // KB-901(T-014): 표시명·제조사 번역은 lang 쿼리로만 온다(Accept-Language만으론 한국어 — dev 실측)
  ];
  const page = await api.get<SearchPageWire>(`/api/processed-foods?${parts.filter(Boolean).join('&')}`, headers);
  return { items: page.items.map(adaptProcessedSummary), hasNext: page.hasNext, nextCursor: page.nextCursor ?? null };
}
export async function fetchProcessedDetail(id: string): Promise<ProcessedFoodDetail> {
  // KB-901(T-013): 목록과 같이 lang — 없으면 Food 탭 진입 상세만 "농심 / 신라면"(스캔 확정 진입 = 영어)이었다
  return adaptProcessedDetail(await api.get<DetailWire>(`/api/processed-foods/${encodeURIComponent(id)}?lang=${apiLang()}`, headers));
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

/** 목록·검색 한 벌. 키에 판정 기준(비회원 / 회원 회피 코드 집합 — useVerdictKey) · KB-927 판정 필터(정렬한 값). */
function useProcessedSearchQuery<T>(query: string, filter: ProcessedListFilter, select: (pages: SearchPage[]) => T) {
  const term = query.trim();
  const verdictKey = useVerdictKey();
  const type = filter.type ?? null;
  const verdicts = filter.verdicts?.length ? [...filter.verdicts].sort() : null;
  return useInfiniteQuery({
    queryKey: ['processedFoods', 'search', term, type, verdictKey, verdicts?.join(',') ?? null],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchProcessedSearch(term, pageParam, { type, verdicts }),
    // 커서 에코 가드(#112 문법) — 같은 커서가 다시 오면 끝
    getNextPageParam: (last, _pages, lastParam, allParams) =>
      last.hasNext && last.nextCursor != null && last.nextCursor !== lastParam && !allParams.includes(last.nextCursor) ? last.nextCursor : undefined,
    select: (data) => select(data.pages),
  });
}

type SearchPage = Awaited<ReturnType<typeof fetchProcessedSearch>>;

export function useProcessedSearch(query: string, filter: ProcessedListFilter = {}) {
  return useProcessedSearchQuery(query, filter, (pages) => pages.flatMap((p) => p.items));
}

/** KB-927: 페이지별 건수까지 — 판정 필터는 서버가 최대 200행만 살피고 0건 페이지 + hasNext를 줄 수 있어 화면이 빈 페이지를 센다 */
export function useProcessedSearchPaged(query: string, filter: ProcessedListFilter = {}) {
  return useProcessedSearchQuery(query, filter, (pages) => ({ items: pages.flatMap((p) => p.items), pageSizes: pages.map((p) => p.items.length) }));
}

export type EmptyPageAction = 'fetch' | 'button' | 'none';
/** KB-927 빈 페이지 규칙: 마지막 페이지가 0건인데 다음이 있으면 이어 부른다 — 연속 EMPTY_AUTO_MAX번(resumeAt 뒤에서 센다)까지 자동, 그 뒤엔 "더 찾아보기" 버튼.
 *  마지막 페이지에 건이 있으면 'none'(목록 끝 onEndReached가 맡는다) · 다음이 없으면 'none'(누적 0건이면 그때 "결과 없음"). */
export const EMPTY_AUTO_MAX = 3;
export function emptyPageAction(pageSizes: readonly number[], hasNext: boolean, resumeAt = 0): EmptyPageAction {
  if (!hasNext || pageSizes.length === 0 || pageSizes[pageSizes.length - 1] > 0) return 'none';
  let streak = 0;
  for (let i = pageSizes.length - 1; i >= Math.max(resumeAt, 0) && pageSizes[i] === 0; i--) streak++;
  return streak < EMPTY_AUTO_MAX ? 'fetch' : 'button';
}

export function useProcessedDetail(id: string | undefined) {
  const verdictKey = useVerdictKey();
  return useQuery({
    queryKey: ['processedFoods', 'detail', id, verdictKey],
    queryFn: () => fetchProcessedDetail(id as string),
    enabled: !!id,
    retry: (n, e) => processedUnavailable(e) == null && n < 1,
  });
}
