/**
 * KB-830: 음식 탭 정렬 전환 — 다른 정렬 첫 페이지 선요청(현재 목록 뒤 · 같은 필터 · 첫 페이지만 · 실패 무시) + 스켈레톤이 카드 그리드와 같은 여백.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-native-reanimated', () => {
  const { View, Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c ?? Pressable },
    createAnimatedComponent: (c: unknown) => c,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    useAnimatedScrollHandler: () => () => {},
    useAnimatedProps: () => ({}),
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));
const mockFetch = jest.fn();
jest.mock('@/lib/data/foodNameSort', () => ({
  ...jest.requireActual('@/lib/data/foodNameSort'),
  useRestartOnStaleCursor: () => {},
}));

// eslint-disable-next-line import/first -- jest.mock 뒤
import * as foods from '../useFoods';

function Probe(p: { risk?: 'all' | 'safe' | 'danger'; current?: 'name_asc' | 'name_desc'; enabled: boolean; ready: boolean }) {
  foods.usePrefetchOtherFoodSorts(p.risk, p.current, { enabled: p.enabled, ready: p.ready });
  return null;
}

describe('KB-830 다른 정렬 첫 페이지 선요청', () => {
  let qc: QueryClient;
  let spy: jest.SpyInstance;
  beforeEach(() => {
    qc = new QueryClient();
    spy = jest.spyOn(qc, 'prefetchInfiniteQuery').mockImplementation(async () => { mockFetch(); });
  });
  const mount = (p: React.ComponentProps<typeof Probe>) => {
    let tr!: renderer.ReactTestRenderer;
    act(() => { tr = renderer.create(<QueryClientProvider client={qc}><Probe {...p} /></QueryClientProvider>); });
    return { update: (n: React.ComponentProps<typeof Probe>) => act(() => tr.update(<QueryClientProvider client={qc}><Probe {...n} /></QueryClientProvider>)), unmount: () => act(() => tr.unmount()) };
  };
  const keys = () => spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
  const key = (risk: 'all' | 'safe' | 'danger' | undefined, sort?: 'name_asc' | 'name_desc') =>
    JSON.stringify(foods.foodsListOptions('en', jest.requireActual('@/lib/api/foodAdapter').riskWireOf(risk), sort).queryKey);

  it('현재 목록 첫 페이지 전(ready false) = 0 · 도착 뒤 = 현재 정렬 빼고 나머지 서버 정렬 2개(같은 필터 키)', () => {
    const m = mount({ risk: 'safe', current: undefined, enabled: true, ready: false });
    expect(spy).not.toHaveBeenCalled();
    m.update({ risk: 'safe', current: undefined, enabled: true, ready: true });
    expect(keys()).toEqual([key('safe', 'name_asc'), key('safe', 'name_desc')]);
    m.unmount();
  });
  it('이름 정렬 중이면 인기(정렬 없음)와 반대 이름 정렬 · 필터 변경 = 새 필터 키로 다시', () => {
    const m = mount({ risk: 'all', current: 'name_asc', enabled: true, ready: true });
    expect(keys()).toEqual([key('all', undefined), key('all', 'name_desc')]);
    spy.mockClear();
    m.update({ risk: 'danger', current: 'name_asc', enabled: true, ready: true });
    expect(keys()).toEqual([key('danger', undefined), key('danger', 'name_desc')]);
    m.unmount();
  });
  it('첫 페이지만(pages 지정 0 — prefetchInfiniteQuery 기본 1장) · 화면 목록과 같은 정의(foodsListOptions) · 비활성(Saved·홈) = 0', () => {
    const m = mount({ risk: 'all', current: undefined, enabled: false, ready: true });
    expect(spy).not.toHaveBeenCalled();
    m.update({ risk: 'all', current: undefined, enabled: true, ready: true });
    expect(spy).toHaveBeenCalledTimes(2);
    for (const c of spy.mock.calls) {
      const o = c[0] as Record<string, unknown>;
      expect(o.pages).toBeUndefined();
      expect(typeof o.getNextPageParam).toBe('function');
      expect(o.placeholderData).toBeUndefined(); // keepPreviousData 금지(판정 표면)
    }
    m.unmount();
  });
  it('선요청 실패 = 조용히 무시(throw·미처리 거부 0)', async () => {
    spy.mockImplementation(() => Promise.reject(new Error('net')));
    const m = mount({ risk: 'all', current: undefined, enabled: true, ready: true });
    await act(async () => { await Promise.resolve(); });
    expect(spy).toHaveBeenCalledTimes(2);
    m.unmount();
  });
  it('음식 탭 배선 = 현재 목록 성공 뒤·정렬 가능한 화면·Saved 아닐 때만 · 목록 쿼리는 placeholderData 없음', () => {
    const fs = jest.requireActual('fs');
    const fx = fs.readFileSync('src/features/food/FoodExplorer.tsx', 'utf8') as string;
    expect(fx).toContain('usePrefetchOtherFoodSorts(riskChip, nameSort, { enabled: sortable && !savedTabActive, ready: browse.isSuccess });');
    const uf = fs.readFileSync('src/lib/data/useFoods.ts', 'utf8') as string;
    expect(uf).not.toMatch(/placeholderData\s*:|import[^;]*keepPreviousData/); // 주석의 금지 안내는 허용, 실제 사용 0
  });
});

describe('KB-830 스켈레톤 = 카드 그리드와 같은 여백·열 간격', () => {
  it('행 스타일·셀 스타일을 그대로 받아 3행 × 2열', () => {
    const { SkeletonFoodGrid } = jest.requireActual('@/components/Skeleton') as typeof import('@/components/Skeleton');
    const { StyleSheet } = jest.requireActual('react-native');
    const row = { columnGap: 16, paddingHorizontal: 20 };
    const cell = { flex: 1, marginBottom: 16 };
    let tr!: renderer.ReactTestRenderer;
    act(() => { tr = renderer.create(<SkeletonFoodGrid rowStyle={row} cellStyle={cell} />); });
    const rows = tr.root.findAll((n) => n.props?.testID === 'skeleton-food-row' && typeof n.type === 'string');
    expect(rows).toHaveLength(3);
    expect(StyleSheet.flatten(rows[0].props.style)).toMatchObject({ flexDirection: 'row', columnGap: 16, paddingHorizontal: 20 });
    expect(rows[0].children.filter((c) => typeof c !== 'string')).toHaveLength(2);
    act(() => tr.unmount());
  });
});
