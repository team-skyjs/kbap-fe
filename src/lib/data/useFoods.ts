/**
 * useFoods / useFoodDetail — food browse + detail (FR-016/020/021).
 *
 * - useFoods (list/search): still MOCK_MODE — no list endpoint in the BE yet.
 * - useFoodDetail: wired LIVE to GET /api/v1/foods/detail (KB-70). The BE keys
 *   a dish by its Korean menu name, so we resolve the route id → Korean name
 *   (mock catalog foodId → nameKo; a scan→detail nav may already pass the Korean
 *   name). Response is adapted BE → internal FoodDetail (foodAdapter). Query key
 *   includes the reader language so a live language switch refetches.
 */
import { useQuery } from '@tanstack/react-query';
import i18n from '../i18n';
import type { FoodCard, FoodDetail } from '../api/types';
import type { FoodDetailWire } from '../api/foodDetailTypes';
import { api, apiLang, ApiError } from '../api/client';
import { adaptFoodDetail, unregisteredFoodDetail } from '../api/foodAdapter';
import { MOCK_FOODS, MOCK_FOOD_DETAILS, MOCK_FOOD_UNREGISTERED } from '../mocks/foods';
import { MOCK_MODE } from './config';

/**
 * Detail connects LIVE regardless of the global MOCK_MODE (like the scan spike)
 * — it's one of the two endpoints the redeployed Swagger exposes. Flip to `true`
 * to fall back to mock detail (e.g. offline demo).
 */
const MOCK_MODE_DETAIL = false;

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

/** Route id → Korean menu name the detail endpoint keys on. */
function resolveMenuNameKo(id: string): string {
  const hit = MOCK_FOODS.find((f) => f.foodId === id);
  if (hit) return hit.nameKo;
  return id; // scan→detail passes the raw Korean name (encoded → decoded by router)
}

export function useFoodDetail(id: string) {
  return useQuery({
    // reader language in the key: switching language refetches the localized detail.
    queryKey: ['food', id, i18n.language],
    queryFn: async (): Promise<FoodDetail> => {
      if (MOCK_MODE_DETAIL) {
        return MOCK_FOOD_DETAILS[id] ?? MOCK_FOOD_UNREGISTERED;
      }
      const menuNameKo = resolveMenuNameKo(id);
      try {
        const wire = await api.get<FoodDetailWire>(
          `/foods/detail?menuName=${encodeURIComponent(menuNameKo)}&lang=${apiLang()}`,
        );
        return adaptFoodDetail(wire, menuNameKo);
      } catch (e) {
        // BE signals "dish not in catalog" as HTTP 400 (we clamp lang, so 400 here
        // means not-found, not a bad language) → show the "Unable to assess"
        // screen (FR-033), never a hard error. Network/5xx still throw → error UI.
        if (e instanceof ApiError && e.status === 400) return unregisteredFoodDetail(menuNameKo);
        throw e;
      }
    },
    enabled: !!id,
    retry: false, // surface BE/network errors straight to the error UI (spec DoD)
  });
}
