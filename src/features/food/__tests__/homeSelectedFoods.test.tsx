/**
 * KB-712(P-448) — 홈 인기 레일(Popular + 칩 All) = `/home`의 popularFoods(서버 랜덤).
 * 전엔 `popularPhotoFoods(/foods 최신순)` 앞 10개라 음식 탭 상단과 똑같았다(예진 10/3).
 * 서버 순서 그대로(재정렬·사진 우선 재배치 금지) · 칩 선택 = 기존 서버 필터 목록 · 빈 값/부재 = 기존 폴백 · 로딩 = 스켈레톤.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    useReducedMotion: () => false,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('react-native-svg', () => {
  const R = jest.requireActual('react') as typeof import('react');
  const mk = (name: string) => (props: Record<string, unknown>) => R.createElement(name, props, props.children as never);
  return { __esModule: true, default: mk('Svg'), Svg: mk('Svg'), Path: mk('Path'), Rect: mk('Rect'), Defs: mk('Defs'), ClipPath: mk('ClipPath'), Circle: mk('Circle'), G: mk('G'), Line: mk('Line'), Polyline: mk('Polyline') };
});
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
  useSegments: () => ['(tabs)'],
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const FOOD = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  foodId: id,
  name,
  nameKo: name,
  photoUrl: null,
  risk: 'safe' as const,
  overall: { average: 4.5, count: 12 },
  ...extra,
});

jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '1', restrictions: [{ code: 'SOY' }] } }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
const mockInfinite = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({
  useInfiniteFoods: (...args: unknown[]) => mockInfinite(...args),
  useSearchFoods: () => ({ data: [] }),
  useScannedFoods: () => ({ data: [] }),
  useFoodDetail: () => ({ data: undefined }),
}));
jest.mock('@/lib/data/bookmarks', () => ({
  useBookmarks: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: jest.fn(), hasNextPage: false, fetchNextPage: jest.fn(), isFetchingNextPage: false }),
  useSavedIds: () => ({ ids: new Set<string>(), ready: true }),
  useToggleBookmark: () => ({ mutate: jest.fn() }),
}));

// eslint-disable-next-line import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례
import { FoodExplorer } from '../FoodExplorer';

const render = (el: React.ReactElement): ReactTestRenderer => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(el); });
  return t;
};
const host = (t: ReactTestRenderer, pred: (id: string) => boolean) =>
  t.root.findAll((n) => typeof n.type === 'string' && typeof n.props?.testID === 'string' && pred(n.props.testID));
/** 레일(가로 ScrollView) 안 카드 순서 */
const railOrder = (t: ReactTestRenderer) => {
  const rail = t.root.findAll((n) => typeof n.type === 'string' && n.props?.testID === 'home-rail')[0];
  if (!rail) return [];
  return rail.findAll((n) => typeof n.type === 'string' && /^home-food-/.test(n.props?.testID ?? '')).map((n) => (n.props.testID as string).replace('home-food-', ''));
};
const list = (data: unknown[], extra: Record<string, unknown> = {}) => ({ data, isLoading: false, isError: false, error: null, refetch: jest.fn(), hasNextPage: false, fetchNextPage: jest.fn(), isFetchingNextPage: false, isFetching: false, dataUpdatedAt: 1, ...extra });

// /foods 최신순(옛 소스): 사진 있는 것이 앞으로 재배치되던 목록
const LATEST = [FOOD('1', 'Latest A', { photoUrl: 'https://cdn/a.jpg' }), FOOD('2', 'Latest B'), FOOD('3', 'Latest C', { photoUrl: 'https://cdn/c.jpg' })];
// /home popularFoods(서버 랜덤 순) — 사진 없는 것이 앞에 와도 그대로


beforeEach(() => {
  jest.clearAllMocks();
  mockInfinite.mockReturnValue(list(LATEST));
});


it('selected filters stay within the selected IDs, preserve order and never drain browse', () => {
  const next = jest.fn();
  mockInfinite.mockReturnValue(list(LATEST, { hasNextPage: true, fetchNextPage: next }));
  const selected = [FOOD('444', 'Crab', { risk: 'danger' }), FOOD('743', 'Chicken'), FOOD('445', 'Other crab', { risk: 'danger' }), FOOD('300', 'Unknown', { risk: 'unable' })];
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" selectedPopular popular={selected} />);
  expect(railOrder(tree)).toEqual(['444', '743', '445', '300']);
  act(() => tree.root.findAll((n) => n.props.testID === 'home-chip-danger' && typeof n.props.onPress === 'function')[0].props.onPress());
  expect(railOrder(tree)).toEqual(['444', '445']);
  expect(mockInfinite).toHaveBeenLastCalledWith('all', { enabled: false });
  expect(next).not.toHaveBeenCalled();
  act(() => tree.root.findAll((n) => n.props.testID === 'home-chip-caution' && typeof n.props.onPress === 'function')[0].props.onPress());
  expect(railOrder(tree)).toEqual([]);
  expect(host(tree, (id) => id === 'home-rail-filter-empty')).toHaveLength(1);
  expect(next).not.toHaveBeenCalled();
  act(() => tree.root.findAll((n) => n.props.testID === 'home-chip-all' && typeof n.props.onPress === 'function')[0].props.onPress());
  expect(railOrder(tree)).toEqual(['444', '743', '445', '300']);
  expect(mockInfinite).toHaveBeenLastCalledWith('all', { enabled: true }); // Safe picks still has its first page.
  act(() => tree.unmount());
});
it('selected loading/error/empty never fall back to dynamic food cards', () => {
  const retry = jest.fn();
  const tree = render(<FoodExplorer variant="embedded" guest srcTag="home" selectedPopular popularLoading />);
  expect(railOrder(tree)).toEqual([]);
  expect(host(tree, (id) => id === 'home-rail-skel')).toHaveLength(1);
  act(() => tree.update(<FoodExplorer variant="embedded" guest srcTag="home" selectedPopular popularError={new Error('Unavailable')} onPopularRetry={retry} />));
  expect(railOrder(tree)).toEqual([]);
  expect(host(tree, (id) => id === 'food-grid-error')).toHaveLength(1);
  expect(mockInfinite).toHaveBeenLastCalledWith('all', { enabled: false });
  act(() => tree.unmount());
});
