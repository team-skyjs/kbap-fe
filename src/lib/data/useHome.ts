/**
 * useHome — home feed (recent + recommended) with personalized risk (FR-034/035).
 * Seam pattern (handoff §5-3): queryFn returns mock JSON when MOCK_MODE,
 * else the real API. Screens only ever destructure { data, isLoading }.
 */
import { useQuery } from '@tanstack/react-query';
import type { HomeResponse } from '../api/types';
import { api } from '../api/client';
import { MOCK_HOME } from '../mocks/foods';
import { MOCK_MODE } from './config';

export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: (): Promise<HomeResponse> =>
      MOCK_MODE ? Promise.resolve(MOCK_HOME) : api.get<HomeResponse>('/home'),
  });
}
