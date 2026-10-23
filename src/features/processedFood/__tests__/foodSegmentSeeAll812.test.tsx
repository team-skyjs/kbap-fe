/** Codex #308 P2: Packaged를 고른 뒤 홈 "See all"(새 t 파라미터)이 오면 Dishes로 — 요청한 요리 카탈로그가 가려지지 않게. */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

let mockParams: Record<string, string> = {};
jest.mock('expo-updates', () => ({ channel: 'development' })); // KB-870/P-527: 개발 기능 회귀. teamtest의 운영 숨김은 prodHide870에서 검사
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('@/components', () => {
  const { View } = jest.requireActual('react-native');
  return { StickyHeader: () => <View testID="sticky" />, useStickyScroll: () => ({ onScroll: undefined, hidden: false, atTop: true }), useHeaderHeight: () => 0 };
});
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useNotifications', () => ({ useUnreadCount: () => 0 }));
jest.mock('@/features/food/FoodExplorer', () => {
  const { View } = jest.requireActual('react-native');
  return { FoodExplorer: (p: { headTop: React.ReactNode }) => <View testID="dishes">{p.headTop}</View> };
});
jest.mock('@/features/processedFood/PackagedExplorer', () => {
  const { View, Pressable } = jest.requireActual('react-native');
  return {
    FoodSegmentRow: (p: { onChange: (s: string) => void }) => <Pressable testID="to-packaged" onPress={() => p.onChange('packaged')} />,
    PackagedExplorer: () => <View testID="packaged" />,
  };
});

// eslint-disable-next-line import/first -- jest.mock 뒤
import Food from '@/app/(tabs)/food';

const has = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string').length > 0;

it('Packaged 선택 → 같은 화면 재렌더엔 유지 · 새 See all(t) = Dishes · 같은 t 재렌더 = 다시 고른 Packaged 유지', () => {
  mockParams = {};
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<Food />); });
  expect(has(t, 'dishes')).toBe(true); // 기본 Dishes
  act(() => t.root.findAll((n) => n.props?.testID === 'to-packaged' && typeof n.props?.onPress === 'function')[0].props.onPress());
  expect(has(t, 'packaged')).toBe(true);
  act(() => t.update(<Food />));
  expect(has(t, 'packaged')).toBe(true);
  mockParams = { segment: 'saved', t: '1' };
  act(() => t.update(<Food />));
  expect(has(t, 'dishes')).toBe(true); // See all = 요리 카탈로그
  act(() => { /* 다시 Packaged로 */ });
  mockParams = { segment: 'saved', t: '1' };
  act(() => t.update(<Food />));
  expect(has(t, 'dishes')).toBe(true);
  act(() => t.unmount());
});
