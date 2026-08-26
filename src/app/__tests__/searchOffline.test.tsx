/**
 * P-028(KB-174 후속): 검색 화면 오프라인 = 전체화면 J4 잠금.
 * empty 상태(최근+인기)는 로컬·mock이라 스스로 에러가 안 남 → 음식탭과 캐시를
 * 공유하는 useInfiniteFoods 프로브의 NETWORK 에러가 오프라인 신호다.
 *  - 오프라인 → J4 렌더 + 최근/인기 미렌더
 *  - 온라인 → 기존 empty 상태 그대로 (변경 금지 — 예진 명시)
 *  - 서버 J3(500) → empty 유지 (로컬 콘텐츠를 서버 장애가 가릴 이유 없음)
 *  - 제출 검색 NETWORK 에러 → J4 (재량 항목: StateBlock → QueryErrorBlock 톤 통일)
 */
import * as React from 'react';
import { TextInput } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// tabStates.test 프렐류드 재사용 — reanimated/expo 표면 mock
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
jest.mock('expo-router', () => ({
  useSegments: () => [], // P-214: 계측 화면 식별(StateBlock·HelpfulButton)
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
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
const mockRecent = jest.fn();
jest.mock('@/lib/data/useRecentSearches', () => ({ useRecentSearches: () => mockRecent() }));

import Search from '../search';

const OK_QUERY = { isLoading: false, isError: false, error: null, refetch: jest.fn() };
const ERR_500 = { ...OK_QUERY, isError: true, error: new Error('HTTP 500') };
const ERR_NET = { ...OK_QUERY, isError: true, error: new Error('NETWORK: request failed') };
const PAGED = { fetchNextPage: jest.fn(), hasNextPage: false, isFetchingNextPage: false };
const POPULAR = [
  { foodId: 'kimchi', name: 'Kimchi', nameKo: '김치', photoUrl: null, risk: 'safe', overall: { average: null, count: 0 }, popularityRank: 1 },
];

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const texts = (tree: ReactTestRenderer, s: string) => tree.root.findAll((n) => n.props?.children === s).length;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMe.mockReturnValue({ ...OK_QUERY, data: { nickname: 'A', restrictions: [], rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null }, spiceTolerance: null, nationality: 'US', readerLanguage: 'en', id: '1' } });
  mockUseFoods.mockReturnValue({ ...OK_QUERY, data: undefined }); // KB-310: 화면이 더는 소비 안 함
  mockUseInfiniteFoods.mockReturnValue({ ...OK_QUERY, ...PAGED, data: POPULAR }); // 카탈로그 = probe(라이브)
  mockUseSearchFoods.mockReturnValue({ ...OK_QUERY, ...PAGED, data: [] });
  mockRecent.mockReturnValue({ recent: ['bibimbap'], add: jest.fn(), remove: jest.fn(), clear: jest.fn() });
});

it('오프라인(프로브 NETWORK) → 전체화면 J4, 최근/인기 미렌더', () => {
  mockUseInfiniteFoods.mockReturnValue({ ...ERR_NET, ...PAGED, data: undefined });
  const tree = render(<Search />);
  expect(texts(tree, 'states.offlineTitle')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'search.recent')).toBe(0);
  expect(texts(tree, 'search.popular')).toBe(0);
});

it('온라인 → 기존 empty 상태 그대로 (최근+인기), J4 미렌더 — 변경 금지 잠금', () => {
  const tree = render(<Search />);
  expect(texts(tree, 'search.recent')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'search.popular')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'bibimbap')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'Kimchi')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'states.offlineTitle')).toBe(0);
});

it('서버 장애(프로브 500, J3) → empty 유지 — 로컬 최근/인기를 가리지 않는다', () => {
  mockUseInfiniteFoods.mockReturnValue({ ...ERR_500, ...PAGED, data: undefined });
  const tree = render(<Search />);
  expect(texts(tree, 'search.recent')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'states.errorTitle')).toBe(0);
  expect(texts(tree, 'states.offlineTitle')).toBe(0);
});

it('제출 검색 NETWORK 에러 → J4 (StateBlock→QueryErrorBlock 톤 통일)', () => {
  mockUseSearchFoods.mockReturnValue({ ...ERR_NET, ...PAGED, data: undefined });
  const tree = render(<Search />);
  const input = tree.root.findByType(TextInput);
  act(() => {
    input.props.onChangeText('kimchi');
  });
  act(() => {
    input.props.onSubmitEditing();
  });
  expect(texts(tree, 'states.offlineTitle')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'search.recent')).toBe(0);
});
