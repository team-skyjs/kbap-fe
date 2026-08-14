/**
 * P-205 🚨: 로그인/로그아웃 경계 → useIsGuest 소비 표면 즉시 전환 재현 유닛.
 * 실기 재현: 게스트로 탐색(세션 쿼리 false 확립) → 로그인 → 커뮤니티·프로필
 * 탭이 게스트 화면 고착(재시작까지). 실 queryClient 싱글턴 + 실 beAuth/beTokens
 * 경로로 경계 전파를 재현한다(P-190 교훈 — 상태 직접 세팅 검증 금지).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockSecure.get(k) ?? null)),
  setItemAsync: jest.fn((k: string, v: string) => {
    mockSecure.set(k, v);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((k: string) => {
    mockSecure.delete(k);
    return Promise.resolve();
  }),
}));
jest.mock('@/lib/api/client', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ newMember: false, accessToken: 'acc', refreshToken: 'ref' }),
    get: jest.fn(),
    patch: jest.fn().mockResolvedValue(undefined),
  },
  ApiError: class extends Error {},
  setAuthTokenProvider: jest.fn(),
  setOnUnauthorized: jest.fn(),
}));

import { queryClient } from '@/lib/queryClient';
import { exchangeLogin, installBeAuth, logoutBe } from '../beAuth';
import { useIsGuest, _resetSessionForTest } from '../useSession';

function Probe() {
  const guest = useIsGuest();
  return <Text testID="probe">{guest ? 'guest' : 'member'}</Text>;
}

const probeText = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.props?.testID === 'probe' && typeof n.type === 'string')[0].props.children as string;
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });

beforeEach(() => {
  _resetSessionForTest();
});
afterEach(() => {
  queryClient.clear();
});

it('⛔️ 재현: 게스트 확립(탭 마운트 유지) → 로그인 경계 → 재시작 없이 member 즉시 전환', async () => {
  mockSecure.clear();
  installBeAuth(); // 부팅 초기화(hasBeSession → 게스트 확립)
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await flush();
  expect(probeText(tree)).toBe('guest'); // 게스트 확립(세션 쿼리 false)
  await act(async () => {
    await exchangeLogin('firebase-idtoken');
  });
  await flush();
  expect(probeText(tree)).toBe('member'); // 경계 후 즉시 전환 — 고착이면 실패
  act(() => tree.unmount());
});

it('⛔️ 재현(역방향): member 확립 → 로그아웃 경계 → guest 즉시 전환', async () => {
  mockSecure.clear();
  installBeAuth();
  await act(async () => {
    await exchangeLogin('firebase-idtoken'); // 세션 확립
  });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await flush();
  expect(probeText(tree)).toBe('member');
  await act(async () => {
    await logoutBe();
  });
  await flush();
  expect(probeText(tree)).toBe('guest');
  act(() => tree.unmount());
});
