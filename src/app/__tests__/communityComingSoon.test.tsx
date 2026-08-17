/**
 * P-113(KB-280, Q-27 반려): 목 숨김 = 탭 유지 + coming-soon —
 * 탭바는 플래그 무관 5슬롯(4탭+FAB), 커뮤니티 화면은 off면 플레이스홀더/on이면 실피드.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/flags', () => ({
  FLAGS: { communityEnabled: false, reviewsEnabled: true },
  isProdChannel: () => true,
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockFlags = (jest.requireMock('@/lib/flags') as { FLAGS: { communityEnabled: boolean } }).FLAGS;
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    withSpring: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    withTiming: (v: unknown) => v,
    cancelAnimation: () => {},
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: () => {},
  usePathname: () => '/community',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));

import Community from '../(tabs)/community';
import { TabBar } from '@/components/TabBar';

function render(el: React.ReactElement): ReactTestRenderer {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
  });
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.type === 'Text').map((n) => String(n.props.children));

it('off(prod 채널) → coming-soon 플레이스홀더 (실피드 미렌더)', () => {
  mockFlags.communityEnabled = false;
  const tree = render(<Community />);
  const all = texts(tree);
  expect(all).toContain('community.lockedTitle');
  expect(all).toContain('community.lockedBody');
  expect(all).not.toContain('community.title'); // 실피드 헤더 없음
});

it('on(dev·teamtest) → 실화면 (플레이스홀더 없음)', () => {
  mockFlags.communityEnabled = true;
  const tree = render(<Community />);
  const all = texts(tree);
  expect(all).toContain('tabs.community'); // P-225: 실피드 헤더 = 탭 라벨 키(Reviews)
  expect(all).not.toContain('community.lockedTitle');
});

it('탭바 — 플래그 무관 4탭+스캔 5슬롯 (P-110 탭 제거 폐기)', () => {
  mockFlags.communityEnabled = false;
  const labels = { home: 'H', food: 'F', scan: 'S', community: 'C', profile: 'P' };
  const tree = render(<TabBar active="home" labels={labels} onPress={jest.fn()} onScan={jest.fn()} />);
  const shown = texts(tree);
  for (const l of ['H', 'F', 'S', 'C', 'P']) expect(shown).toContain(l);
});
