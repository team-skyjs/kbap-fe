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
// P-350(KB-492): 칩 = 서버 필터 — 목이 risk 인자로 서버 판정 재현
jest.mock('@/lib/data/useFoods', () => ({
  FOODS_PAGE_SIZE: 20,
  useInfiniteFoods: (risk?: string, opts?: { enabled?: boolean }) => {
    const r = mockBrowse(risk, opts);
    if (opts?.enabled === false) return { ...r, data: undefined, isError: false, isLoading: false };
    if (!r?.data || !risk || risk === 'all') return r;
    return { ...r, data: (r.data as { risk: string }[]).filter((f) => f.risk === risk) };
  },
}));
const mockToggle = jest.fn();
const mockSaved = jest.fn();
jest.mock('@/lib/data/bookmarks', () => ({ useSavedIds: () => ({ ids: new Set<string>(), ready: true }),
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

it('③-b 홈(embedded) = 가로 레일 상한(Popular=소스 8 · Food=HOME_RAIL_N 10) + See all(구 More 소멸)', () => {
  mockBrowse.mockReturnValue(browseOf(Array.from({ length: 12 }, (_, i) => FOOD(String(i + 1)))));
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  // Food 탭 = 전체 카탈로그 소스 → HOME_RAIL_N(10) 상한이 지배(12장 → 10장).
  // (Popular 탭은 popularPhotoFoods 소스 자체가 8 — P-321에서 실측 확인)
  press(tree, 'home-tab-food');
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

it('⑥ P-321 Safe picks 2×2 그리드 — 회원+회피≥1+Popular+All에서만, 최대 4장·safe<2 숨김', () => {
  const grid = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => n.props?.testID === 'home-safe-grid');
  // 충족(회원·EGG·Popular·All — safe 5장) → 노출 + 4장 상한(그리드 안 카드 = 4)
  const t1 = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(grid(t1).length).toBeGreaterThanOrEqual(1);
  const gridCardIds = new Set(
    grid(t1)[0].findAll((n) => typeof n.props?.testID === 'string' && /^home-food-\d+$/.test(n.props.testID)).map((n) => n.props.testID as string),
  );
  expect(gridCardIds.size).toBe(4); // safe 5 중 4장(2×2)
  // P-326: 셀 오버라이드 = flex:1 + width 지정 없음(47% 근사의 좌우 비대칭 폐기 —
  // flex:1의 basis 0이 base width를 무력화해 행 내 균등 분할)
  const gc = grid(t1)[0].findAll((n) => n.props?.testID === 'home-food-1')[0];
  const over = (gc.props.style as Array<Record<string, unknown>>)[1];
  expect(over.flex).toBe(1);
  expect(over.width).toBeUndefined();
  // 4장(짝수) = 빈 셀 없음
  expect(grid(t1)[0].findAll((n) => n.props?.testID === 'home-safe-grid-filler' && typeof n.type === 'string')).toHaveLength(0);
  // 3장(홀수) = 마지막 행 빈 셀 1개(카드 행 확장 방지 — #85 2R 유지)
  mockBrowse.mockReturnValue(browseOf([FOOD('1'), FOOD('2'), FOOD('3'), FOOD('4', 'danger')]));
  const t3g = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(grid(t3g)[0].findAll((n) => n.props?.testID === 'home-safe-grid-filler' && typeof n.type === 'string')).toHaveLength(1);
  // 게스트 → 숨김
  expect(grid(render(<FoodExplorer variant="embedded" guest srcTag="home" />))).toHaveLength(0);
  // 회피 0 → 숨김
  mockMe.mockReturnValue({ data: { id: '9', restrictions: [] } });
  expect(grid(render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />))).toHaveLength(0);
  mockMe.mockReturnValue({ data: { id: '9', restrictions: [{ kind: 'allergy', code: 'EGG' }] } });
  // 비Popular(Food 탭) → 숨김, 복귀 후 비All(danger 칩) → 숨김
  const t2 = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  press(t2, 'home-tab-food');
  expect(grid(t2)).toHaveLength(0);
  press(t2, 'home-tab-popular');
  press(t2, 'home-chip-danger');
  expect(grid(t2)).toHaveLength(0);
  // safe 2장 = 노출(한 행 — 구 ≥3 규칙 대체) / 1장 = 숨김
  mockBrowse.mockReturnValue(browseOf([FOOD('1'), FOOD('2'), FOOD('3', 'danger'), FOOD('4', 'danger')]));
  expect(grid(render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />)).length).toBeGreaterThanOrEqual(1);
  mockBrowse.mockReturnValue(browseOf([FOOD('1'), FOOD('2', 'danger')]));
  expect(grid(render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />))).toHaveLength(0);
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

it('⑩ P-318 → P-335 정렬 시트 — 옵션 2(인기·NEW 비활성), A–Z 소멸(커서 페이지네이션과 양립 불가)', () => {
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
  expect(tree.root.findAll((x) => x.props?.children === 'food.sort_alpha')).toHaveLength(0); // P-335 소멸
  expect(sheetRow('food.sort_popular')).toBeTruthy();
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

it('⑮ P-319/320 — 메인 레일 = ScrollView(flexGrow:0·FlatList prop 부재) + 카드·See all 폭 = railCardW', () => {
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  const rail = tree.root.findAll((n) => n.props?.testID === 'home-rail' && n.props?.horizontal === true)[0];
  expect(rail).toBeTruthy();
  // RN ScrollView 기본 baseHorizontal(flexGrow:1)이 세로 FlatList 헤더 안에서
  // 화면 높이만큼 늘어나던 P-319 공백의 근본 — 명시 flexGrow:0 잠금
  expect(JSON.stringify(rail.props.style)).toContain('"flexGrow":0');
  // P-320: 레일 = 평범한 ScrollView(중첩 VirtualizedList 경로 제거) — FlatList prop 부재 잠금
  expect(rail.props.data).toBeUndefined();
  expect(rail.props.renderItem).toBeUndefined();
  const { width } = require('react-native').Dimensions.get('window');
  const { railCardW } = require('@/features/food/railLayout') as typeof import('@/features/food/railLayout');
  const w = railCardW(width);
  expect(JSON.stringify(tree.root.findAll((n) => n.props?.testID === 'home-food-1')[0].props.style)).toContain(`"width":${w}`);
  expect(JSON.stringify(tree.root.findAll((n) => n.props?.testID === 'home-rail-see-all')[0].props.style)).toContain(`"width":${w}`);
});

it('⑯ P-321 레일 상태 — 로딩 스켈레톤 / 에러 / Saved 0건 CTA / 칩 전부 걸러짐(전부 ScrollView 밖)', () => {
  const byIdIn = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id);
  // ① 로딩 = 스켈레톤 2장, ScrollView 미마운트
  mockBrowse.mockReturnValue({ ...browseOf([]), isLoading: true });
  const t1 = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(byIdIn(t1, 'home-rail-skel').length).toBeGreaterThanOrEqual(1);
  expect(byIdIn(t1, 'home-rail')).toHaveLength(0);
  // ② 에러 = QueryErrorBlock 인라인
  mockBrowse.mockReturnValue({ ...browseOf([]), isError: true, error: new Error('HTTP 500') });
  const t2 = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(byIdIn(t2, 'food-grid-error').length).toBeGreaterThanOrEqual(1);
  // ②-c Codex #85 3R P2: 캐시 데이터 + 백그라운드 에러(isError·data 동시) = 레일 유지
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('1'), FOOD('2', 'danger')]), isError: true, error: new Error('HTTP 500') });
  const t2c = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(byIdIn(t2c, 'food-grid-error')).toHaveLength(0);
  expect(cardIds(t2c).size).toBeGreaterThanOrEqual(2);
  // ①-b Codex #85 2R P2: 카탈로그 콜드 로딩 중에도 Saved 탭 = 저장 카드 유지(스켈레톤 미노출)
  mockBrowse.mockReturnValue({ ...browseOf([]), isLoading: true });
  mockSaved.mockReturnValue({ data: [FOOD('3')], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const t1b = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  press(t1b, 'home-tab-saved');
  expect(byIdIn(t1b, 'home-rail-skel')).toHaveLength(0);
  expect([...cardIds(t1b)]).toEqual(['home-food-3']);
  mockSaved.mockReturnValue({ data: [], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  // ②-b Codex #85 P2: 카탈로그 에러 중에도 Saved 탭 = 저장 카드 유지(에러 블록 미노출)
  mockSaved.mockReturnValue({ data: [FOOD('2', 'danger')], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const t2b = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  press(t2b, 'home-tab-saved');
  expect(byIdIn(t2b, 'food-grid-error')).toHaveLength(0);
  expect([...cardIds(t2b)]).toEqual(['home-food-2']);
  mockSaved.mockReturnValue({ data: [], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  // ③ Saved 탭 저장 0건 = 제목+본문+Browse CTA(→ /food) — 에러 목 원복 후
  mockBrowse.mockReturnValue(browseOf(Array.from({ length: 10 }, (_, i) => FOOD(String(i + 1), i % 2 ? 'danger' : 'safe'))));
  const t3 = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  press(t3, 'home-tab-saved');
  expect(byIdIn(t3, 'home-rail-saved-empty').length).toBeGreaterThanOrEqual(1);
  press(t3, 'home-rail-browse');
  expect(mockPush).toHaveBeenLastCalledWith('/food');
  // ④ 칩 전부 걸러짐(caution 0건) — P-350: hasNext 남았으면 채움 중 = 스켈레톤,
  // 빈 판정은 !hasNextPage && 0건일 때만 railFilterEmpty
  mockBrowse.mockReturnValue(browseOf([FOOD('1'), FOOD('2', 'danger')]));
  const t4a = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  press(t4a, 'home-chip-caution');
  expect(byIdIn(t4a, 'home-rail-skel').length).toBeGreaterThanOrEqual(1); // hasNext=true = 채움 중
  expect(byIdIn(t4a, 'home-rail-filter-empty')).toHaveLength(0);
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('1'), FOOD('2', 'danger')]), hasNextPage: false });
  const t4 = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  press(t4, 'home-chip-caution');
  expect(byIdIn(t4, 'home-rail-filter-empty').length).toBeGreaterThanOrEqual(1);
  expect(byIdIn(t4, 'home-rail')).toHaveLength(0);
  // ⑤ 계측 코드 소멸(P-321 ①) — 소스 잠금
  const fs = require('fs');
  for (const f of ['src/features/food/FoodExplorer.tsx', 'src/lib/flags.ts', 'src/features/food/FoodCards.tsx']) {
    expect(fs.readFileSync(f, 'utf8')).not.toContain('layoutDebug');
  }
});

it('④-b 회원 칩 = 현행 필터 동작(safe 선택 시 danger 카드 소멸)', () => {
  const tree = render(<FoodExplorer variant="screen" guest={false} initialTab="food" srcTag="list" />);
  const safe = tree.root.findAll((n) => n.props?.testID === 'home-chip-safe' && typeof n.props?.onPress === 'function')[0];
  act(() => safe.props.onPress());
  expect(tree.root.findAll((n) => n.props?.testID === 'auth-gate-open')).toHaveLength(0);
  expect([...cardIds(tree)].sort()).toEqual(['home-food-1', 'home-food-3', 'home-food-5', 'home-food-7', 'home-food-9']); // safe만
});

it('#112 1R ③→2R ② — Saved(+위험 칩) 쿼리 에러 = 전체 화면 에러 게이트(활성 쿼리 기준), 가짜 no-matches 금지', () => {
  mockSaved.mockReturnValue({ data: [], isLoading: false, isError: true, error: new Error('HTTP 500'), refetch: jest.fn(), hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const tree = render(<FoodExplorer variant="screen" guest={false} initialSaved srcTag="list" />);
  expect(tree.root.findAll((n) => n.props?.testID === 'query-error-block').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'food-grid-filter-empty')).toHaveLength(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'empty-block')).toHaveLength(0);
});

it('#112 2R ① — 홈 embedded Saved 레일: 북마크 쿼리 에러 = filterEmpty·saved-empty보다 먼저 인라인 에러', () => {
  mockSaved.mockReturnValue({ data: [], isLoading: false, isError: true, error: new Error('HTTP 500'), refetch: jest.fn(), hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const tree = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  act(() => { tree.root.findAll((n) => n.props?.testID === 'home-tab-saved' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
  expect(tree.root.findAll((n) => n.props?.testID === 'food-grid-error').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'home-rail-saved-empty')).toHaveLength(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'home-rail-filter-empty')).toHaveLength(0);
});

it('#112 2R ② — Saved 활성 = browse 휴면(enabled:false) + 전체 화면 에러 게이트는 활성 쿼리(gridQ)', () => {
  // browse가 에러여도 Saved 활성(savedList 정상)이면 전체 화면 에러로 덮지 않는다
  mockBrowse.mockReturnValue({ ...browseOf([]), isError: true, error: new Error('HTTP 500') });
  mockSaved.mockReturnValue({ data: [FOOD('3')], isLoading: false, isError: false, error: null, refetch: jest.fn(), hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const tree = render(<FoodExplorer variant="screen" guest={false} initialSaved srcTag="list" />);
  expect([...cardIds(tree)]).toEqual(['home-food-3']); // savedList 카드 렌더 — browse 에러가 화면을 덮지 않음
  // browse 훅은 enabled:false로 호출됨
  const lastOpts = mockBrowse.mock.calls[mockBrowse.mock.calls.length - 1][1] as { enabled?: boolean } | undefined;
  expect(lastOpts?.enabled).toBe(false);
});

it('#112 3R ① — 채움 fetchNextPage 실패 후 자동 재호출 0회(수동 재시도만), 에러 상태도 자동 페치 0', async () => {
  const failFetch = jest.fn().mockResolvedValue({ isError: true });
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('1')]), fetchNextPage: failFetch });
  const tree = render(<FoodExplorer variant="screen" guest={false} srcTag="list" />);
  act(() => { tree.root.findAll((n) => n.props?.testID === 'home-chip-danger' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
  await act(async () => { await Promise.resolve(); });
  expect(failFetch).toHaveBeenCalledTimes(1); // 첫 채움 시도
  act(() => { tree.root.findAll((n) => n.props?.testID === 'home-chip-danger')[0].props.onPress(); }); // 리렌더 유발
  await act(async () => { await Promise.resolve(); });
  expect(failFetch).toHaveBeenCalledTimes(1); // 같은 커서 자동 재시도 0
  // 에러 상태 = 자동 페치 중단
  mockBrowse.mockReturnValue({ ...browseOf([]), isError: true, error: new Error('HTTP 500'), fetchNextPage: failFetch });
  const t2 = render(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />);
  await act(async () => { await Promise.resolve(); });
  expect(t2).toBeTruthy();
  expect(failFetch).toHaveBeenCalledTimes(1);
});

it('#112 3R ② — Saved 활성 새로고침 = savedList(+판정 saved)만, browse.refetch 0회', () => {
  const browseRefetch = jest.fn().mockResolvedValue(undefined);
  const savedRefetch = jest.fn().mockResolvedValue(undefined);
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('1')]), refetch: browseRefetch });
  mockSaved.mockReturnValue({ data: [FOOD('3')], isLoading: false, isError: false, error: null, refetch: savedRefetch, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const tree = render(<FoodExplorer variant="screen" guest={false} initialSaved srcTag="list" />);
  const rc = tree.root.findAll((n) => typeof n.props?.onRefresh === 'function' && 'refreshing' in (n.props ?? {}))[0];
  act(() => { rc.props.onRefresh(); });
  expect(browseRefetch).not.toHaveBeenCalled();
  expect(savedRefetch).toHaveBeenCalled();
});

it('#112 4R — screen 전체 화면 에러 재시도도 실패 기억 클리어(공유 retryGrid) → 채움 effect 재개', async () => {
  // 1) danger 칩에서 채움 실패 → 기억
  const failFetch = jest.fn().mockResolvedValue({ isError: true });
  const refetch = jest.fn().mockResolvedValue(undefined);
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('1', 'danger')]), fetchNextPage: failFetch, refetch });
  const tree = render(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />);
  await act(async () => { await Promise.resolve(); });
  expect(failFetch).toHaveBeenCalledTimes(1);
  // 2) 에러 상태 → 전체 화면 게이트의 onRetry(공유 retryGrid) 실행 = refetch + 기억 클리어
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('1', 'danger')]), isError: true, error: new Error('HTTP 500'), fetchNextPage: failFetch, refetch });
  act(() => { tree.update(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />); });
  const retry = tree.root.findAll((n) => n.props?.testID === 'query-error-block')[0];
  const btn = retry.findAll((n) => typeof n.props?.onPress === 'function')[0];
  act(() => { btn.props.onPress(); });
  expect(refetch).toHaveBeenCalledTimes(1);
  // 3) 재시도 성공(에러 해소·같은 짧은 목록) → 채움 effect가 다시 산다
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('1', 'danger')]), fetchNextPage: failFetch, refetch });
  act(() => { tree.update(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />); });
  await act(async () => { await Promise.resolve(); });
  expect(failFetch).toHaveBeenCalledTimes(2); // 영구 정지 아님 — 클리어로 재개
});

it('#112 5R ① — 칩 전환 중 도착한 옛 실패 콜백이 새 쿼리 채움을 잠그지 않는다(키 스코프 마커)', async () => {
  let resolveFail!: (v: { isError: boolean }) => void;
  const slowFail = jest.fn(() => new Promise<{ isError: boolean }>((r) => { resolveFail = r; }));
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('1', 'danger')]), fetchNextPage: slowFail, isFetching: false });
  const tree = render(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />);
  await act(async () => { await Promise.resolve(); });
  expect(slowFail).toHaveBeenCalledTimes(1); // danger 채움 시도(pending)
  // 전환: caution — 새 쿼리(같은 길이 1)
  const fresh = jest.fn().mockResolvedValue({ isError: false });
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('2', 'caution')]), fetchNextPage: fresh, isFetching: false });
  act(() => { tree.root.findAll((n) => n.props?.testID === 'home-chip-caution' && typeof n.props?.onPress === 'function')[0].props.onPress(); });
  await act(async () => { resolveFail({ isError: true }); await Promise.resolve(); }); // 옛(danger) 실패 도착
  // 새 쿼리(caution)의 채움은 계속 — 옛 키 마커가 잠그지 않음
  expect(fresh.mock.calls.length).toBeGreaterThanOrEqual(1);
});

it('#112 5R ② — Saved+All 새로고침 = 같은 키 두 관찰자라 refetch 1회', () => {
  const savedRefetch = jest.fn().mockResolvedValue(undefined);
  mockSaved.mockReturnValue({ data: [FOOD('3')], isLoading: false, isError: false, error: null, refetch: savedRefetch, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() });
  const tree = render(<FoodExplorer variant="screen" guest={false} initialSaved srcTag="list" />);
  const rc = tree.root.findAll((n) => typeof n.props?.onRefresh === 'function' && 'refreshing' in (n.props ?? {}))[0];
  act(() => { rc.props.onRefresh(); });
  expect(savedRefetch).toHaveBeenCalledTimes(1);
});

it('#112 6R P2 — 리마운트 자동 재조회 성공(dataUpdatedAt 변화) = 실패 마커 무효 → 채움 재개', async () => {
  const failFetch = jest.fn().mockResolvedValue({ isError: true });
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('1', 'danger')]), fetchNextPage: failFetch, dataUpdatedAt: 100 });
  const tree = render(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />);
  await act(async () => { await Promise.resolve(); });
  expect(failFetch).toHaveBeenCalledTimes(1); // 실패 마커 기록(at=100)
  act(() => { tree.update(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />); });
  await act(async () => { await Promise.resolve(); });
  expect(failFetch).toHaveBeenCalledTimes(1); // 같은 갱신 시각 = 잠금 유지
  // RQ 자동 재조회 성공(retryGrid 우회) — dataUpdatedAt만 전진
  mockBrowse.mockReturnValue({ ...browseOf([FOOD('1', 'danger')]), fetchNextPage: failFetch, dataUpdatedAt: 200 });
  act(() => { tree.update(<FoodExplorer variant="screen" guest={false} initialRisk="danger" srcTag="list" />); });
  await act(async () => { await Promise.resolve(); });
  expect(failFetch).toHaveBeenCalledTimes(2); // 마커 무효 → 채움 재개(스켈레톤 고정 봉쇄)
});
