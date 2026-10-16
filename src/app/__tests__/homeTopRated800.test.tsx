/**
 * KB-800 홈 하단 = "평점 높은 음식" 행 + 스캔 CTA (구 P-317 리뷰 무한 피드 대체 — homeFeed317 삭제).
 * ① 행 N개 서버 순서 · 세부 null = 빈 별 + "—" ② 빈 배열 = 헤더 부재·CTA 존재 ③ CTA → navigate('/scan')
 * ④ 카드 탭 → home_card_click{top_rated} + 상세 이동 ⑤ 홈이 리뷰 피드 훅을 부르지 않는다(R-06)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import Home from '../(tabs)/index'; // jest.mock 은 babel 이 import 위로 끌어올린다
import type { TopRatedFood } from '@/lib/api/types';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => { const sv = { value: v, get: () => sv.value, set: (n: unknown) => { sv.value = n; } }; return sv; },
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
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
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() };
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => mockRouter,
  usePathname: () => '/',
  useFocusEffect: () => {},
  Redirect: () => null,
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
jest.mock('@/features/food/FoodExplorer', () => ({ FoodExplorer: () => null }));
const mockHome = jest.fn();
jest.mock('@/lib/data/useSelectedHomeFoods', () => ({ useSelectedHomeFoods: () => ({ data: { items: [], unavailableFoodIds: [] }, isPending: false, isError: false, error: null, refetch: jest.fn() }) }));
jest.mock('@/lib/data/useHome', () => ({ useHome: () => mockHome() }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '1', restrictions: [] } }) }));
jest.mock('@/lib/data/useNotifications', () => ({ useUnreadCount: () => 0 }));
const mockGlobalReviews = jest.fn(() => ({ data: undefined }));
jest.mock('@/lib/data/useFoodReviews', () => ({ useGlobalReviews: () => mockGlobalReviews() }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));


const food = (id: string, over: Partial<TopRatedFood> = {}): TopRatedFood => ({
  foodId: id, name: `Food ${id}`, nameKo: `음식${id}`, photoUrl: null, risk: 'safe', overall: { average: 4.7, count: 23 },
  taste: 4.7, servingSpeed: 4.4, staffKindness: 4.6, overallRating: 4.6, ...over,
});
const homeWith = (topRated: TopRatedFood[]) =>
  mockHome.mockReturnValue({ isLoading: false, isPending: false, isError: false, error: null, refetch: jest.fn(), data: { authenticated: true, recent: [], recommended: [], mostReviewed: [], topRated } });

const trees: ReactTestRenderer[] = [];
function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Home />); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => jest.clearAllMocks());

const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.type !== 'string');
const texts = (node: renderer.ReactTestInstance) => node.findAll((n) => n.props?.testID === 'top-rated-detail' && typeof n.type === 'string').map((n) => n.props.children);

it('① 행 = 서버 순서 · 총평점(리뷰 수) · 세부 null 은 "—" + 빈 별', () => {
  homeWith([food('205'), food('412', { taste: 4.0, servingSpeed: null, staffKindness: null, overallRating: 4.0, overall: { average: 4, count: 3 } })]);
  const tree = render();
  expect(byId(tree, 'home-top-rated-head').length).toBeGreaterThan(0);
  const rows = tree.root.findAll((n) => typeof n.props?.testID === 'string' && /^home-top-rated-\d+$/.test(n.props.testID) && typeof n.props.onPress === 'function');
  expect([...new Set(rows.map((r) => r.props.testID))]).toEqual(['home-top-rated-205', 'home-top-rated-412']);
  const [, second] = rows.filter((r, i, a) => a.findIndex((x) => x.props.testID === r.props.testID) === i);
  expect([...new Set(texts(second))]).toEqual(['4.0', '—']);
  expect(texts(second).filter((x) => x === '—')).toHaveLength(2); // 속도·친절도
  // 빈 별: null 줄의 Stars value = 0
  const stars = second.findAll((n) => n.props?.value !== undefined && n.props?.size === 10);
  expect(stars.map((s) => s.props.value)).toEqual([4.0, 0, 0]);
  expect(second.findAll((n) => typeof n.type === 'string' && [n.props?.children].flat().join('') === '(3)').length).toBeGreaterThan(0); // 리뷰 수
});

it('② 빈 배열 — 섹션 헤더 부재 · CTA·면책 존재', () => {
  homeWith([]);
  const tree = render();
  expect(byId(tree, 'home-top-rated-head')).toHaveLength(0);
  expect(byId(tree, 'home-scan-cta').length).toBeGreaterThan(0);
  expect(tree.root.findAll((n) => n.props?.children === 'home.disclaimer').length).toBeGreaterThan(0);
});

it('③ CTA 탭 → router.navigate(/scan)', () => {
  homeWith([food('1')]);
  const tree = render();
  const cta = tree.root.findAll((n) => n.props?.testID === 'home-scan-cta' && typeof n.props?.onPress === 'function')[0];
  act(() => cta.props.onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/scan');
});

it('④ 카드 탭 → home_card_click{section:top_rated, position, food_id} + 상세(src=home)', () => {
  homeWith([food('205'), food('412')]);
  const tree = render();
  const row = tree.root.findAll((n) => n.props?.testID === 'home-top-rated-412' && typeof n.props?.onPress === 'function')[0];
  act(() => row.props.onPress());
  expect(mockTrack).toHaveBeenCalledWith('home_card_click', { section: 'top_rated', position: 1, food_id: '412' });
  expect(mockRouter.push).toHaveBeenCalledWith('/food/412?src=home');
});

it('⑤ 홈은 리뷰 피드 훅을 부르지 않는다 · 다음 페이지 UI·onEndReached 없음 · 로딩 중 CTA 없음', () => {
  homeWith([food('1')]);
  const tree = render();
  expect(mockGlobalReviews).not.toHaveBeenCalled();
  const list = byId(tree, 'home-list')[0];
  expect(list.props.onEndReached).toBeUndefined();
  for (const id of ['home-feed-skel', 'home-feed-next-error']) expect(byId(tree, id)).toHaveLength(0);
  mockHome.mockReturnValue({ isLoading: true, isPending: true, isError: false, error: null, refetch: jest.fn(), data: undefined });
  expect(byId(render(), 'home-scan-cta')).toHaveLength(0);
});
