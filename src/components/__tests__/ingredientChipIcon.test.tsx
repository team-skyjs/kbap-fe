/**
 * P-103(Q-23) → P-150 ①: 회피 카탈로그가 칩 → 온보딩 공용 사진 타일로 교체 —
 * 프레임 불변 잠금 승계: 선택 토글 = 체크 오버레이(absolute)+색만, 타일 메트릭
 * (보더 폭·비율·라운딩) 불변. 요약 칩·검색은 현행 유지 확인.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

// P-174: 재료 카탈로그 훅 표면 목 — 폴백 경로(서버 무데이터) = 종전 렌더와 동일
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => (require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients')).ingredientLabel(c),
    imageUrl: () => null,
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k },
}));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', script: 'latin' }) }));

import { IngredientFilter } from '../IngredientFilter';

const flat = (s: unknown) => StyleSheet.flatten(s) as Record<string, unknown>;

function Host({ initial = [] as string[] }) {
  const [sel, setSel] = React.useState<string[]>(initial);
  return <IngredientFilter selected={sel} onToggle={(c) => setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))} />;
}

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('P-150: 카탈로그 = 온보딩 공용 사진 타일(카테고리 섹션) — 구 플랫 칩 소멸, 요약·검색 유지', () => {
  const tree = render(<Host />);
  const s = JSON.stringify(tree.toJSON());
  // 타일 렌더(공용 컴포넌트 — avoid-* testID) + 카테고리 헤더 키
  expect(tree.root.findAll((n) => n.props?.testID === 'avoid-EGG').length).toBeGreaterThanOrEqual(1);
  expect(s).toContain('ingCat.');
  // 요약 카드·검색 현행 유지
  expect(s).toContain('restrictionsEdit.avoidNone');
  expect(s).toContain('restrictionsEdit.searchPlaceholder');
});

it('타일 프레임 불변(P-103 승계) — 선택 토글 = 체크 오버레이+색만, 보더 폭·비율 동일', () => {
  const tree = render(<Host />);
  const tileStyle = () => flat(tree.root.findAll((n) => n.props?.testID === 'avtile-EGG')[0].props.style);
  const before = tileStyle();
  const egg = tree.root.findAll((n) => n.props?.testID === 'avoid-EGG' && typeof n.props?.onPress === 'function')[0];
  act(() => egg.props.onPress());
  const after = tileStyle();
  // 메트릭 불변 — 상태 차이는 borderColor뿐
  expect(after.borderWidth).toBe(before.borderWidth);
  expect(after.aspectRatio).toBe(before.aspectRatio);
  expect(after.borderRadius).toBe(before.borderRadius);
  expect(after.borderColor).not.toBe(before.borderColor); // 선택 = 색 전환
  // 체크 오버레이 = absolute(프레임 미기여)
  const check = tree.root.findAll((n) => flat(n.props?.style ?? {}).position === 'absolute' && flat(n.props?.style ?? {}).top === 5);
  expect(check.length).toBeGreaterThanOrEqual(1);
});
