/**
 * P-011(KB-178, B안): 선택 요약 = 고정 높이 1줄 가로 스크롤을 잠근다.
 * - 칩은 wrap(세로 증식)이 아니라 horizontal ScrollView 안 — 목록 밀림 없음
 * - 선택 순서 유지 (새 선택이 줄 끝 — 카탈로그 순서로 재정렬 금지)
 * - 0건이면 줄 미표시
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ScrollView } from 'react-native';

// P-174: 재료 카탈로그 훅 표면 목 — 폴백 경로(서버 무데이터) = 종전 렌더와 동일
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => (require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients')).ingredientLabel(c),
    imageUrl: () => null,
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// P-032: 칩 팝인/아웃이 reanimated를 끌어옴 — 표면 mock
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
    return b;
  };
  return {
    withRepeat: (v) => v,
    withSequence: (...vals) => vals[vals.length - 1],
    withDelay: (_d, v) => v,
    withTiming: (v) => v,
    cancelAnimation: () => {},
    useReducedMotion: () => false,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    ZoomIn: chain(),
    ZoomOut: chain(),
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k },
}));

import { IngredientFilter } from '../IngredientFilter';
import { INGREDIENTS, ingredientLabel } from '@/lib/mocks/ingredients';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

// P-177: 요약 칩 카드("You avoid n things"+×칩) 소멸 — 온보딩 Ob4Avoid 문법
// (검색 → "n selected"+Clear 카운트 줄 → 타일 그리드)으로 완전 통일.
const A = INGREDIENTS[5].code;

it('P-177: 요약 카드 소멸 — 가로 칩 ScrollView·×제거·placeholder 잔존 0', () => {
  const tree = render(<IngredientFilter selected={[A]} onToggle={() => {}} />);
  const { ScrollView: SV } = require('react-native');
  expect(tree.root.findAllByType(SV).filter((s2: { props: { horizontal?: boolean } }) => s2.props.horizontal)).toHaveLength(0);
  const flat = JSON.stringify(tree.toJSON());
  expect(flat).not.toContain('restrictionsEdit.avoidCount');
  expect(flat).not.toContain('restrictionsEdit.tapToRemove');
  expect(flat).not.toContain('restrictionsEdit.chipPlaceholder');
});

it('P-177: 카운트 줄 = 온보딩 문법 — n selected + Clear(0건은 안내문·Clear 미노출)', () => {
  const onClear = jest.fn();
  const tree = render(<IngredientFilter selected={[A]} onToggle={() => {}} onClear={onClear} />);
  const flat = JSON.stringify(tree.toJSON());
  expect(flat).toContain('onboarding.selectedCount');
  const clear = tree.root.findAll((n) => n.props?.testID === 'avoid-clear')[0];
  act(() => clear.props.onPress());
  expect(onClear).toHaveBeenCalled();
  const empty = render(<IngredientFilter selected={[]} onToggle={() => {}} onClear={onClear} />);
  const flatE = JSON.stringify(empty.toJSON());
  expect(flatE).toContain('onboarding.noneSelectedYet');
  expect(empty.root.findAll((n) => n.props?.testID === 'avoid-clear')).toHaveLength(0);
});

it('P-177: 타일 그리드·검색은 유지(공용 IngredientTileSections)', () => {
  const tree = render(<IngredientFilter selected={[A]} onToggle={() => {}} />);
  expect(tree.root.findAll((n) => n.props?.testID === `avtile-${A}`).length).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(tree.toJSON())).toContain('restrictionsEdit.searchPlaceholder');
});
