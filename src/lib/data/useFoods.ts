/**
 * useFoods / useFoodDetail — food browse + detail (FR-016/020/021).
 * Same seam pattern as useHome.
 */
import { useQuery } from '@tanstack/react-query';
import type { FoodCard, FoodDetail } from '../api/types';
import { api } from '../api/client';
import { MOCK_FOODS, MOCK_FOOD_DETAILS, MOCK_FOOD_UNREGISTERED } from '../mocks/foods';
import { MOCK_MODE } from './config';

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

export function useFoodDetail(foodId: string) {
  return useQuery({
    queryKey: ['food', foodId],
    queryFn: (): Promise<FoodDetail> => {
      if (MOCK_MODE) {
        return Promise.resolve(MOCK_FOOD_DETAILS[foodId] ?? MOCK_FOOD_UNREGISTERED);
      }
      return api.get<FoodDetail>(`/foods/${foodId}`);
    },
    enabled: !!foodId,
  });
}
