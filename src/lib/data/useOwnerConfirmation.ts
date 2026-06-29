/**
 * useOwnerConfirmation — place-language (ko) phrase to show restaurant staff
 * (FR-017/018/019). Same seam pattern as the other hooks.
 */
import { useQuery } from '@tanstack/react-query';
import type { OwnerConfirmation } from '@/lib/api/types';
import { api } from '@/lib/api/client';
import { mockOwnerConfirmation } from '@/lib/mocks/owner';
import { MOCK_MODE } from './config';

export function useOwnerConfirmation(foodId: string, ingredientCode?: string) {
  return useQuery({
    queryKey: ['owner-confirmation', foodId, ingredientCode ?? ''],
    queryFn: (): Promise<OwnerConfirmation> => {
      if (MOCK_MODE) return Promise.resolve(mockOwnerConfirmation(foodId, ingredientCode));
      const q = ingredientCode ? `?ingredientCode=${encodeURIComponent(ingredientCode)}` : '';
      return api.get<OwnerConfirmation>(`/foods/${foodId}/owner-confirmation${q}`);
    },
    enabled: !!foodId,
  });
}
