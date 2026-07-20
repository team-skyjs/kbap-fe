/**
 * P-011(KB-178, B안): 선택 요약 = 고정 높이 1줄 가로 스크롤을 잠근다.
 * - 칩은 wrap(세로 증식)이 아니라 horizontal ScrollView 안 — 목록 밀림 없음
 * - 선택 순서 유지 (새 선택이 줄 끝 — 카탈로그 순서로 재정렬 금지)
 * - 0건이면 줄 미표시
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ScrollView } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
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

it('0건이면 요약 줄 미표시', () => {
  const tree = render(<IngredientFilter selected={[]} onToggle={() => {}} />);
  expect(tree.root.findAllByType(ScrollView).filter((s) => s.props.horizontal)).toHaveLength(0);
});
