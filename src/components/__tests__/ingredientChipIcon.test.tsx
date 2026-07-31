/**
 * P-103(Q-23): 재료 칩 +/✓ 아이콘 = 고정 폭 슬롯 잠금 — 선택 토글 시 칩 총폭
 * 불변(✓13 vs +12 글리프 폭 차가 칩을 1pt 키우던 반려). 텍스트 웨이트도 양
 * 상태 동일(bodyBold) 확인 — 폭 변인은 아이콘 슬롯뿐이어야 한다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k },
}));

import { IngredientFilter } from '../IngredientFilter';
import { INGREDIENTS } from '@/lib/mocks/ingredients';

const flat = (s: unknown) => StyleSheet.flatten(s) as Record<string, unknown>;
const CODE = INGREDIENTS[0].code;

async function render(selected: string[]): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<IngredientFilter selected={selected} onToggle={jest.fn()} />);
  });
  return tree;
}

/** 카탈로그 첫 칩(Pressable)과 그 아이콘 슬롯/텍스트를 찾는다. */
function firstChip(tree: ReactTestRenderer) {
  const chip = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && flat(n.props.style)?.borderWidth === 1.5)[0];
  const slot = chip.findAll((n) => n.type === 'View' && flat(n.props.style)?.width != null)[0];
  const text = chip.findAll((n) => n.type === 'Text')[0];
  return { slot: flat(slot.props.style), text: flat(text.props.style) };
}

it('아이콘 슬롯 = 고정 폭 — 선택/해제 동일 (칩 총폭 불변 잠금)', async () => {
  const off = firstChip(await render([]));
  const on = firstChip(await render([CODE]));
  expect(off.slot.width).toBe(16);
  expect(on.slot.width).toBe(16); // ✓든 +든 슬롯 폭 동일 → 칩 프레임 이동 0
});

it('텍스트 웨이트 = 양 상태 동일 (폰트로 인한 폭 변화 없음)', async () => {
  const off = firstChip(await render([]));
  const on = firstChip(await render([CODE]));
  expect(on.text.fontFamily).toBe(off.text.fontFamily);
  expect(on.text.fontSize).toBe(off.text.fontSize);
});
