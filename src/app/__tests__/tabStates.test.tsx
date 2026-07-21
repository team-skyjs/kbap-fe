/**
 * P-007(KB-174) false-empty 제거 잠금 — 7/20 BE 장애 회귀.
 * 에러인데 빈 상태("아직 스캔이 없어요")로 위장하거나 백지가 되면 안 된다:
 * 탭별로 [에러 → J3 렌더 + 빈 상태 미렌더]를 단언하고, 빈 상태는 성공+0건일
 * 때만 렌더됨을 홈에서 잠근다. NETWORK 프리픽스는 J4(오프라인)로 분기.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// guestListBadges.test 프렐류드 재사용 — reanimated/expo 표면 mock
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
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));

const mockUseHome = jest.fn();
jest.mock('@/lib/data/useHome', () => ({ useHome: () => mockUseHome() }));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => mockUseMe(),
  useMyReviews: () => ({ data: [] }),
  useUpdateMe: () => ({ mutate: jest.fn() }),
}));
const mockUseInfiniteFoods = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({
  useInfiniteFoods: () => mockUseInfiniteFoods(),
  useFoods: () => ({ data: [] }),
}));
jest.mock('@/lib/data/bookmarks', () => ({ useBookmarks: () => ({ data: [] }) }));

import Home from '../(tabs)/index';
import Food from '../(tabs)/food';
import Profile from '../(tabs)/profile';
import { SkeletonHome, SkeletonFoodGrid, SkeletonProfile } from '@/components/Skeleton';

const OK_QUERY = { isLoading: false, isError: false, error: null, refetch: jest.fn() };
const ERR_500 = { ...OK_QUERY, isError: true, error: new Error('HTTP 500') };
const ERR_NET = { ...OK_QUERY, isError: true, error: new Error('NETWORK: request failed') };
const FOODS_EXTRA = { fetchNextPage: jest.fn(), hasNextPage: false, isFetchingNextPage: false };

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
  mockUseHome.mockReturnValue({ ...OK_QUERY, data: { authenticated: true, recent: [], recommended: [], avoided: [] } });
  mockUseInfiniteFoods.mockReturnValue({ ...OK_QUERY, ...FOODS_EXTRA, data: [] });
});

it('홈: 에러 → J3 렌더, "아직 스캔이 없어요"(빈 상태) 미렌더 — false-empty 잠금', () => {
  mockUseHome.mockReturnValue({ ...ERR_500, data: undefined });
  const tree = render(<Home />);
  expect(texts(tree, 'states.errorTitle')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'home.emptyTitle')).toBe(0);
});

it('홈: 성공 + 진짜 0건 → 빈 상태 렌더 (빈 상태는 성공일 때만)', () => {
  const tree = render(<Home />);
  expect(texts(tree, 'home.emptyTitle')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'states.errorTitle')).toBe(0);
});

it('홈: NETWORK 에러 → J4 오프라인 렌더 (JS-only 분류)', () => {
  mockUseHome.mockReturnValue({ ...ERR_NET, data: undefined });
  const tree = render(<Home />);
  expect(texts(tree, 'states.offlineTitle')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'states.errorTitle')).toBe(0);
});

it('음식 탭: 에러 → J3 렌더 (Try again 배선)', () => {
  mockUseInfiniteFoods.mockReturnValue({ ...ERR_500, ...FOODS_EXTRA, data: undefined });
  const tree = render(<Food />);
  expect(texts(tree, 'states.errorTitle')).toBeGreaterThanOrEqual(1);
});

// P-027(KB-174 후속): 에러/오프라인 시 헤더(제목·검색바) 미렌더 — 전체화면 에러
it('음식 탭: 에러 → 헤더(제목·검색바) 미렌더, 정상 → 렌더', () => {
  mockUseInfiniteFoods.mockReturnValue({ ...ERR_500, ...FOODS_EXTRA, data: undefined });
  const errTree = render(<Food />);
  expect(texts(errTree, 'food.title')).toBe(0);
  expect(texts(errTree, 'food.searchPlaceholder')).toBe(0);

  mockUseInfiniteFoods.mockReturnValue({ ...OK_QUERY, ...FOODS_EXTRA, data: [] });
  const okTree = render(<Food />);
  expect(texts(okTree, 'food.title')).toBeGreaterThanOrEqual(1); // 정상은 헤더 유지
});

it('프로필 탭: 에러 → J3 렌더, 백지 아님', () => {
  mockUseMe.mockReturnValue({ ...ERR_500, data: undefined });
  const tree = render(<Profile />);
  expect(texts(tree, 'states.errorTitle')).toBeGreaterThanOrEqual(1);
});

// P-009: 스켈레톤은 그 화면의 레이아웃 미러 변형이어야 함 — 탭별 변형 렌더를 잠근다
it('프로필 탭: 로딩 → 프로필 전용 스켈레톤 (백지 제거, 레이아웃 미러)', () => {
  mockUseMe.mockReturnValue({ ...OK_QUERY, isLoading: true, data: undefined });
  const tree = render(<Profile />);
  expect(texts(tree, 'states.errorTitle')).toBe(0);
  expect(tree.root.findAllByType(SkeletonProfile).length).toBe(1);
  expect(texts(tree, 'profile.nicknameUnset')).toBe(0); // 본문 미렌더
});

it('홈: 로딩 → 홈 전용 스켈레톤', () => {
  mockUseHome.mockReturnValue({ ...OK_QUERY, isLoading: true, data: undefined });
  const tree = render(<Home />);
  expect(tree.root.findAllByType(SkeletonHome).length).toBe(1);
  expect(texts(tree, 'home.emptyTitle')).toBe(0);
});

it('음식 탭: 로딩 → 2열 그리드 스켈레톤', () => {
  mockUseInfiniteFoods.mockReturnValue({ ...OK_QUERY, ...FOODS_EXTRA, isLoading: true, data: undefined });
  const tree = render(<Food />);
  expect(tree.root.findAllByType(SkeletonFoodGrid).length).toBe(1);
});
