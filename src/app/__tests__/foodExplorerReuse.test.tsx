/**
 * KB-430 후속(9/5 예진) — FoodExplorer 공용화 잠금.
 * ① 홈·음식 탭 = 같은 컴포넌트 렌더 ② 기본 탭 차이(홈 Popular / 음식 Explore food)
 * ③ 음식 탭 무한 스크롤(onEndReached → fetchNextPage, 4장 제한 없음)
 * ④ 게스트 칩: 4개 렌더 + 개인화 칩 탭 = AuthGateSheet + 필터 미적용(All 유지).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    cancelAnimation: () => {},
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  usePathname: () => '/',
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
// 게이트 시트 = 표면 목(open 시 마커)
jest.mock('@/components/AuthGateSheet', () => {
  const { View } = require('react-native');
  return {
    AuthGateSheet: ({ open }: { open: boolean }) => (open ? <View testID="auth-gate-open" /> : null),
  };
});
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '9', restrictions: [{ kind: 'allergy', code: 'EGG' }] } }) }));
const mockBrowse = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({ useInfiniteFoods: () => mockBrowse() }));
const mockToggle = jest.fn();
jest.mock('@/lib/data/bookmarks', () => ({
  useBookmarks: () => ({ data: [], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() }),
  useToggleBookmark: () => ({ mutate: mockToggle }),
}));

import { FoodExplorer } from '@/features/food/FoodExplorer';

const FOOD = (id: string, risk: 'safe' | 'danger' = 'safe') => ({
  foodId: id, name: `Food ${id}`, nameKo: `음식 ${id}`, photoUrl: null,
  risk, overall: { average: 4, count: 2 }, popularityRank: Number(id),
});

const trees: ReactTestRenderer[] = [];
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });

const mockFetchNext = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  mockBrowse.mockReturnValue({
    data: Array.from({ length: 10 }, (_, i) => FOOD(String(i + 1), i % 2 ? 'danger' : 'safe')),
    isLoading: false, isError: false, error: null, refetch: jest.fn(),
    hasNextPage: true, isFetchingNextPage: false, fetchNextPage: mockFetchNext,
  });
});

const cardIds = (tree: ReactTestRenderer) =>
  new Set(
    tree.root
      .findAll((n) => typeof n.props?.testID === 'string' && /^home-food-\d+$/.test(n.props.testID))
      .map((n) => n.props.testID as string),
  );

const activeTab = (tree: ReactTestRenderer) => {
  // 활성 바(#2F3137)가 켜진 탭의 testID
  const tabs = tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('home-tab-'));
  return tabs.find((tab) =>
    tab.findAll((c) => {
      const st = c.props?.style;
      return Array.isArray(st) && JSON.stringify(st).includes('"backgroundColor":"#2F3137"') && JSON.stringify(st).includes('"height":2');
    }).length > 0,
  )?.props.testID;
};

it('①② 두 화면 = 같은 컴포넌트 + 소스 잠금 — 기본 탭: 홈 Popular / 음식 Explore food', () => {
  const fs = require('fs');
  // 두 화면 모두 FoodExplorer 경유(자체 검색/탭/칩/그리드 마크업 잔존 0)
  const home = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8') as string;
  const food = fs.readFileSync('src/app/(tabs)/food.tsx', 'utf8') as string;
  expect(home).toContain('<FoodExplorer variant="embedded" guest={isGuest} srcTag="home" />');
  expect(food).toContain('variant="screen"');
  expect(food).toContain('initialTab="food"');
  expect(home).not.toContain('testID="home-search"'); // 마크업은 공용 1곳
  expect(food).not.toContain('function BrowseCard'); // 구 카드 소멸(주석 언급만 허용)
  // 렌더: 기본 탭 차이
  expect(activeTab(render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />))).toBe('home-tab-popular');
  // 음식 탭 = initialTab="food"(소스 잠금 위 라인) → Explore food 활성
  expect(activeTab(render(<FoodExplorer variant="screen" guest={false} initialTab="food" srcTag="list" />))).toBe('home-tab-food');
});

it('③ 음식 탭(screen) = 4장 제한 없음 + onEndReached → fetchNextPage', () => {
  const tree = render(<FoodExplorer variant="screen" guest={false} initialTab="food" srcTag="list" />);
  // 10장 전부(임베드는 4장 슬라이스) — 고유 testID 계수(composite+host 중복 배제)
  expect(cardIds(tree).size).toBe(10);
  const list = tree.root.findAll((n) => typeof n.props?.onEndReached === 'function')[0];
  act(() => list.props.onEndReached({ distanceFromEnd: 0 }));
  expect(mockFetchNext).toHaveBeenCalledTimes(1);
});

it('③-b 홈(embedded) = 4장 제한 + More 버튼(무한 스크롤 없음)', () => {
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(cardIds(tree).size).toBe(4);
  expect(tree.root.findAll((n) => n.props?.testID === 'home-grid-more').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => typeof n.props?.onEndReached === 'function')).toHaveLength(0);
});

it('④ 게스트 칩 — 4개 렌더 · 개인화 칩 탭 = 게이트 + 선택 All 유지(필터 미적용)', () => {
  const tree = render(<FoodExplorer variant="screen" guest initialTab="food" srcTag="list" />);
  for (const c of ['all', 'safe', 'danger', 'caution']) {
    expect(tree.root.findAll((n) => n.props?.testID === `home-chip-${c}`).length).toBeGreaterThanOrEqual(1);
  }
  const before = cardIds(tree).size;
  const safe = tree.root.findAll((n) => n.props?.testID === 'home-chip-safe' && typeof n.props?.onPress === 'function')[0];
  act(() => safe.props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'auth-gate-open').length).toBeGreaterThanOrEqual(1); // 게이트
  expect(cardIds(tree).size).toBe(before); // 필터 미적용(All 유지)
});

it('④-b 회원 칩 = 현행 필터 동작(safe 선택 시 danger 카드 소멸)', () => {
  const tree = render(<FoodExplorer variant="screen" guest={false} initialTab="food" srcTag="list" />);
  const safe = tree.root.findAll((n) => n.props?.testID === 'home-chip-safe' && typeof n.props?.onPress === 'function')[0];
  act(() => safe.props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'auth-gate-open')).toHaveLength(0);
  expect([...cardIds(tree)].sort()).toEqual(['home-food-1', 'home-food-3', 'home-food-5', 'home-food-7', 'home-food-9']); // safe만
});
