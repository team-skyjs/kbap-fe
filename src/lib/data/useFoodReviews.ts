/**
 * useFoodReviews — per-food reviews (FR-023, GET /foods/{foodId}/reviews).
 * Same MOCK_MODE seam as the other hooks. Same-nationality filter + translation
 * are applied in the screen (mock returns the full response; the real API also
 * accepts `nationality` / `translateTo` query params).
 */
import { useQuery } from '@tanstack/react-query';
import type { FoodReviewsResponse } from '@/lib/api/types';
import { api } from '@/lib/api/client';
import { mockFoodReviews } from '@/lib/mocks/reviews';
import { MOCK_MODE } from './config';

export function useFoodReviews(foodId: string) {
  return useQuery({
    queryKey: ['food', foodId, 'reviews'],
    queryFn: (): Promise<FoodReviewsResponse> =>
      MOCK_MODE ? Promise.resolve(mockFoodReviews(foodId)) : api.get<FoodReviewsResponse>(`/foods/${foodId}/reviews`),
    enabled: !!foodId,
  });
}
