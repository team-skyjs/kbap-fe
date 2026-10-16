/* eslint-disable import/first -- mock factories precede imports */
const mockGet = jest.fn();
let mockGen = 0;
jest.mock('@/lib/api/client', () => ({ api: { get: (...args: unknown[]) => mockGet(...args) } }));
jest.mock('@/lib/auth/beTokens', () => ({currentGen: () => mockGen}));
jest.mock('@/lib/data/config', () => ({BE_BASE: 'https://prod.kbap.site'}));
jest.mock('@/lib/i18n/useAppLanguage', () => ({useAppLanguage: () => 'en'}));
jest.mock('@/lib/auth/useSession', () => ({useSession: () => true}));
jest.mock('expo-router', () => ({useFocusEffect: jest.fn()}));
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { useSelectedHomeFoods } from '../useSelectedHomeFoods';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { selectedHomeOptions } from '../useSelectedHomeFoods';
import { advanceSelectedContext, HOME_SELECTION } from '@/features/home/selectedFoods';
const response = () => ({items:HOME_SELECTION.orderedFoodIds.map((foodId) => ({foodId,name:'Food',spiciness:0,overallRiskStatus:'UNKNOWN',bookmarked:false,review:{count:0,averageRating:0}})),unavailableFoodIds:[]});
beforeEach(() => { mockGet.mockReset(); mockGen = 0; });
it('prefetch and screen share one selected request without version override or detail requests', async () => {
  const qc = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:60000}}});
  mockGet.mockResolvedValue(response());
  await Promise.all([qc.prefetchQuery(selectedHomeOptions('en',true)),qc.fetchQuery(selectedHomeOptions('en',true))]);
  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(mockGet).toHaveBeenCalledWith('/foods/selected?ids=743,444,432,325,300,629,435,248,414,445&lang=en');
  qc.clear();
});
it('language, auth, session and avoidance context cannot reuse each other', () => {
  const key = selectedHomeOptions('en',true).queryKey;
  expect(selectedHomeOptions('ja',true).queryKey).not.toEqual(key);
  expect(selectedHomeOptions('en',false).queryKey).not.toEqual(key);
  mockGen++;
  expect(selectedHomeOptions('en',true).queryKey).not.toEqual(key);
  mockGen--;
  advanceSelectedContext();
  expect(selectedHomeOptions('en',true).queryKey).not.toEqual(key);
});
it.each(['session','avoidance'])('rejects delayed results after %s changes', async (kind) => {
  let finish!: (value: unknown) => void;
  mockGet.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const pending = selectedHomeOptions('en',true).queryFn();
  if (kind === 'session') mockGen++; else advanceSelectedContext();
  finish(response());
  await expect(pending).rejects.toThrow('Stale');
});
it.each(['en','ko','ja','zh-Hans','zh-Hant','vi','id','th','ru','es'])('requests the exact reader language %s', async (lang) => {
  mockGet.mockResolvedValue(response());
  await selectedHomeOptions(lang,false).queryFn();
  expect(mockGet.mock.calls[0][0]).toContain(`&lang=${lang}`);
});

it.each(['unavailable','network'])('a later %s response handles the last complete selection correctly', async (kind) => {
  const qc = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:60000}}});
  mockGet.mockResolvedValue(response());
  await qc.prefetchQuery(selectedHomeOptions('en',true));
  let query!: ReturnType<typeof useSelectedHomeFoods>;
  function Probe() { query = useSelectedHomeFoods(); return null; }
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>); });
  expect(query.data?.items).toHaveLength(10);
  if (kind === 'unavailable') mockGet.mockResolvedValue({items:[],unavailableFoodIds:[...HOME_SELECTION.orderedFoodIds]});
  else mockGet.mockRejectedValue(new Error('NETWORK: offline'));
  await act(async () => { await query.refetch(); await new Promise((resolve) => setTimeout(resolve,0)); });
  expect(query.isError).toBe(true);
  if (kind === 'unavailable') expect(query.data).toBeUndefined();
  else expect(query.data?.items).toHaveLength(10);
  await act(async () => { tree.unmount(); }); qc.clear();
});
