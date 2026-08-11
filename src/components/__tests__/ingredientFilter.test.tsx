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

// 카탈로그 순서와 다른 삽입 순서 (뒤 항목을 먼저 선택)
const A = INGREDIENTS[5].code;
const B = INGREDIENTS[0].code;

it('선택 요약이 horizontal ScrollView 1줄로 렌더되고 선택 순서를 유지한다', () => {
  const tree = render(<IngredientFilter selected={[A, B]} onToggle={() => {}} />);
  const rows = tree.root.findAllByType(ScrollView).filter((s) => s.props.horizontal);
  expect(rows).toHaveLength(1);
  // 줄 안의 칩 텍스트가 삽입 순서 [A, B] 그대로 (카탈로그 순서 [B, A] 아님)
  const chipTexts = rows[0]
    .findAll((n) => typeof n.props?.children === 'string')
    .map((n) => n.props.children as string)
    .filter((s) => [ingredientLabel(A), ingredientLabel(B)].includes(s));
  // Txt 래핑으로 같은 문자열이 중첩 노드에 반복 — 등장 순서만 잠근다
  expect([...new Set(chipTexts)]).toEqual([ingredientLabel(A), ingredientLabel(B)]);
});

// P-026(KB-178 재수정): 0건일 때 칩 ScrollView는 없지만 **칩 영역은 고정 높이로
// 존재**(placeholder) — 0→1 전환에 레이아웃 점프가 없도록.
it('0건: 칩 ScrollView 미렌더 + 고정높이(36) 영역에 placeholder', () => {
  const tree = render(<IngredientFilter selected={[]} onToggle={() => {}} />);
  expect(tree.root.findAllByType(ScrollView).filter((s) => s.props.horizontal)).toHaveLength(0);
  // placeholder 텍스트 렌더
  const ph = tree.root.findAll((n) => n.props?.children === 'restrictionsEdit.chipPlaceholder');
  expect(ph.length).toBeGreaterThanOrEqual(1);
});

it('0↔1 전환: 칩 영역 높이 불변 (고정 36) — 목록 밀림 0의 근거', () => {
  const heightOf = (sel: string[]) => {
    const tree = render(<IngredientFilter selected={sel} onToggle={() => {}} />);
    // chipArea = height 36 고정 View (placeholder/ScrollView 공통 래퍼)
    const areas = tree.root.findAll((n) => {
      const s = Array.isArray(n.props?.style) ? Object.assign({}, ...n.props.style) : n.props?.style;
      return s && s.height === 36 && s.justifyContent === 'center';
    });
    return areas.length ? 36 : null;
  };
  expect(heightOf([])).toBe(36);
  expect(heightOf([INGREDIENTS[0].code])).toBe(36); // 1건도 동일 높이
});
