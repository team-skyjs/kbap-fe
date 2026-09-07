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
const mockMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({ useMe: () => mockMe() }));
const mockBrowse = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({ useInfiniteFoods: () => mockBrowse() }));
const mockToggle = jest.fn();
const mockSaved = jest.fn();
jest.mock('@/lib/data/bookmarks', () => ({
  useBookmarks: () => mockSaved(),
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
const browseOf = (data: ReturnType<typeof FOOD>[]) => ({
  data,
  isLoading: false, isError: false, error: null, refetch: jest.fn(),
  hasNextPage: true, isFetchingNextPage: false, fetchNextPage: mockFetchNext,
});
beforeEach(() => {
  jest.clearAllMocks();
  mockBrowse.mockReturnValue(browseOf(Array.from({ length: 10 }, (_, i) => FOOD(String(i + 1), i % 2 ? 'danger' : 'safe'))));
  mockMe.mockReturnValue({ data: { id: '9', restrictions: [{ kind: 'allergy', code: 'EGG' }] } });
  mockSaved.mockReturnValue({ data: [], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
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

it('①② 두 화면 = 같은 컴포넌트 + 소스 잠금 — 홈 = 세그먼트(Popular 기본) / 음식 탭 = 세그먼트 소멸(P-318)', () => {
  const fs = require('fs');
  // 두 화면 모두 FoodExplorer 경유(자체 검색/탭/칩/그리드 마크업 잔존 0)
  const home = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8') as string;
  const food = fs.readFileSync('src/app/(tabs)/food.tsx', 'utf8') as string;
  expect(home).toContain('<FoodExplorer variant="embedded" guest={isGuest} srcTag="home" />');
  expect(food).toContain('variant="screen"');
  expect(food).toContain('parseFoodFilterParams'); // See all 파라미터 수신(P-318)
  expect(food).not.toContain('initialTab'); // 세그먼트 소멸 — 탭 개념 없음
  expect(home).not.toContain('testID="home-search"'); // 마크업은 공용 1곳
  expect(food).not.toContain('function BrowseCard'); // 구 카드 소멸(주석 언급만 허용)
  // 렌더: 홈 = Popular 기본 활성 / 음식 탭 = 세그먼트 미렌더
  expect(activeTab(render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />))).toBe('home-tab-popular');
  const screen = render(<FoodExplorer variant="screen" guest={false} srcTag="list" />);
  expect(screen.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('home-tab-'))).toHaveLength(0);
});

it('③ 음식 탭(screen) = 4장 제한 없음 + onEndReached → fetchNextPage', () => {
  const tree = render(<FoodExplorer variant="screen" guest={false} initialTab="food" srcTag="list" />);
  // 10장 전부(임베드는 4장 슬라이스) — 고유 testID 계수(composite+host 중복 배제)
  expect(cardIds(tree).size).toBe(10);
  const list = tree.root.findAll((n) => typeof n.props?.onEndReached === 'function')[0];
  act(() => list.props.onEndReached({ distanceFromEnd: 0 }));
  expect(mockFetchNext).toHaveBeenCalledTimes(1);
});

// ③-b~⑦: P-317(KB-483) 홈 v2 — 4장 그리드+More → 가로 레일(상한 10)+See all 카드.
const press = (tree: ReactTestRenderer, id: string) =>
  act(() =>
    tree.root
      .findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0]
      .props.onPress(),
  );

it('③-b 홈(embedded) = 가로 레일 상한 10 + See all 카드(구 More 소멸)', () => {
  // 카탈로그 12장이어도 레일은 10장까지(전부 safe — Safe 레일도 같은 10장이라 합집합 10)
  mockBrowse.mockReturnValue(browseOf(Array.from({ length: 12 }, (_, i) => FOOD(String(i + 1)))));
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(cardIds(tree).size).toBe(10);
  expect(tree.root.findAll((n) => n.props?.testID === 'home-rail-see-all' && typeof n.props?.onPress === 'function').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'home-grid-more')).toHaveLength(0);
});

it('⑤ P-317 See all — 현재 세그먼트·칩 상태가 음식 탭 쿼리로 승계', () => {
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  press(tree, 'home-rail-see-all');
  // Codex #81 P1: t = 내비게이션 nonce — 같은 필터의 재진입도 수신측 재동기화
  expect(mockPush).toHaveBeenLastCalledWith(expect.stringMatching(/^\/food\?segment=popular&risk=all&t=\d+$/)); // 기본 상태
  press(tree, 'home-tab-food');
  press(tree, 'home-chip-danger');
  press(tree, 'home-rail-see-all');
  expect(mockPush).toHaveBeenLastCalledWith(expect.stringMatching(/^\/food\?segment=food&risk=danger&t=\d+$/)); // 상태 승계
});

it('⑥ P-317 Safe for you 레일 — 회원+회피≥1+Popular+All에서만, safe<3 숨김', () => {
  const hasRail = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => n.props?.testID === 'home-safe-rail').length > 0;
  // 충족(회원·EGG·Popular·All — safe 5장) → 노출
  expect(hasRail(render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />))).toBe(true);
  // 게스트 → 숨김
  expect(hasRail(render(<FoodExplorer variant="embedded" guest srcTag="home" />))).toBe(false);
  // 회피 0 → 숨김
  mockMe.mockReturnValue({ data: { id: '9', restrictions: [] } });
  expect(hasRail(render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />))).toBe(false);
  mockMe.mockReturnValue({ data: { id: '9', restrictions: [{ kind: 'allergy', code: 'EGG' }] } });
  // 비Popular(Food 탭) → 숨김, 복귀 후 비All(danger 칩) → 숨김
  const t2 = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  press(t2, 'home-tab-food');
  expect(hasRail(t2)).toBe(false);
  press(t2, 'home-tab-popular');
  press(t2, 'home-chip-danger');
  expect(hasRail(t2)).toBe(false);
  // safe 2장뿐 → 숨김(3 미만)
  mockBrowse.mockReturnValue(browseOf([FOOD('1'), FOOD('2'), FOOD('3', 'danger'), FOOD('4', 'danger')]));
  expect(hasRail(render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />))).toBe(false);
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

it('⑧ Codex #80 P1 — initialRisk 초기 적용(회원), 게스트는 all 강등', () => {
  // 회원: danger 초기 칩 → danger 카드만
  const t1 = render(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />);
  expect([...cardIds(t1)].sort()).toEqual(['home-food-10', 'home-food-2', 'home-food-4', 'home-food-6', 'home-food-8']);
  // 게스트: 개인화 칩 게이트 우회 금지 — all 강등(전 카드 + 게이트 미오픈)
  const t2 = render(<FoodExplorer variant="screen" guest initialRisk="danger" srcTag="list" />);
  expect(cardIds(t2).size).toBe(10);
  expect(t2.root.findAll((n) => n.props?.testID === 'auth-gate-open')).toHaveLength(0);
});

it('⑨ P-318 Saved 토글 칩 — 회원: 저장 목록만↔전체, 게스트: 게이트 + OFF 유지', () => {
  mockSaved.mockReturnValue({ data: [FOOD('2', 'danger')], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const tree = render(<FoodExplorer variant="screen" guest={false} srcTag="list" />);
  press(tree, 'food-chip-saved');
  expect([...cardIds(tree)]).toEqual(['home-food-2']); // 저장분만
  press(tree, 'food-chip-saved');
  expect(cardIds(tree).size).toBe(10); // 토글 해제 = 전체 카탈로그
  // 게스트: 게이트 + 필터 미적용
  const g = render(<FoodExplorer variant="screen" guest srcTag="list" />);
  press(g, 'food-chip-saved');
  expect(g.root.findAll((n) => n.props?.testID === 'auth-gate-open').length).toBeGreaterThanOrEqual(1);
  expect(cardIds(g).size).toBe(10);
});

it('⑩ P-318 정렬 시트 — 가나다 = 표시명 클라 정렬, NEW = KB-439 전 비활성', () => {
  const tree = render(<FoodExplorer variant="screen" guest={false} srcTag="list" />);
  expect([...cardIds(tree)][0]).toBe('home-food-1'); // 기본 = 인기(현행 순서)
  press(tree, 'food-sort');
  // 시트 행: rowText(label) → onPress 보유 조상(Pressable)로 승격
  const sheetRow = (label: string) => {
    let n = tree.root.findAll((x) => x.props?.children === label && x.props?.numberOfLines === 1)[0];
    while (n && typeof n.props?.onPress !== 'function') n = n.parent!;
    return n;
  };
  expect(sheetRow('food.sort_new').props.disabled).toBe(true); // publishedAt 부재 — 비활성
  act(() => sheetRow('food.sort_alpha').props.onPress());
  // 'Food 1' < 'Food 10' < 'Food 2' — 표시명 사전순으로 재배열
  expect([...cardIds(tree)].slice(0, 3)).toEqual(['home-food-1', 'home-food-10', 'home-food-2']);
});

it('⑪ P-318 initialSaved — 회원: 저장 필터로 진입, 게스트: 강등(전체 + 게이트 미오픈)', () => {
  mockSaved.mockReturnValue({ data: [FOOD('3')], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const t1 = render(<FoodExplorer variant="screen" guest={false} initialSaved srcTag="list" />);
  expect([...cardIds(t1)]).toEqual(['home-food-3']);
  const t2 = render(<FoodExplorer variant="screen" guest initialSaved srcTag="list" />);
  expect(cardIds(t2).size).toBe(10);
  expect(t2.root.findAll((n) => n.props?.testID === 'auth-gate-open')).toHaveLength(0);
});

it('⑫ Codex #80 2R — 마운트 유지 화면에 두 번째 See all 파라미터 재적용(P-318: Saved 칩·위험 칩)', () => {
  mockSaved.mockReturnValue({ data: [FOOD('2', 'danger')], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const tree = render(<FoodExplorer variant="screen" guest={false} srcTag="list" />);
  expect(cardIds(tree).size).toBe(10);
  // 사용자가 화면에서 칩을 바꾼 상태여도, 새 See all 파라미터가 오면 그 값으로 재동기화
  press(tree, 'home-chip-safe');
  act(() => tree.update(<FoodExplorer variant="screen" guest={false} initialSaved initialRisk="danger" srcTag="list" />));
  expect(tree.root.findAll((n) => n.props?.testID === 'food-chip-saved' && n.props?.selected === true).length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'home-chip-danger' && n.props?.selected === true).length).toBeGreaterThanOrEqual(1);
  expect([...cardIds(tree)]).toEqual(['home-food-2']); // 저장분 중 danger만
});

it('⑬ Codex #80 3R P2 — 세션 상태 전환은 파라미터 재적용이 아님(게스트 강등만 별도)', () => {
  // 게스트 진입(강등: all) 후 로그인(guest→false) — 파라미터 불변이면 stale initialRisk 재적용 금지
  const tree = render(<FoodExplorer variant="screen" guest initialRisk="danger" srcTag="list" />);
  expect(cardIds(tree).size).toBe(10); // 강등 all
  act(() => tree.update(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />));
  expect(tree.root.findAll((n) => n.props?.testID === 'home-chip-all' && n.props?.selected === true).length).toBeGreaterThanOrEqual(1);
  // 반대로 만료(→게스트)는 개인화 필터 강등
  const t2 = render(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />);
  expect([...cardIds(t2)].length).toBe(5); // danger 5
  act(() => t2.update(<FoodExplorer variant="screen" guest initialRisk="danger" srcTag="list" />));
  expect(cardIds(t2).size).toBe(10); // all 강등
});

it('⑭ Codex #81 P1 — 같은 파라미터의 두 번째 See all(paramsKey 변경) = Saved 재적용', () => {
  mockSaved.mockReturnValue({ data: [FOOD('2', 'danger')], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const tree = render(<FoodExplorer variant="screen" guest={false} initialSaved paramsKey="1" srcTag="list" />);
  expect([...cardIds(tree)]).toEqual(['home-food-2']);
  press(tree, 'food-chip-saved'); // 사용자가 Saved OFF
  expect(cardIds(tree).size).toBe(10);
  // 같은 Saved 레일 See all 재탭 = segment/risk 동일, t만 갱신 → 재적용
  act(() => tree.update(<FoodExplorer variant="screen" guest={false} initialSaved paramsKey="2" srcTag="list" />));
  expect([...cardIds(tree)]).toEqual(['home-food-2']);
});

it('④-b 회원 칩 = 현행 필터 동작(safe 선택 시 danger 카드 소멸)', () => {
  const tree = render(<FoodExplorer variant="screen" guest={false} initialTab="food" srcTag="list" />);
  const safe = tree.root.findAll((n) => n.props?.testID === 'home-chip-safe' && typeof n.props?.onPress === 'function')[0];
  act(() => safe.props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'auth-gate-open')).toHaveLength(0);
  expect([...cardIds(tree)].sort()).toEqual(['home-food-1', 'home-food-3', 'home-food-5', 'home-food-7', 'home-food-9']); // safe만
});
