/**
 * P-393(KB-580) — 홈 "리뷰 많은 음식" 가로 레일.
 *
 * 게스트·회원 공통. **Rated safe for you와 같은 2×2 그리드**(9/18 예진 원문 — 발주문의 "가로 레일"은
 * 오기였고 커맨드 센터가 정정). 그리드·셀·카드·스켈레톤 전부 기존 것 재사용(새 스타일 상수 0).
 * 0건·구 서버(필드 부재)면 섹션 자체가 안 뜬다(빈 헤더 금지, P-210).
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
  const R = require('react') as typeof import('react');
  const mk = (name: string) => (props: Record<string, unknown>) => R.createElement(name, props, props.children as never);
  return { __esModule: true, default: mk('Svg'), Svg: mk('Svg'), Path: mk('Path'), Rect: mk('Rect'), Defs: mk('Defs'), ClipPath: mk('ClipPath'), Circle: mk('Circle'), G: mk('G'), Line: mk('Line'), Polyline: mk('Polyline') };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const FOOD = (id: string, name: string) => ({
  foodId: id,
  name,
  nameKo: name,
  photoUrl: null,
  risk: 'safe' as const,
  overall: { average: 4.5, count: 12 },
});

jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '1', restrictions: [] } }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
const mockInfinite = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({
  useInfiniteFoods: () => mockInfinite(),
  useSearchFoods: () => ({ data: [] }),
  useScannedFoods: () => ({ data: [] }),
  useFoodDetail: () => ({ data: undefined }),
}));
jest.mock('@/lib/data/bookmarks', () => ({
  useBookmarks: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: jest.fn(), hasNextPage: false, fetchNextPage: jest.fn(), isFetchingNextPage: false }),
  useSavedIds: () => ({ ids: new Set<string>(), ready: true }),
  useToggleBookmark: () => ({ mutate: jest.fn() }),
}));

import { FoodExplorer } from '../FoodExplorer';

const render = (el: React.ReactElement): ReactTestRenderer => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(el); });
  return t;
};
// 호스트 노드만 — 합성 노드까지 세면 같은 testID가 2~3개로 잡힌다
const ids = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => typeof n.type === 'string' && n.props?.testID === id);
beforeEach(() => {
  jest.clearAllMocks();
  mockInfinite.mockReturnValue({ data: [FOOD('1', 'Kimchi Stew')], isLoading: false, isError: false, error: null, refetch: jest.fn(), hasNextPage: false, fetchNextPage: jest.fn(), isFetchingNextPage: false });
});

it('홈(embedded) = 2×2 그리드 + 헤더 · 카드·셀은 safe 구역과 같은 것', () => {
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" mostReviewed={[FOOD('9', 'Tteokbokki'), FOOD('10', 'Gimbap')]} />);
  expect(ids(tree, 'home-most-reviewed-head').length).toBeGreaterThanOrEqual(1);
  expect(ids(tree, 'home-most-reviewed-grid').length).toBe(1);
  const s = JSON.stringify(tree.toJSON());
  expect(s).toContain('home.mostReviewed');
  expect(s).toContain('Tteokbokki');
  expect(ids(tree, 'home-food-9').length).toBe(1); // FoodGridCard testID 문법 그대로
});

it('상위 4개까지만(2×2) — safe 구역과 같은 규칙, 더 보기 없음', () => {
  const six = ['9', '10', '11', '12', '13', '14'].map((id) => FOOD(id, `F${id}`));
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" mostReviewed={six} />);
  for (const id of ['9', '10', '11', '12']) expect(ids(tree, `home-food-${id}`).length).toBe(1);
  for (const id of ['13', '14']) expect(ids(tree, `home-food-${id}`)).toHaveLength(0);
});

it('홀수(3개) = 마지막 행 빈 셀로 채움(카드가 행 전체로 늘어나지 않게)', () => {
  const three = ['9', '10', '11'].map((id) => FOOD(id, `F${id}`));
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" mostReviewed={three} />);
  expect(ids(tree, 'home-most-reviewed-filler').length).toBe(1);
});

it('게스트도 같은 그리드(회원 전용 아님)', () => {
  const tree = render(<FoodExplorer variant="embedded" guest srcTag="home" mostReviewed={[FOOD('9', 'Tteokbokki')]} />);
  expect(ids(tree, 'home-most-reviewed-grid').length).toBe(1);
});

it('0건·구 서버(필드 부재) = 섹션 통째 숨김(빈 헤더 금지)', () => {
  let tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" mostReviewed={[]} />);
  expect(ids(tree, 'home-most-reviewed-head')).toHaveLength(0);
  expect(ids(tree, 'home-most-reviewed-grid')).toHaveLength(0);

  // 구 서버: 어댑터가 []로 만들지만, prop이 아예 안 와도 죽지 않아야 한다
  tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(ids(tree, 'home-most-reviewed-grid')).toHaveLength(0);
});

it('로딩 = 기존 레일 스켈레톤(새 스타일 0)', () => {
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" mostReviewed={[]} mostReviewedLoading />);
  expect(ids(tree, 'home-most-reviewed-skel').length).toBe(1);
});

it('음식 탭(screen)에는 뜨지 않는다 — 홈 전용 섹션(데이터가 와도)', () => {
  const tree = render(<FoodExplorer variant="screen" guest={false} srcTag="food" mostReviewed={[FOOD('9', 'Tteokbokki')]} />);
  expect(ids(tree, 'home-most-reviewed-grid')).toHaveLength(0);
});

describe('소스 잠금', () => {
  const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

  it('safe 구역과 **같은 스타일**을 쓴다(전용 상수 신설 0)', () => {
    const src = read('src/features/food/FoodExplorer.tsx');
    // 그리드·행·셀 = safeGrid 계열 그대로
    expect(src.match(/style=\{styles\.safeGrid\}/g)?.length).toBe(2); // safe + mostReviewed
    expect(src.match(/style=\{styles\.safeGridRow\}/g)?.length).toBe(2);
    expect(src).toContain('style={styles.railSkel}'); // 로딩은 기존 스켈레톤
    expect(src).not.toContain('mostReviewedGrid:'); // 전용 스타일 신설 금지
    expect(src).not.toContain('mostReviewedRail:');
  });

  it('어댑터: 필드 부재 = 빈 배열(구 서버 호환)', () => {
    expect(read('src/lib/data/useHome.ts')).toContain('(wire.mostReviewedFoods ?? []).map(adaptMenuSummary)');
  });

  it('홈 화면이 데이터를 내려 준다 — 레일 컴포넌트는 홈 쿼리를 직접 잡지 않는다', () => {
    const home = read('src/app/(tabs)/index.tsx');
    expect(home).toContain('mostReviewed={home?.mostReviewed ?? []}');
    expect(home).toContain('mostReviewedLoading={isLoading}');
    expect(read('src/features/food/FoodExplorer.tsx')).not.toContain("from '@/lib/data/useHome'");
  });

  it('문구 10로케일', () => {
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as { home: Record<string, string> };
      expect(j.home.mostReviewed).toBeTruthy();
      expect(j.home.mostReviewedSub).toBeTruthy();
    }
  });
});
