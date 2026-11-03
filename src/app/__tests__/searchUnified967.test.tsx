/**
 * KB-967(P-580) 통합 검색 — 결과 칩 All / Dishes / Packaged.
 *  - All = 섹션별 4개 · See all = 그 칩으로(화면 이동 없음) · 첫 페이지가 많은 쪽 위(동률 Dishes)
 *  - 0건 섹션 숨김 · 둘 다 0건 = 기존 빈 상태 · 한쪽 실패 = 그 섹션만 다시 시도
 *  - processedFoodEnabled off = 칩·가공식품 요청 없음(현행) · search_query에 segment
 */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable import/first -- jest.mock 뒤 */
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
jest.mock('@/lib/data/bookmarks', () => ({ useSavedIds: () => ({ ids: new Set<string>(), ready: true }),
  useBookmarks: () => ({ data: [] }),
  useToggleBookmark: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/data/useFoods', () => ({
  FOODS_PAGE_SIZE: 20,
  useFoods: () => mockUseFoods(),
  useInfiniteFoods: () => mockUseInfiniteFoods(),
  useSearchFoods: () => mockUseSearchFoods(),
}));
const mockPkg = jest.fn();
jest.mock('@/lib/data/useProcessedFoods', () => ({
  ...jest.requireActual('@/lib/data/useProcessedFoods'),
  useProcessedSearchPaged: (...a: unknown[]) => mockPkg(...a),
  useProcessedSearch: () => ({ isSuccess: false, data: [] }),
  useVerdictKey: () => 'en|member:',
}));
const mockRecent = jest.fn();
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
jest.mock('@/lib/airbridge', () => ({ airbridge: { searchResults: jest.fn() } }));
jest.mock('@/lib/data/useRecentSearches', () => ({ useRecentSearches: () => mockRecent() }));

import Search from '../search';

const { FLAGS } = jest.requireActual('@/lib/flags') as { FLAGS: { processedFoodEnabled: boolean } };
const prevFlag = FLAGS.processedFoodEnabled;
afterEach(() => { FLAGS.processedFoodEnabled = prevFlag; });

const OK = { isLoading: false, isPending: false, isError: false, isSuccess: true, error: null, refetch: jest.fn() };
const PAGED = { fetchNextPage: jest.fn(), hasNextPage: false, isFetchingNextPage: false };
const food = (i: number) => ({ foodId: `f${i}`, name: `Dish ${i}`, nameKo: `음식${i}`, photoUrl: null, risk: 'safe', overall: { average: null, count: 0 } });
const product = (i: number) => ({ id: `p${i}`, name: `Snack ${i}`, nameKo: null, maker: null, foodType: null, type: null, imageUrl: null, verdict: null, rating: null });
const foods = (n: number) => Array.from({ length: n }, (_, i) => food(i + 1));
const products = (n: number) => Array.from({ length: n }, (_, i) => product(i + 1));
const pkgOk = (n: number, more = false) => ({ ...OK, ...PAGED, hasNextPage: more, data: { items: products(n), pageSizes: [n] } });

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Search />); });
  return tree;
}
const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.type !== 'string');
const idsWith = (tree: ReactTestRenderer, prefix: string) =>
  [...new Set(tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith(prefix)).map((n) => n.props.testID as string))];
const submit = (tree: ReactTestRenderer, term = 'kimchi') => {
  const input = tree.root.findByType(TextInput);
  act(() => { input.props.onChangeText(term); });
  act(() => { input.props.onSubmitEditing(); });
};
const press = (tree: ReactTestRenderer, id: string) => act(() => { byId(tree, id)[0].props.onPress(); });
const sectionOrder = (tree: ReactTestRenderer) => idsWith(tree, 'search-section-');

beforeEach(() => {
  jest.clearAllMocks();
  FLAGS.processedFoodEnabled = true;
  mockUseMe.mockReturnValue({ ...OK, data: { nickname: 'A', restrictions: [], id: '1' } });
  mockUseFoods.mockReturnValue({ ...OK, data: undefined });
  mockUseInfiniteFoods.mockReturnValue({ ...OK, ...PAGED, data: [] });
  mockUseSearchFoods.mockReturnValue({ ...OK, ...PAGED, hasNextPage: true, data: foods(6) });
  mockPkg.mockReturnValue(pkgOk(5));
  mockRecent.mockReturnValue({ recent: [], add: jest.fn(), remove: jest.fn(), clear: jest.fn() });
});

describe('KB-967 All', () => {
  it('칩 3개(기본 All) · 섹션별 4개만 · 가공식품 검색은 제출한 검색어로', () => {
    const tree = render();
    expect(byId(tree, 'search-segments')).toHaveLength(0); // 검색 전 화면 = 현행(칩 없음)
    submit(tree);
    expect(idsWith(tree, 'search-seg-')).toEqual(['search-seg-all', 'search-seg-dishes', 'search-seg-packaged']);
    expect(byId(tree, 'search-seg-all')[0].props.selected).toBe(true);
    expect(idsWith(tree, 'home-food-')).toHaveLength(4);
    expect(idsWith(tree, 'packaged-item-')).toHaveLength(4);
    expect(mockPkg).toHaveBeenLastCalledWith('kimchi', {}, true);
  });

  it('See all = 그 칩으로 전환(화면 이동 없음) — Dishes 전체 목록 · Packaged 전체 목록', () => {
    const tree = render();
    submit(tree);
    press(tree, 'search-see-all-dishes');
    expect(byId(tree, 'search-seg-dishes')[0].props.selected).toBe(true);
    expect(sectionOrder(tree)).toEqual([]);
    expect(idsWith(tree, 'home-food-')).toHaveLength(6);
    expect(idsWith(tree, 'packaged-item-')).toHaveLength(0);
    press(tree, 'search-seg-all');
    press(tree, 'search-see-all-packaged');
    expect(byId(tree, 'search-seg-packaged')[0].props.selected).toBe(true);
    expect(idsWith(tree, 'packaged-item-')).toHaveLength(5);
    expect(idsWith(tree, 'home-food-')).toHaveLength(0);
  });

  it('See all은 더 있을 때만(4개 이하·다음 페이지 없음 = 없음)', () => {
    mockUseSearchFoods.mockReturnValue({ ...OK, ...PAGED, data: foods(3) });
    mockPkg.mockReturnValue(pkgOk(2, true));
    const tree = render();
    submit(tree);
    expect(byId(tree, 'search-see-all-dishes')).toHaveLength(0);
    expect(byId(tree, 'search-see-all-packaged').length).toBeGreaterThan(0);
  });

  it('섹션 순서 = 첫 페이지가 많은 쪽 위 · 동률 = Dishes 위', () => {
    mockPkg.mockReturnValue(pkgOk(8));
    const tree = render();
    submit(tree);
    expect(sectionOrder(tree)).toEqual(['search-section-packaged', 'search-section-dishes']);
    mockPkg.mockReturnValue(pkgOk(6));
    act(() => tree.update(<Search />));
    expect(sectionOrder(tree)).toEqual(['search-section-dishes', 'search-section-packaged']);
  });

  it('0건 섹션 숨김 · 둘 다 0건 = 기존 빈 상태(칩은 보임)', () => {
    mockUseSearchFoods.mockReturnValue({ ...OK, ...PAGED, data: [] });
    const tree = render();
    submit(tree);
    expect(sectionOrder(tree)).toEqual(['search-section-packaged']);
    expect(byId(tree, 'search-empty')).toHaveLength(0);
    mockPkg.mockReturnValue(pkgOk(0));
    act(() => tree.update(<Search />));
    expect(sectionOrder(tree)).toEqual([]);
    expect(byId(tree, 'search-empty').length).toBeGreaterThan(0);
    expect(byId(tree, 'search-segments').length).toBeGreaterThan(0);
  });

  it('한쪽 실패 = 그 섹션만 다시 시도, 다른 섹션은 그대로 · 로딩 = 섹션 스켈레톤', () => {
    const refetch = jest.fn();
    mockPkg.mockReturnValue({ ...OK, ...PAGED, isSuccess: false, isError: true, error: new Error('HTTP 500'), refetch, data: undefined });
    const tree = render();
    submit(tree);
    const pkgSection = byId(tree, 'search-section-packaged')[0];
    expect(pkgSection.findAll((n) => n.props?.children === 'states.errorTitle').length).toBeGreaterThan(0);
    expect(idsWith(tree, 'home-food-')).toHaveLength(4);
    mockPkg.mockReturnValue({ ...OK, ...PAGED, isSuccess: false, isPending: true, data: undefined });
    mockUseSearchFoods.mockReturnValue({ ...OK, ...PAGED, isSuccess: false, isPending: true, isLoading: true, data: undefined });
    act(() => tree.update(<Search />));
    expect(byId(tree, 'search-packaged-skeleton').length).toBeGreaterThan(0);
    expect(byId(tree, 'skeleton-food-grid').length).toBeGreaterThan(0);
  });
});

describe('KB-967 칩 목록', () => {
  it('Packaged 칩 = 무한스크롤(목록 끝 = 가공식품 다음 페이지)', () => {
    const next = jest.fn();
    mockPkg.mockReturnValue({ ...pkgOk(5, true), fetchNextPage: next });
    const tree = render();
    submit(tree);
    press(tree, 'search-seg-packaged');
    act(() => { byId(tree, 'search-body')[0].props.onEndReached(); });
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('KB-967 플래그 off · 계측', () => {
  it('processedFoodEnabled off = 칩·Packaged 없음 · 가공식품 요청 꺼짐 · 음식 결과 그대로', () => {
    FLAGS.processedFoodEnabled = false;
    const tree = render();
    submit(tree);
    expect(byId(tree, 'search-segments')).toHaveLength(0);
    expect(sectionOrder(tree)).toEqual([]);
    expect(idsWith(tree, 'packaged-item-')).toHaveLength(0);
    expect(idsWith(tree, 'home-food-')).toHaveLength(6);
    expect(mockPkg).toHaveBeenLastCalledWith('kimchi', {}, false);
  });

  it('search_query에 segment(켜짐 = 칩 값 · 꺼짐 = dishes)', () => {
    let tree = render();
    submit(tree);
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'search_query').at(-1)?.[1]).toMatchObject({ segment: 'all' });
    act(() => tree.unmount());
    FLAGS.processedFoodEnabled = false;
    tree = render();
    submit(tree);
    expect(mockTrack.mock.calls.filter((c) => c[0] === 'search_query').at(-1)?.[1]).toMatchObject({ segment: 'dishes' });
  });
});
