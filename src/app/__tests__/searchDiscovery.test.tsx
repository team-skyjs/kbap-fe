/**
 * P-143: 검색 유도 — placeholder 시드 로테이션·빈 상태 인기 사진 섹션·상세 라우팅 잠금.
 */
import * as React from 'react';
import { FlatList, TextInput } from 'react-native';
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
  useSegments: () => ['search'],
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
jest.mock('@/lib/data/bookmarks', () => ({ useSavedIds: () => ({ ids: new Set<string>(), ready: true }),
  useBookmarks: () => ({ data: [] }),
  useToggleBookmark: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/data/useFoods', () => ({
  useFoods: () => mockUseFoods(),
  useInfiniteFoods: () => mockUseInfiniteFoods(),
  useSearchFoods: () => mockUseSearchFoods(),
}));
jest.mock('@/lib/data/useRecentSearches', () => ({
  useRecentSearches: () => ({ recent: [], add: jest.fn(), remove: jest.fn(), clear: jest.fn() }),
}));

let mockAdMounts = 0;
jest.mock('@/features/ads/AdBanner', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { AdBanner: (props: object) => {
    React.useEffect(() => { mockAdMounts += 1; }, []);
    return <View {...props} testID="search-ad-probe" />;
  } };
});

// eslint-disable-next-line import/first -- mock factories must precede the screen import
import Search from '../search';

const OK_QUERY = { isLoading: false, isError: false, error: null, refetch: jest.fn() };
const CATALOG = [
  { foodId: 'bibim', name: 'Bibimbap', nameKo: '비빔밥', photoUrl: null, risk: 'safe', overall: { average: null, count: 0 }, sameNationality: { average: null, count: 0 }, popularityRank: 2 },
  { foodId: 'kimchi', name: 'Kimchi Jjigae', nameKo: '김치찌개', photoUrl: 'https://cdn/k.jpg', risk: 'safe', overall: { average: null, count: 0 }, sameNationality: { average: null, count: 0 }, popularityRank: 1 },
];

const trees: ReactTestRenderer[] = [];
afterEach(() => { for (const tree of trees.splice(0)) act(() => tree.unmount()); });
const renderedContent = (tree: ReactTestRenderer) => tree.root.findAll((n) => typeof n.type === 'string').map((n) => `${n.props.testID ?? ''} ${typeof n.props.children === 'string' ? n.props.children : ''}`).join(' ');

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  trees.push(tree);
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMe.mockReturnValue({ ...OK_QUERY, data: { nickname: 'A', restrictions: [], rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null }, spiceTolerance: null, nationality: 'US', readerLanguage: 'en', id: '1' } });
  mockUseFoods.mockReturnValue({ ...OK_QUERY, data: undefined }); // KB-310: 화면이 더는 소비 안 함
  mockUseInfiniteFoods.mockReturnValue({ ...OK_QUERY, data: CATALOG }); // 카탈로그 = probe(라이브)
  mockUseSearchFoods.mockReturnValue({ ...OK_QUERY, data: undefined, fetchNextPage: jest.fn(), hasNextPage: false, isFetchingNextPage: false });
});

it('placeholder — 카탈로그 시드 로테이션(리더 언어 번역명), 미로드 시 기본 유지', () => {
  const tree = render(<Search />);
  const input = tree.root.findAllByType(TextInput)[0];
  // 시드 키 + 랭크 풀의 번역명 중 하나 (2종 카탈로그 — Name 값 소속 잠금)
  expect(input.props.placeholder).toMatch(/^search\.placeholderSeed:(Kimchi Jjigae|Bibimbap)$/);
  // 미로드 → 기본 placeholder
  mockUseInfiniteFoods.mockReturnValue({ ...OK_QUERY, data: undefined }); // KB-310: 미로드 = probe 데이터 부재
  const tree2 = render(<Search />);
  expect(tree2.root.findAllByType(TextInput)[0].props.placeholder).toBe('food.searchPlaceholder'); // KB-722: 홈 검색창과 한 키
});

it('빈 상태 인기 사진 섹션 — 랭크순 카드(사진 우선) + 탭 = 상세 진입(검색 실행 아님)', () => {
  const tree = render(<Search />);
  const s = renderedContent(tree);
  expect(s).toContain('search.popular');
  // 사진 보유(kimchi, rank1)가 첫 카드
  const cards = tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('pop-') && typeof n.props?.onPress === 'function');
  expect(cards.length).toBeGreaterThanOrEqual(2);
  expect(cards[0].props.testID).toBe('pop-kimchi');
  act(() => cards[0].props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/food/kimchi?src=search');
});

// KB-709(P-449 ①): result_count가 화면 결과 수의 2배로 나갔다 — 원인 = 매칭용 이름 목록(음식마다 name·nameKo 2개)의 길이를 그대로 셌다
it('KB-709 검색 계측 result_count = 화면에 보인 결과 음식 수(이름 수 아님) · 이벤트 1회', () => {
  const analytics = jest.requireActual<typeof import('@/lib/analytics')>('@/lib/analytics');
  const spy = jest.spyOn(analytics, 'track').mockImplementation(() => {});
  try {
    mockUseSearchFoods.mockReturnValue({ ...OK_QUERY, isSuccess: true, data: CATALOG, fetchNextPage: jest.fn(), hasNextPage: false, isFetchingNextPage: false }); // KB-786: 성공 검색만 계측(실 쿼리의 isSuccess)
    const tree = render(<Search />);
    const input = tree.root.findAllByType(TextInput)[0];
    act(() => input.props.onChangeText('kim'));
    act(() => input.props.onSubmitEditing());
    const shown = new Set(
      tree.root
        .findAll((n) => typeof n.type === 'string' && typeof n.props?.testID === 'string' && CATALOG.some((f) => n.props.testID.endsWith(`-${f.foodId}`)))
        .map((n) => CATALOG.find((f) => (n.props.testID as string).endsWith(`-${f.foodId}`))!.foodId),
    );
    expect(shown.size).toBe(CATALOG.length); // 화면 결과 음식 2개
    const calls = spy.mock.calls.filter(([e]) => e === analytics.EVENTS.search_query);
    expect(calls).toHaveLength(1);
    expect((calls[0][1] as { result_count: number }).result_count).toBe(shown.size); // 전엔 4(이름 4개)
  } finally {
    spy.mockRestore();
  }
});

// KB-722(P-452 ②): 결과 목록 = 서버 순서 그대로(KB-721 관련도 정렬을 그대로 수용) — 앱의 인기순·이름순 재정렬 0
it('KB-722 검색 결과 = 서버 응답 순서 그대로(popularityRank·이름과 무관)', () => {
  // 서버가 관련도로 준 순서: rank 2 → rank 1 → rank 없음 (앱이 rank/이름으로 다시 섞으면 바뀐다)
  const SERVER_ORDER = [
    { ...CATALOG[0], foodId: 'bibim' }, // rank 2
    { ...CATALOG[1], foodId: 'kimchi' }, // rank 1
    { ...CATALOG[0], foodId: 'alpha', name: 'Alpha Soup', nameKo: '알파', popularityRank: null },
  ];
  mockUseSearchFoods.mockReturnValue({ ...OK_QUERY, data: SERVER_ORDER, fetchNextPage: jest.fn(), hasNextPage: false, isFetchingNextPage: false });
  const tree = render(<Search />);
  const input = tree.root.findAllByType(TextInput)[0];
  act(() => input.props.onChangeText('a'));
  act(() => input.props.onSubmitEditing());
  const shown = tree.root
    .findAll((n) => typeof n.type === 'string' && typeof n.props?.testID === 'string' && /^home-food-/.test(n.props.testID))
    .map((n) => (n.props.testID as string).replace('home-food-', ''));
  expect(shown).toEqual(['bibim', 'kimchi', 'alpha']);
});

it('KB-798 single scrolling header keeps one ad/input across initial, loading, empty, error, results and clear', () => {
  mockAdMounts = 0;
  const tree = render(<Search />);
  const list = () => tree.root.findByType(FlatList);
  act(() => list().props.onLayout({ nativeEvent: { layout: { width: 375, height: 600 } } }));
  const input = tree.root.findAllByType(TextInput)[0];
  expect(input.props.autoFocus).toBe(true);
  const ad = () => tree.root.findAll((n) => n.props.testID === 'search-ad-probe' && typeof n.type === 'string')[0];
  expect(ad().props.content.width).toBe(335);
  expect(ad().props.content.canReveal()).toBe(true);
  const initial = renderedContent(tree);
  expect(initial.indexOf('search.recent')).toBeLessThan(initial.indexOf('search-ad-probe'));
  expect(initial.indexOf('search-ad-probe')).toBeLessThan(initial.indexOf('search.popular'));
  act(() => input.props.onChangeText('김치'));
  expect(ad().props.content.canReveal()).toBe(false);
  act(() => input.props.onSubmitEditing());
  for (const state of [
    { isLoading: true }, { data: [] }, { isError: true, error: new Error('offline') }, { data: CATALOG },
  ]) {
    mockUseSearchFoods.mockReturnValue({ ...OK_QUERY, data: [], ...state });
    act(() => tree.update(<Search />));
    expect(tree.root.findAllByType(TextInput)[0]).toBe(input);
    expect(mockAdMounts).toBe(1);
    expect(list().props.ListHeaderComponent).toBeTruthy();
    expect(renderedContent(tree)).not.toContain('search.recent');
  }
  act(() => list().props.onLayout({ nativeEvent: { layout: { width: 375, height: 250 } } }));
  expect(mockAdMounts).toBe(1);
  const clear = tree.root.findAll((n) => n.props.testID === 'search-clear' && typeof n.props.onPress === 'function')[0];
  act(() => clear.props.onPress());
  expect(renderedContent(tree)).toContain('search.recent');
  expect(mockAdMounts).toBe(1);
});
