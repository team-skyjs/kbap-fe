/** Codex #308 P2: Packaged를 고른 뒤 홈 "See all"(새 t 파라미터)이 오면 Dishes로 — 요청한 요리 카탈로그가 가려지지 않게. */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

let mockParams: Record<string, string> = {};
jest.mock('expo-updates', () => ({ channel: 'development' })); // KB-870/P-527: 개발 기능 회귀. teamtest의 운영 숨김은 prodHide870에서 검사
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useLocalSearchParams: () => mockParams, useFocusEffect: () => {} })); // KB-968: 코치마크 2단계 포커스 판정(여기선 무관)
jest.mock('@/components', () => {
  const { View } = jest.requireActual('react-native');
  // KB-957: Dishes|Packaged = 헤더 center 슬롯 — 목 헤더도 그 슬롯을 그린다
  return { StickyHeader: (p: { center?: React.ReactNode }) => <View testID="sticky">{p.center}</View>, useStickyScroll: () => ({ onScroll: undefined, hidden: false, atTop: true }), useHeaderHeight: () => 0 };
});
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')); // KB-968: 음식 탭 = 코치마크 2단계(1회 기록)
jest.mock('@/lib/data/useNotifications', () => ({ useUnreadCount: () => 0 }));
jest.mock('@/features/food/FoodExplorer', () => {
  const { View } = jest.requireActual('react-native');
  return { FoodExplorer: (p: { headTop: React.ReactNode }) => <View testID="dishes">{p.headTop}</View> };
});
jest.mock('@/features/processedFood/PackagedExplorer', () => {
  const { View, Pressable } = jest.requireActual('react-native');
  return {
    FoodSegmentRow: (p: { onChange: (s: string) => void }) => (
      <View testID="seg-row">
        <Pressable testID="to-packaged" onPress={() => p.onChange('packaged')} />
        <Pressable testID="to-dishes" onPress={() => p.onChange('dishes')} />
      </View>
    ),
    PackagedExplorer: () => <View testID="packaged" />,
  };
});

// eslint-disable-next-line import/first -- jest.mock 뒤
import Food from '@/app/(tabs)/food';

const has = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string').length > 0;

const press = (t: ReactTestRenderer, id: string) => act(() => t.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress());

it('KB-957: 첫 진입 기본 = Packaged · 세그먼트 = 헤더 안(본문 머리 0) · Dishes 선택 유지 · 새 See all(t) = Dishes · 같은 t 재렌더 = 고른 것 유지', () => {
  mockParams = {};
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<Food />); });
  expect(has(t, 'packaged')).toBe(true); // 기본 Packaged(dev 채널 = processedFoodEnabled)
  const sticky = t.root.findAll((n) => n.props?.testID === 'sticky' && typeof n.type === 'string')[0];
  expect(sticky.findAll((n) => n.props?.testID === 'seg-row').length).toBeGreaterThan(0); // 헤더 안
  press(t, 'to-dishes');
  expect(has(t, 'dishes')).toBe(true);
  act(() => t.update(<Food />));
  expect(has(t, 'dishes')).toBe(true); // 같은 화면 재렌더 = 유지
  press(t, 'to-packaged');
  mockParams = { segment: 'saved', t: '1' };
  act(() => t.update(<Food />));
  expect(has(t, 'dishes')).toBe(true); // 음식 레일 See all = 요리 카탈로그
  mockParams = { view: 'packaged', t: '2' };
  act(() => t.update(<Food />));
  expect(has(t, 'packaged')).toBe(true); // KB-955 편의점 줄 See all(#389 병합 뒤 복원)
  press(t, 'to-dishes');
  act(() => t.update(<Food />)); // 같은 t = 전이 없음 → 고른 Dishes 유지
  expect(has(t, 'dishes')).toBe(true);
  act(() => t.unmount());
});

it('KB-973: food_segment_select — 탭 = 바뀔 때만(tap) · 링크 진입(새 t) = 진입마다 1회(코치마크 via=coach | see_all) · 같은 t 재렌더 0', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const analytics = require('@/lib/analytics') as typeof import('@/lib/analytics');
  const track = jest.spyOn(analytics, 'track');
  const seg = () => track.mock.calls.filter((c) => c[0] === 'food_segment_select').map((c) => c[1]);
  try {
    mockParams = {};
    let t!: ReactTestRenderer;
    act(() => { t = renderer.create(<Food />); });
    press(t, 'to-packaged'); // 이미 Packaged(직전 테스트 마지막 선택과 무관하게 아래에서 정리)
    track.mockClear();
    press(t, 'to-dishes');
    press(t, 'to-dishes'); // 같은 것 다시 = 0
    expect(seg()).toEqual([{ segment: 'dishes', source: 'tap' }]);
    mockParams = { view: 'packaged', t: '31', via: 'coach' };
    act(() => t.update(<Food />));
    mockParams = { view: 'packaged', t: '32' };
    act(() => t.update(<Food />));
    act(() => t.update(<Food />)); // 같은 t = 0
    expect(seg()).toEqual([{ segment: 'dishes', source: 'tap' }, { segment: 'packaged', source: 'coach' }, { segment: 'packaged', source: 'see_all' }]);
    act(() => t.unmount());
  } finally {
    track.mockRestore();
  }
});

it('KB-957: 기본 세그먼트 = 가공식품 켜진 채널 Packaged · 운영 채널(processedFoodEnabled off) Dishes — food.tsx가 이 함수로 정한다', () => {
  const { defaultFoodSegment } = jest.requireActual('@/features/food/foodFilterParams') as typeof import('@/features/food/foodFilterParams');
  expect([defaultFoodSegment(true), defaultFoodSegment(false)]).toEqual(['packaged', 'dishes']);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  expect((require('fs') as typeof import('fs')).readFileSync('src/app/(tabs)/food.tsx', 'utf8')).toContain('let lastSegment: FoodSegment = defaultFoodSegment(FLAGS.processedFoodEnabled);');
});

it('QA Q-389: 음식 탭 첫 마운트 + See all(view=packaged, t) = Packaged · 첫 마운트 + See all(t만) = Dishes', () => {
  mockParams = { view: 'packaged', t: '9' };
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<Food />); });
  expect(has(t, 'packaged')).toBe(true); // 구 = 첫 마운트 t가 곧 prevSeeAll이라 전이 0 → 이전 세그먼트(Dishes)
  act(() => t.unmount());
  mockParams = { segment: 'saved', t: '10' };
  act(() => { t = renderer.create(<Food />); });
  expect(has(t, 'dishes')).toBe(true);
  act(() => t.unmount());
});
