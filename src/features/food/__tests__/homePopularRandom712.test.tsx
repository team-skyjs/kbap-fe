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

// eslint-disable-next-line import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례
import { FoodExplorer, HOME_RAIL_N } from '../FoodExplorer';

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
const RANDOM = [FOOD('30', 'Rand X'), FOOD('10', 'Rand Y', { photoUrl: 'https://cdn/y.jpg' }), FOOD('20', 'Rand Z')];

beforeEach(() => {
  jest.clearAllMocks();
  mockInfinite.mockReturnValue(list(LATEST));
});

it('Popular + All = /home popularFoods를 서버 순서 그대로(사진 우선 재배치 없음 · 음식 탭 목록과 다름)', () => {
  const t = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={RANDOM} />);
  expect(railOrder(t)).toEqual(['30', '10', '20']);
});

it('최대 HOME_RAIL_N개', () => {
  const many = Array.from({ length: HOME_RAIL_N + 3 }, (_, i) => FOOD(`p${i}`, `P${i}`));
  const t = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={many} />);
  expect(railOrder(t)).toEqual(many.slice(0, HOME_RAIL_N).map((f) => f.foodId));
});

it('위험도 칩 선택 = 기존 서버 필터 목록(/foods?risk=) — /home 목록 아님', () => {
  const t = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={RANDOM} />);
  const SAFE = [FOOD('7', 'Safe One'), FOOD('8', 'Safe Two')];
  mockInfinite.mockReturnValue(list(SAFE));
  act(() => t.root.findAll((n) => n.props?.testID === 'home-chip-safe' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(railOrder(t)).toEqual(['7', '8']);
});

it('빈 값(구 서버·MOCK)·미전달(음식 탭 등) = 기존 폴백(/foods 앞부분, 사진 우선)', () => {
  const empty = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={[]} />);
  expect(railOrder(empty)).toEqual(['1', '3', '2']);
  const absent = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(railOrder(absent)).toEqual(['1', '3', '2']);
});

it('/home 로딩 = 레일 스켈레톤(목록이 이미 있어도 잠깐 보였다 바뀌는 팝인 없음) · /foods 로딩이 /home 카드를 가리지 않음', () => {
  // 홈이 실제로 넘기는 모양 = popular={undefined}(데이터 없음) + popularLoading — 빈 배열이 아니다(#237 공부)
  const loading = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={undefined} popularLoading />);
  expect(host(loading, (id) => id === 'home-rail-skel')).toHaveLength(1);
  expect(railOrder(loading)).toEqual([]); // /foods 폴백이 먼저 보이지 않음
  mockInfinite.mockReturnValue(list([], { isLoading: true }));
  const ready = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={RANDOM} />);
  expect(host(ready, (id) => id === 'home-rail-skel')).toHaveLength(0);
  expect(railOrder(ready)).toEqual(['30', '10', '20']);
});

it('판정 = /home 응답 위험도 그대로 · 회피 변경으로 /home이 다시 오면 옛 판정이 남지 않음', () => {
  const t = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={[FOOD('30', 'Rand X', { risk: 'safe' })]} />);
  expect(host(t, (id) => id === 'risk-badge-safe').length).toBeGreaterThan(0);
  act(() => t.update(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={[FOOD('30', 'Rand X', { risk: 'danger' })]} />));
  expect(host(t, (id) => id === 'risk-badge-safe')).toHaveLength(0);
  expect(host(t, (id) => id === 'risk-badge-danger').length).toBeGreaterThan(0);
});

describe('소스 잠금', () => {
  const read = (p: string) => (jest.requireActual('fs') as typeof import('fs')).readFileSync(p, 'utf8');
  it('요청 추가 0 — FoodExplorer는 /home을 직접 조회하지 않고, 홈 화면이 이미 부르는 useHome 값을 내려준다', () => {
    expect(read('src/features/food/FoodExplorer.tsx')).not.toMatch(/from '@\/lib\/data\/useHome'/);
    const home = read('src/app/(tabs)/index.tsx');
    expect(home).toContain('popular={home?.recommended}');
    expect(home).toContain('popularLoading={isPending}');
  });
  it('북마크 토글이 /home을 무효화하지 않는다 — 랜덤 레일이 토글 한 번에 통째로 바뀌지 않게(저장 표시는 북마크 쿼리의 savedIds)', () => {
    const bm = read('src/lib/data/bookmarks.ts');
    expect(bm).not.toMatch(/['"]home['"]/);
    expect(read('src/features/food/FoodExplorer.tsx')).toContain('saved={savedIds.has(item.foodId)}');
  });
});

// KB-710(6): 레일 구성이 바뀌면(첫 카드 id가 달라짐) 가로 스크롤을 처음으로 — 옛 위치가 남아 새 첫 카드가 잘린 채 시작했다(KB-712 QA)
it('KB-710 레일 첫 카드가 바뀌면 scrollTo x 0 · 같은 레일에서 판정만 바뀌면 위치 유지', () => {
  const t = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={RANDOM} />);
  const rail = t.root.findAll((n) => n.props?.testID === 'home-rail' && n.instance != null)[0];
  const scrollTo = jest.fn();
  (rail.instance as { scrollTo: unknown }).scrollTo = scrollTo;
  // 같은 구성 · 위험도만 바뀜 = 위치 유지
  act(() => t.update(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={RANDOM.map((f) => ({ ...f, risk: 'caution' as const }))} />));
  expect(scrollTo).not.toHaveBeenCalled();
  // /home 재조회로 새 랜덤 구성 = 처음으로
  act(() => t.update(<FoodExplorer variant="embedded" guest={false} srcTag="home" popular={[FOOD('99', 'New first'), ...RANDOM]} />));
  expect(scrollTo).toHaveBeenCalledWith({ x: 0, animated: false });
});
