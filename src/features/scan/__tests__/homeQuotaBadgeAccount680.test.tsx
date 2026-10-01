/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-680 계정 생애주기(CLAUDE.md 상비 규칙 · 공부 #221 메모 ①) — 실제 useMe(react-query) + 실제 세션 스토어(useSession).
 * 목은 네트워크(api.get = 현재 계정 프로필)와 토큰 확인(hasBeSession = 세션 스토어 값)만.
 * "A(숫자) → 로그아웃 → B(해금) 로그인"·"A → B 직행"에서 폭죽이 터지면 안 된다(남의 해금을 내 축하로 보임).
 */
import * as React from 'react';
import { AccessibilityInfo } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (f: () => unknown) => f(),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (cb: () => (() => void) | void) => {
    const { useEffect } = jest.requireActual('react') as typeof import('react');
    useEffect(cb, [cb]);
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/app/community/compose', () => ({ TagPickerSheet: () => null }));
jest.mock('@/lib/sentry', () => ({ setSentryUser: () => {}, reportProfileContractDrift: () => {} }));
let mockWire: Record<string, unknown> = {};
jest.mock('@/lib/api/client', () => ({ api: { get: () => Promise.resolve(mockWire) }, apiLang: () => 'en' }));
jest.mock('@/lib/auth/beAuth', () => ({
  hasBeSession: () => Promise.resolve((require('@/lib/auth/useSession') as typeof import('@/lib/auth/useSession')).getSessionState() === true),
}));
jest.mock('@/lib/flags', () => {
  const a = jest.requireActual('@/lib/flags') as { FLAGS: Record<string, unknown> };
  return { ...a, FLAGS: { ...a.FLAGS, countdownBadge: true } };
});

import { HomeQuotaBadge } from '../HomeQuotaBadge';
import { setSessionState, _resetSessionForTest } from '@/lib/auth/useSession';

const profile = (memberId: number, quota: { unlocked: boolean; remaining: number | null }) => ({
  memberId,
  nickname: `m${memberId}`,
  avoidanceSubstanceCodes: [],
  countryCode: 'US',
  appLanguage: 'en',
  onboardingCompleted: true,
  ranking: { tier: 'BRONZE', level: 1, score: 0 },
  scanCount: 2,
  freeScanLimit: 3,
  scanUnlocked: quota.unlocked,
  scanRemaining: quota.remaining,
});
const A_ONE_LEFT = profile(1, { unlocked: false, remaining: 1 });
const A_UNLOCKED = profile(1, { unlocked: true, remaining: null });
const B_UNLOCKED = profile(2, { unlocked: true, remaining: null });

let qc: QueryClient;
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 20)))); // react-query 알림 = setTimeout 배치
const refetchMe = async () => {
  await act(async () => void (await qc.invalidateQueries({ queryKey: ["me"] })));
  await flush();
};
const shown = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'home-quota-badge' && typeof n.type !== 'string').length > 0;

async function mount(): Promise<ReactTestRenderer> {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let t!: ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <QueryClientProvider client={qc}>
        <HomeQuotaBadge />
      </QueryClientProvider>,
    );
  });
  await flush();
  await flush();
  return t;
}

beforeEach(() => {
  _resetSessionForTest();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

it('양성 대조 — 같은 회원 A가 해금되면 폭죽(축하 중 = 뱃지 유지)', async () => {
  setSessionState(true);
  mockWire = A_ONE_LEFT;
  const t = await mount();
  expect(shown(t)).toBe(true);
  mockWire = A_UNLOCKED;
  await refetchMe();
  expect(shown(t)).toBe(true); // 축하 중
});

it('A(1회 남음) → 로그아웃 → B(해금) 로그인 = 축하 없음 · 뱃지 없음', async () => {
  setSessionState(true);
  mockWire = A_ONE_LEFT;
  const t = await mount();
  expect(shown(t)).toBe(true);
  act(() => setSessionState(false)); // 로그아웃 — 게스트
  await refetchMe(); // 게스트 = MOCK_USER(쿼터 없음)
  expect(shown(t)).toBe(false);
  mockWire = B_UNLOCKED;
  act(() => setSessionState(true));
  await refetchMe();
  expect(shown(t)).toBe(false);
});

it('A(1회 남음) → B(해금) 직행(게스트 렌더 없이 프로필만 교체 — 계정 전환 애플↔구글) = 축하 없음', async () => {
  setSessionState(true);
  mockWire = A_ONE_LEFT;
  const t = await mount();
  expect(shown(t)).toBe(true);
  mockWire = B_UNLOCKED;
  await refetchMe();
  expect(shown(t)).toBe(false);
});
