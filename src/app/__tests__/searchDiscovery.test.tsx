/**
 * P-143: 검색 유도 — placeholder 시드 로테이션·빈 상태 인기 사진 섹션·상세 라우팅 잠금.
 */
import * as React from 'react';
import { TextInput } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
    return b;
  };
  return {
    __esModule: true,
    withSpring: (v: unknown) => v,
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    SlideInDown: chain(),
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ZoomIn: chain(),
    ZoomOut: chain(),
    FadeInDown: chain(),
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.name ? `${k}:${String(o.name)}` : k), i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({ useMe: () => mockUseMe() }));
const mockUseFoods = jest.fn();
const mockUseInfiniteFoods = jest.fn();
const mockUseSearchFoods = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({
  useFoods: () => mockUseFoods(),
  useInfiniteFoods: () => mockUseInfiniteFoods(),
  useSearchFoods: () => mockUseSearchFoods(),
}));
jest.mock('@/lib/data/useRecentSearches', () => ({
  useRecentSearches: () => ({ recent: [], add: jest.fn(), remove: jest.fn(), clear: jest.fn() }),
}));

import Search from '../search';

const OK_QUERY = { isLoading: false, isError: false, error: null, refetch: jest.fn() };
const CATALOG = [
  { foodId: 'bibim', name: 'Bibimbap', nameKo: '비빔밥', photoUrl: null, risk: 'safe', overall: { average: null, count: 0 }, sameNationality: { average: null, count: 0 }, popularityRank: 2 },
  { foodId: 'kimchi', name: 'Kimchi Jjigae', nameKo: '김치찌개', photoUrl: 'https://cdn/k.jpg', risk: 'safe', overall: { average: null, count: 0 }, sameNationality: { average: null, count: 0 }, popularityRank: 1 },
];

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMe.mockReturnValue({ ...OK_QUERY, data: { nickname: 'A', restrictions: [], rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null }, spiceTolerance: null, nationality: 'US', readerLanguage: 'en', id: '1' } });
  mockUseFoods.mockReturnValue({ ...OK_QUERY, data: CATALOG });
  mockUseInfiniteFoods.mockReturnValue({ ...OK_QUERY, data: undefined });
  mockUseSearchFoods.mockReturnValue({ ...OK_QUERY, data: undefined, fetchNextPage: jest.fn(), hasNextPage: false, isFetchingNextPage: false });
});

it('placeholder — 카탈로그 시드 로테이션(리더 언어 번역명), 미로드 시 기본 유지', () => {
  const tree = render(<Search />);
  const input = tree.root.findAllByType(TextInput)[0];
  // 시드 키 + 랭크 풀의 번역명 중 하나 (2종 카탈로그 — Name 값 소속 잠금)
  expect(input.props.placeholder).toMatch(/^search\.placeholderSeed:(Kimchi Jjigae|Bibimbap)$/);
  // 미로드 → 기본 placeholder
  mockUseFoods.mockReturnValue({ ...OK_QUERY, data: undefined });
  const tree2 = render(<Search />);
  expect(tree2.root.findAllByType(TextInput)[0].props.placeholder).toBe('search.placeholder');
});

it('빈 상태 인기 사진 섹션 — 랭크순 카드(사진 우선) + 탭 = 상세 진입(검색 실행 아님)', () => {
  const tree = render(<Search />);
  const s = JSON.stringify(tree.toJSON());
  expect(s).toContain('search.popular');
  // 사진 보유(kimchi, rank1)가 첫 카드
  const cards = tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('pop-') && typeof n.props?.onPress === 'function');
  expect(cards.length).toBeGreaterThanOrEqual(2);
  expect(cards[0].props.testID).toBe('pop-kimchi');
  act(() => cards[0].props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/food/kimchi?src=search');
});
