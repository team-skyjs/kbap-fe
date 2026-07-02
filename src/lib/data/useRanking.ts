/**
 * useRanking — the ranking-detail data (GET /me/ranking, FR-025). Separate hook
 * + query key from useMe(): the detail screen needs the heavier `breakdown`
 * that GET /me omits. Same MOCK_MODE seam as the other data hooks.
 */
import { useQuery } from '@tanstack/react-query';
import type { Ranking } from '../api/types';
import { api } from '../api/client';
import { MOCK_RANKING_DETAIL } from '../mocks/ranking';
import { MOCK_MODE } from './config';

export function useRanking() {
  return useQuery({
    queryKey: ['me', 'ranking'],
    queryFn: (): Promise<Ranking> =>
      MOCK_MODE ? Promise.resolve(MOCK_RANKING_DETAIL) : api.get<Ranking>('/me/ranking'),
  });
}
