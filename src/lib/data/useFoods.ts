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
export function useInfiniteFoods() {
  return useInfiniteQuery({
    queryKey: ['foods', 'list', i18n.language],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }): Promise<PageMenuSummaryWire> => {
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
      try {
        return await api.get<PageMenuSummaryWire>(`/foods?${cursor}lang=${apiLang()}`);
      } catch (e) {
        // 게스트 401: BE의 foods 인증-선택 전환(guest-access-policy §2) 배포
        // 전까지 조용히 빈 목록 — 크래시/에러 화면 금지. 전환되면 자동 소생.
        if (e instanceof ApiError && e.status === 401) return { items: [], hasNext: false };
        throw e;
      }
    },
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
export function useSearchFoods(keyword: string) {
  const term = keyword.trim();
  return useInfiniteQuery({
    queryKey: ['foods', 'search', term, i18n.language],
    initialPageParam: undefined as number | undefined,
    enabled: term.length > 0,
    queryFn: async ({ pageParam }): Promise<PageMenuSummaryWire> => {
      const cursor = pageParam != null ? `&cursor=${encodeURIComponent(String(pageParam))}` : '';
      try {
        return await api.get<PageMenuSummaryWire>(
          `/foods/search?keyword=${encodeURIComponent(term)}${cursor}&lang=${apiLang()}`,
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return { items: [], hasNext: false }; // 게스트 정숙 (§2 전환 전)
        throw e;
      }
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
