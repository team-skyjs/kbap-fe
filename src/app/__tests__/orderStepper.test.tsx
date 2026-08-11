/**
 * P-032(KB-207): 주문카드 수량 스테퍼 — 팝 래퍼(bump) 도입 후에도 동작 불변 잠금.
 * 1~5 클램프, 경계에서 비활성, 문장의 {n}개 즉시 반영.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// P-174: 재료 카탈로그 훅 표면 목 — 폴백 경로(서버 무데이터) = 종전 렌더와 동일
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => (require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients')).ingredientLabel(c),
    imageUrl: () => null,
  }),
}));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: '7' }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: {
    language: 'en',
    t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
    getFixedT: () => (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
  },
}));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', script: 'latin' }) }));
jest.mock('@/lib/data/useFoods', () => ({
  useFoodDetail: () => ({ data: { nameKo: '김치찌개' } }),
}));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { restrictions: [] } }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import OrderCard from '../food/[id]/order';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
// P-136: Done이 Btn(disabled 보유)으로 바뀌어 disabled 휴리스틱이 오탐 — testID 명시
const stepBtns = (t: ReactTestRenderer) => [
  t.root.findAll((n) => n.props?.testID === 'qty-dec' && typeof n.props?.onPress === 'function')[0],
  t.root.findAll((n) => n.props?.testID === 'qty-inc' && typeof n.props?.onPress === 'function')[0],
];

it('+/−가 문장 {n}개를 갱신하고 1~5에서 클램프·비활성', () => {
  const tree = render(<OrderCard />);
  expect(flat(tree)).toContain('1개 주세요.');
  // − / + 버튼: disabled prop을 가진 onPress 노드 2개 (순서: −, +)
  const btns = stepBtns(tree);
  expect(btns.length).toBeGreaterThanOrEqual(2);
  const [dec, inc] = [btns[0], btns[btns.length - 1]];
  expect(dec.props.disabled).toBe(true); // qty=1 — 하한 비활성
  act(() => inc.props.onPress());
  expect(flat(tree)).toContain('2개 주세요.');
  for (let i = 0; i < 5; i++) act(() => stepBtns(tree)[stepBtns(tree).length - 1].props.onPress());
  expect(flat(tree)).toContain('5개 주세요.'); // 상한 클램프
  expect(stepBtns(tree)[stepBtns(tree).length - 1].props.disabled).toBe(true);
  act(() => stepBtns(tree)[0].props.onPress());
  expect(flat(tree)).toContain('4개 주세요.');
});
