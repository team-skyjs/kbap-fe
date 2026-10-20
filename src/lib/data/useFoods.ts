/**
 * useFoods / useInfiniteFoods / useFoodDetail — food browse + detail
 * (FR-016/020/021 · KB-70/71).
 *
 * - useInfiniteFoods (browse grid): LIVE on GET /api/v1/foods?cursor=&lang= —
 *   newest-first keyset pagination; feed nextCursor back until hasNext=false.
 * - useFoods (search/home helpers): still MOCK — no search endpoint in the BE
 *   yet (KB-71 rest). Home is being rebuilt in KB-20.
 * - useFoodDetail: LIVE on GET /api/v1/foods/{foodId} (KB-70, redeployed
 *   Swagger). foodId is the numeric id the list/search hands down. Non-numeric
 *   route ids still occur in two mock-era flows:
 *     · mock catalog slugs (home/search cards while those screens stay mock)
 *       → served from MOCK_FOOD_DETAILS so the flows keep working;
 *     · scan→detail passes a raw Korean menu name — the scan contract has NO
 *       foodId yet (KB-71 blocker, BE 질의 중) → "Unable to assess" screen.
 *   Query keys include the reader language so a live switch refetches.
 */
import * as React from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppLanguage } from '../i18n/useAppLanguage';
import type { FoodCard, FoodDetail } from '../api/types';
import type { FoodDetailWire } from '../api/foodDetailTypes';
import type { PageMenuSummaryWire } from '../api/foodListTypes';
import { api, apiLang } from '../api/client';
import { trackReadyFood, useIsFoodHidden } from './hiddenFoods';
import { adaptFoodDetail, adaptMenuSummary, unregisteredFoodDetail, riskWireOf, type RiskFilterChip } from '../api/foodAdapter';
import { MOCK_FOODS, MOCK_FOOD_DETAILS, MOCK_FOOD_UNREGISTERED } from '../mocks/foods';
import { MOCK_MODE } from './config';
import { fetchSortedPage, nameSortOptions, nameSortQuery, useRestartOnStaleCursor, type FoodNameSort, type SortedPage } from './foodNameSort';

/**
 * Foods endpoints connect LIVE regardless of the global MOCK_MODE (like the
 * scan spike) — they're what the redeployed Swagger exposes. Flip to `true`
 * to fall back to mocks (e.g. offline demo).
 */
const MOCK_MODE_FOODS = false;

/** Mock catalog + search — home/search still ride this until KB-20/71 land. */
export function useFoods(query?: string) {
  return useQuery({
    queryKey: ['foods', query ?? ''],
    queryFn: (): Promise<FoodCard[]> => {
      if (MOCK_MODE) {
        const q = query?.trim().toLowerCase();
        const list = q
          ? MOCK_FOODS.filter(
              (f) => f.name.toLowerCase().includes(q) || f.nameKo.includes(q),
            )
          : MOCK_FOODS;
        return Promise.resolve(list);
      }
      return api.get<FoodCard[]>(`/foods${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    },
  });
}

/**
 * Browse list, LIVE (KB-71): newest-first keyset pages. `pageParam` is the
 * BE's nextCursor (last item's foodId — treated as opaque).
 */
/** 목록 페이지 fetch — 훅과 부트 프리페치(P-018 bootGate)가 공유. */
export async function fetchFoodsPage(pageParam: string | number | undefined, riskWire?: string, sort?: FoodNameSort): Promise<SortedPage> {
  if (MOCK_MODE_FOODS) {
    return {
      items: MOCK_FOODS.map((f) => ({
        foodId: Number(f.foodId) || 0,
        name: f.name,
        koreanName: f.nameKo,
        imageRef: null,
        spiciness: 0,
        overallRiskStatus: 'UNKNOWN' as const,
      })),
      hasNext: false,
    };
  }
  const cursor = pageParam != null ? `cursor=${encodeURIComponent(String(pageParam))}&` : '';
  // P-008(KB-174 후속): 401 특례(게스트 정숙 임시책) 제거 — foods 인증-선택
  // 전환 완료(무토큰 200, 7/20 실측)로 게스트는 401이 없고, 남는 401 =
  // 죽은 토큰뿐. 빈 목록 위장은 isError를 막아 에러 블록을 무력화한다.
  const riskQ = riskWire ? `&risk=${riskWire}` : '';
  // KB-821: 이름 정렬만 3.1 헤더 + sort(커서는 불투명 문자열 그대로) — 기본 정렬은 위 요청 바이트 그대로
  return fetchSortedPage(sort, pageParam == null, () =>
    api.get<PageMenuSummaryWire>(`/foods?${cursor}lang=${apiLang()}${riskQ}${nameSortQuery(sort)}`, nameSortOptions(sort)));
}

/** P-350(KB-492): 위험도 칩 = 서버 필터 — UI 칩→서버 enum 매핑은 foodAdapter
 *  (#112 P2: 어댑터 격리 규칙).
 *  ⚠️ risk 지정 시 items는 hasNext=true여도 PAGE_SIZE 미만(0 포함) 가능 —
 *  종료 판정은 hasNext/nextCursor로만(빈 페이지 = 종료 아님). */
export const FOODS_PAGE_SIZE = 20; // 서버 FoodService/BookmarkService PAGE_SIZE 동치

/** 음식 목록 무한 쿼리 옵션(키·페치·커서) — 화면 목록과 선요청(KB-830)이 **같은 정의**를 쓴다(키·커서 규칙이 갈라지면 선요청 캐시가 안 맞는다). */
export function foodsListOptions(lang: string, wire: string | undefined, sort: FoodNameSort | undefined) {
  // risk 지정 = 별도 캐시(쿼리키 분리 — 'all' 목록과 페이지 혼입 금지) · KB-821 이름 정렬도 별도 캐시(커서 종류가 다르다)
  const baseKey = wire ? ['foods', 'list', lang, wire] : ['foods', 'list', lang];
  return {
    queryKey: sort ? [...baseKey, 'sort', sort] : baseKey,
    initialPageParam: undefined as string | number | undefined,
    queryFn: ({ pageParam }: { pageParam: string | number | undefined }) => fetchFoodsPage(pageParam, wire, sort),
    // #112 P1 ①(P-332 문법 이식): 커서 에코 가드 — 얇은 페이지 자동 연속 페치가
    // 커서 미전진 경계 응답에서 무한 루프(이 PR이 잡으려던 증상)가 되지 않게,
    // 이미 요청한 커서 재등장 = hasNext 무시·종료.
    getNextPageParam: (last: SortedPage, _pages: SortedPage[], lastParam: string | number | undefined, allParams: (string | number | undefined)[]) =>
      last.hasNext && last.nextCursor != null &&
      last.nextCursor !== lastParam && !allParams.includes(last.nextCursor)
        ? last.nextCursor
        : undefined,
  };
}

export function useInfiniteFoods(risk?: RiskFilterChip, opts?: { enabled?: boolean; sort?: FoodNameSort }) {
  const lang = useAppLanguage(); // KB-695: 구독 — 렌더 중 i18n.language 직접 읽기는 컴파일러가 키를 굳힌다
  const base = foodsListOptions(lang, riskWireOf(risk), opts?.sort);
  const q = useInfiniteQuery({
    ...base,
    enabled: opts?.enabled ?? true, // #112 2R ②: Saved 활성 중 비활성 browse risk 쿼리 억제
    select: (data) => data.pages.flatMap((p) => p.items.map(adaptMenuSummary)),
  });
  useRestartOnStaleCursor(base.queryKey, q.dataUpdatedAt); // KB-821: 400 FOOD-002·409 FOOD-022 → 첫 페이지부터
  return q;
}

/** 서버 정렬 3종(인기 = 정렬 파라미터 없음 · 이름 A–Z · Z–A). NEW는 서버 정렬이 없어 비활성이라 제외. */
export const SERVER_FOOD_SORTS: (FoodNameSort | undefined)[] = [undefined, 'name_asc', 'name_desc'];

/**
 * KB-830: 정렬 전환을 즉시로 — 현재 목록의 첫 페이지가 도착한 **뒤**(ready), 같은 필터의 **다른 정렬** 첫 페이지만
 * prefetchInfiniteQuery로 받아 둔다(pages: 1 — 오래된 다페이지 캐시도 1장만 · 실패 무시 · 신선한 캐시는 재요청 0 — 기본 staleTime이 목록과 같다).
 * keepPreviousData는 쓰지 않는다: 필터가 바뀔 때 옛 판정이 보이면 안 되는 판정 표면(정렬만 바뀌어도 같은 쿼리라 일관되게).
 * 다시 거는 계기 = 필터·언어·현재 정렬 변경, 탭 진입(enabled) — 신선하면 네트워크 0.
 */
export function usePrefetchOtherFoodSorts(risk: RiskFilterChip | undefined, current: FoodNameSort | undefined, opts: { enabled: boolean; ready: boolean }) {
  const qc = useQueryClient();
  const lang = useAppLanguage();
  const wire = riskWireOf(risk);
  const { enabled, ready } = opts;
  React.useEffect(() => {
    if (!enabled || !ready) return;
    for (const sort of SERVER_FOOD_SORTS) {
      if (sort === current) continue;
      // Codex #307 P2: pages 1 명시 — 생략하면 오래된 캐시(깊이 스크롤한 정렬)의 페이지 수만큼 전부 다시 받는다(정렬당 1요청 상한 깨짐)
      void qc.prefetchInfiniteQuery({ ...foodsListOptions(lang, wire, sort), pages: 1 }).catch(() => {}); // 선요청 실패 = 무시(전환 시 정상 로딩)
    }
  }, [qc, lang, wire, current, enabled, ready]);
}

/**
 * Search, LIVE (KB-71): GET /foods/search?keyword=&cursor=&lang= — submit-only
 * (no as-you-type). Same page shape/cursor pattern as the browse list, so the
 * summary adapter is reused as-is. keyword must be non-blank (server 400s on
 * blank — the `enabled` flag is the client guard). Empty items on page 1 is a
 * NORMAL response (no match), not an error.
 */
/** P-238: scope — 'scanned' = 본인 스캔 한정(회원 전용·**페이징 없이 전체 반환,
 *  cursor 무시** — 스웨거 규약이라 scanned에선 cursor를 아예 안 보낸다).
 *  미전달 = all 기본(음식탭·홈 검색 무변 — 회귀 유닛 잠금). */
export function useSearchFoods(keyword: string, scope?: 'scanned') {
  const lang = useAppLanguage(); // KB-695: 구독 — 렌더 중 i18n.language 직접 읽기는 컴파일러가 키를 굳힌다
  const term = keyword.trim();
  return useInfiniteQuery({
    queryKey: ['foods', 'search', term, scope ?? 'all', lang],
    initialPageParam: undefined as string | number | undefined,
    enabled: term.length > 0,
    queryFn: async ({ pageParam }): Promise<PageMenuSummaryWire> => {
      // scanned = 페이징 없음(cursor 전송 금지 — 서버가 무시하지만 규약 준수)
      const cursor = scope !== 'scanned' && pageParam != null ? `&cursor=${encodeURIComponent(String(pageParam))}` : '';
      const scopeQ = scope ? `&scope=${scope}` : '';
      // P-008: 401 특례 제거 (browse와 동일 — 위 주석 참조)
      return api.get<PageMenuSummaryWire>(
        `/foods/search?keyword=${encodeURIComponent(term)}${cursor}${scopeQ}&lang=${apiLang()}`,
      );
    },
    // KB-722: 커서 에코 가드(browse·북마크와 같은 문법) — 서버가 같은 커서를 되돌리면 끝까지 스크롤할 때마다 같은 페이지가 다시 붙는다(키 중복)
    getNextPageParam: (last, _pages, lastParam, allParams) =>
      last.hasNext && last.nextCursor != null &&
      last.nextCursor !== lastParam && !allParams.includes(last.nextCursor)
        ? last.nextCursor
        : undefined,
    select: (data) => data.pages.flatMap((p) => p.items.map(adaptMenuSummary)),
  });
}

/** P-238: 본인 스캔 음식(최신 스캔순) — GET /api/foods/scanned. 회원 전용(게스트 =
 *  호출 0, 화면이 인기 폴백 담당). 커서 = 마지막 foodId. 리뷰 픽커 초기 목록용. */
export function useScannedFoods(enabled = true) {
  const lang = useAppLanguage(); // KB-695: 구독 — 렌더 중 i18n.language 직접 읽기는 컴파일러가 키를 굳힌다
  return useInfiniteQuery({
    queryKey: ['foods', 'scanned', lang],
    initialPageParam: undefined as string | number | undefined,
    enabled,
    queryFn: async ({ pageParam }): Promise<PageMenuSummaryWire> => {
      const cursor = pageParam != null ? `?cursor=${encodeURIComponent(String(pageParam))}&lang=${apiLang()}` : `?lang=${apiLang()}`;
      return api.get<PageMenuSummaryWire>(`/api/foods/scanned${cursor}`);
    },
    getNextPageParam: (last) => (last.hasNext && last.nextCursor != null ? last.nextCursor : undefined),
    select: (data) => data.pages.flatMap((p) => p.items.map(adaptMenuSummary)),
  });
}

/** 숨김 중 재확인 주기 — 아래 `refetchInterval` 주석. */
export const HIDDEN_RECHECK_MS = 30_000;

export function useFoodDetail(id: string) {
  const lang = useAppLanguage(); // KB-695: 구독 — 렌더 중 i18n.language 직접 읽기는 컴파일러가 키를 굳힌다
  const hidden = useIsFoodHidden(id);
  return useQuery({
    // reader language in the key: switching language refetches the localized detail.
    queryKey: ['food', id, lang],
    queryFn: async (): Promise<FoodDetail> => {
      if (MOCK_MODE_FOODS) {
        return MOCK_FOOD_DETAILS[id] ?? MOCK_FOOD_UNREGISTERED;
      }
      // Non-numeric id = mock-era flow (catalog slug or scanned Korean name);
      // the live endpoint keys strictly on the numeric foodId.
      if (!/^\d+$/.test(id)) {
        return MOCK_FOOD_DETAILS[id] ?? unregisteredFoodDetail(decodeURIComponent(id));
      }
      // KB-626(P-405): 숫자 id의 **400 → "미등록 음식" 폴백을 없앴다.** 에러는 그대로 올린다.
      //  · 상세 API가 선언한 400은 FOOD-001 하나다(서버 `FoodApi.detail` `@ApiErrors(FOOD_NOT_FOUND)`).
      //    FOOD-001 = 음식이 READY가 아님(숨김·삭제) → 화면이 `isFoodHidden`으로 조용한 안내를 그린다.
      //  · 그 외 400은 계약 밖 오류다 → 일반 오류 UI(QueryErrorBlock). "판정 불가"로 덮지 않는다.
      //  · 폴백은 `unregisteredFoodDetail(id)`로 **숫자 id를 이름에** 넣어 사용자가 "123"이라는 음식을
      //    봤다(실사례). ⚠️ status로 분기하는 폴백을 되살리지 말 것 — 분기는 `ApiError.code`로만.
      //  (비숫자 id = 스캔한 미등록 음식은 위에서 네트워크 없이 처리 — 이름이 스캔 텍스트라 정당)
      // KB-626(#185 2R): FOOD-001은 거부를 받은 **이 자리**에서 숨김 신호를 세운다 — 화면은 신호 하나로
      // 가린다(hiddenFoods). 성공하면 푼다(음식이 다시 READY). catch는 표시만 하고 **그대로 다시 던진다** —
      // 폴백 반환 금지(위 주석).
      // 적응은 run **안에서** — 깨진 200이 신호만 풀고 쿼리는 실패하면 캐시 판정이 드러난다(#185 4R)
      return trackReadyFood(id, async () =>
        adaptFoodDetail(await api.get<FoodDetailWire>(`/foods/${id}?lang=${apiLang()}`), id),
      );
    },
    enabled: !!id,
    // #185 6R(P2): 숨김은 "거부 **이후 출발한** 성공"만 풀 수 있는데, 숨김 화면엔 그런 요청을 낼 트리거가
    // 없다(상세 쿼리는 이미 성공·fresh, 포커스 재조회 off, 재시도 UI 없음) → 음식이 READY로 돌아와도 화면에
    // 머무는 동안 영영 숨김. 숨김 중에만 주기 재조회한다(RQ 기본 = 앱 백그라운드에선 멈춤).
    // ponytail: 고정 30초 폴링 — 숨김 화면에 머무는 드문 경우만 도는 부하. 늘면 백오프로.
    refetchInterval: hidden ? HIDDEN_RECHECK_MS : false,
    retry: false, // surface BE/network errors straight to the error UI (spec DoD)
  });
}
