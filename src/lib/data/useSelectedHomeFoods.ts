import { useCallback, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useAppLanguage } from '../i18n/useAppLanguage';
import { useSession } from '../auth/useSession';
import { currentGen } from '../auth/beTokens';
import { api } from '../api/client';
import { adaptSelectedFoods } from '../api/selectedFoodsAdapter';
import { BE_BASE } from './config';
import { HOME_SELECTION, selectedContextRevision, subscribeSelectedContext } from '@/features/home/selectedFoods';

export function selectedHomeOptions(lang: string, authenticated: boolean, generation = currentGen(), revision = selectedContextRevision()) {
  const ids = HOME_SELECTION.orderedFoodIds;
  return {
    queryKey: ['selectedHomeFoods', BE_BASE, '1.1', HOME_SELECTION.selectionVersion, ids.join(','), lang, authenticated, generation, revision] as const,
    queryFn: async () => {
      // These IDs belong to prod. Never send them to a dev database with unrelated IDs.
      if (BE_BASE.replace(/\/$/, '') !== 'https://prod.kbap.site') throw new Error('Selected food manifest environment mismatch');
      const raw = await api.get<unknown>(`/foods/selected?ids=${ids.join(',')}&lang=${encodeURIComponent(lang)}`);
      if (currentGen() !== generation || selectedContextRevision() !== revision) throw new Error('Stale selected food context');
      return adaptSelectedFoods(raw, ids);
    },
  };
}
export function useSelectedHomeFoods() {
  const lang = useAppLanguage();
  const session = useSession();
  const revision = useSyncExternalStore(subscribeSelectedContext, selectedContextRevision, selectedContextRevision);
  const query = useQuery({ ...selectedHomeOptions(lang, session === true, currentGen(), revision), enabled: session !== null });
  const { isStale, refetch } = query;
  useFocusEffect(useCallback(() => { if (isStale && session !== null) void refetch(); }, [isStale, refetch, session]));
  const incomplete = (query.data?.unavailableFoodIds.length ?? 0) > 0;
  return { ...query, data: incomplete ? undefined : query.data, isError: query.isError || incomplete,
    error: incomplete ? new Error('Selected foods unavailable') : query.error };
}
