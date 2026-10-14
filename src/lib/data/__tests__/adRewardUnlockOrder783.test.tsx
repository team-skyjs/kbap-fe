/* eslint-disable import/first -- jest.mock 선언 뒤에 대상 모듈을 import(레포 테스트 관례) */
/**
 * KB-783 ⑮(#278 Codex P1) — 마지막 보상 광고로 해제될 때 프로필 재조회(invalidateQueries — await)가 false→true 전이를 먼저 관측하면
 * 'review'로 잘못 세고 뒤이어 'ad'까지 나갔다. 표식은 재조회 **전**에: 실제 airbridge 모듈 + 실제 useClaimAdReward로 순서를 확인한다.
 */
const mockTrack = jest.fn();
jest.mock('airbridge-react-native-sdk', () => ({ Airbridge: { trackEvent: (...a: unknown[]) => mockTrack(...a), setUserID: jest.fn(), clearUser: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { post: (...a: unknown[]) => mockPost(...a) }, ApiError: class extends Error {} }));

import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClaimAdReward } from '../useAdReward';
import { observeScanQuota, __resetAirbridgeStateForTest } from '@/lib/airbridge';

const unlockVias = () => mockTrack.mock.calls.filter((c) => c[0] === 'airbridge.unlockAchievement').map((c) => (c[2] as { via: string }).via);

beforeEach(() => {
  jest.clearAllMocks();
  __resetAirbridgeStateForTest();
});

it('해제 응답 → 재조회가 전이를 관측해도 ad 1회만(review 0)', async () => {
  observeScanQuota('7', false); // 잠긴 회원
  mockPost.mockResolvedValue({ remainingForUnlock: 0, scanUnlocked: true });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  // 재조회 = 해제된 프로필 관측(fetchMe 성공 경로가 하는 일)
  jest.spyOn(qc, 'invalidateQueries').mockImplementation(async () => {
    observeScanQuota('7', true);
  });
  let claim!: ReturnType<typeof useClaimAdReward>;
  function Probe() {
    claim = useClaimAdReward();
    return null;
  }
  await act(async () => {
    renderer.create(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>);
  });
  await act(async () => {
    await claim.mutateAsync({ rewardKey: 'k', adUnitId: 'u' });
  });
  expect(unlockVias()).toEqual(['ad']);
});

it('해제 아닌 보상(n/3 진행) = 해제 이벤트 0', async () => {
  observeScanQuota('7', false);
  mockPost.mockResolvedValue({ remainingForUnlock: 2, scanUnlocked: false });
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  jest.spyOn(qc, 'invalidateQueries').mockImplementation(async () => {
    observeScanQuota('7', false);
  });
  let claim!: ReturnType<typeof useClaimAdReward>;
  function Probe() {
    claim = useClaimAdReward();
    return null;
  }
  await act(async () => {
    renderer.create(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>);
  });
  await act(async () => {
    await claim.mutateAsync({ rewardKey: 'k', adUnitId: 'u' });
  });
  expect(unlockVias()).toEqual([]);
});
