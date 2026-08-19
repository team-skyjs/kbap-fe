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
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import i18n from '../i18n';
import type { FoodCard, FoodDetail } from '../api/types';
import type { FoodDetailWire } from '../api/foodDetailTypes';
import type { PageMenuSummaryWire } from '../api/foodListTypes';
import { api, apiLang, ApiError } from '../api/client';
import { adaptFoodDetail, adaptMenuSummary, unregisteredFoodDetail } from '../api/foodAdapter';
import { MOCK_FOODS, MOCK_FOOD_DETAILS, MOCK_FOOD_UNREGISTERED } from '../mocks/foods';
import { MOCK_MODE } from './config';

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
export async function fetchFoodsPage(pageParam: number | undefined): Promise<PageMenuSummaryWire> {
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
  return api.get<PageMenuSummaryWire>(`/foods?${cursor}lang=${apiLang()}`);
}

export function useInfiniteFoods() {
  return useInfiniteQuery({
    queryKey: ['foods', 'list', i18n.language],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => fetchFoodsPage(pageParam),
    getNextPageParam: (last) => (last.hasNext && last.nextCursor != null ? last.nextCursor : undefined),
    select: (data) => data.pages.flatMap((p) => p.items.map(adaptMenuSummary)),
  });
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
  const term = keyword.trim();
  return useInfiniteQuery({
    queryKey: ['foods', 'search', term, scope ?? 'all', i18n.language],
    initialPageParam: undefined as number | undefined,
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
    getNextPageParam: (last) => (last.hasNext && last.nextCursor != null ? last.nextCursor : undefined),
    select: (data) => data.pages.flatMap((p) => p.items.map(adaptMenuSummary)),
  });
}

/** P-238: 본인 스캔 음식(최신 스캔순) — GET /api/foods/scanned. 회원 전용(게스트 =
 *  호출 0, 화면이 인기 폴백 담당). 커서 = 마지막 foodId. 리뷰 픽커 초기 목록용. */
export function useScannedFoods(enabled = true) {
  return useInfiniteQuery({
    queryKey: ['foods', 'scanned', i18n.language],
    initialPageParam: undefined as number | undefined,
    enabled,
    queryFn: async ({ pageParam }): Promise<PageMenuSummaryWire> => {
      const cursor = pageParam != null ? `?cursor=${encodeURIComponent(String(pageParam))}&lang=${apiLang()}` : `?lang=${apiLang()}`;
      return api.get<PageMenuSummaryWire>(`/api/foods/scanned${cursor}`);
    },
    getNextPageParam: (last) => (last.hasNext && last.nextCursor != null ? last.nextCursor : undefined),
    select: (data) => data.pages.flatMap((p) => p.items.map(adaptMenuSummary)),
  });
}

export function useFoodDetail(id: string) {
  return useQuery({
    // reader language in the key: switching language refetches the localized detail.
    queryKey: ['food', id, i18n.language],
    queryFn: async (): Promise<FoodDetail> => {
      if (MOCK_MODE_FOODS) {
        return MOCK_FOOD_DETAILS[id] ?? MOCK_FOOD_UNREGISTERED;
      }
      // Non-numeric id = mock-era flow (catalog slug or scanned Korean name);
      // the live endpoint keys strictly on the numeric foodId.
      if (!/^\d+$/.test(id)) {
        return MOCK_FOOD_DETAILS[id] ?? unregisteredFoodDetail(decodeURIComponent(id));
      }
      try {
        const wire = await api.get<FoodDetailWire>(`/foods/${id}?lang=${apiLang()}`);
        return adaptFoodDetail(wire, id);
      } catch (e) {
        // BE signals "dish not in catalog" as HTTP 400 (we clamp lang, so 400 here
        // means not-found, not a bad language) → show the "Unable to assess"
        // screen (FR-033), never a hard error. Network/5xx still throw → error UI.
        if (e instanceof ApiError && e.status === 400) return unregisteredFoodDetail(id);
        throw e;
      }
    },
    enabled: !!id,
    retry: false, // surface BE/network errors straight to the error UI (spec DoD)
  });
}
