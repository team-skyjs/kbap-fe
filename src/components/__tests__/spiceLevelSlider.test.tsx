/**
 * P-088⑤(KB-261): 슬라이더 레이아웃 스냅샷 잠금 — 선택 변경 시 **다른 요소
 * 이동 0**(틱 absolute 고정), 시안 문법(중간 틱 3개·잉크 보더 노브·라벨 5개
 * 전부·선택 볼드), 릴리즈 스냅.
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

import { SpiceLevelSlider } from '../SpiceLevelSlider';
import type { SpiceLevel } from '@/lib/spice';

const W = 300;

async function render(level: SpiceLevel | null, onChange = jest.fn()): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<SpiceLevelSlider level={level} onChange={onChange} />);
  });
  // 트랙 onLayout 발화 — trackW 확정
  const trackBox = tree.root.findAll((n) => typeof n.props?.onLayout === 'function')[0];
  await act(async () => {
    trackBox.props.onLayout({ nativeEvent: { layout: { width: W, height: 44 } } });
  });
  return tree;
}

const flat = (s: unknown) => StyleSheet.flatten(s) as Record<string, unknown>;
const ticksOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAll((n) => n.type === 'View' && flat(n.props.style)?.width === 2)
    .map((n) => flat(n.props.style).left as number);
const knobOf = (tree: ReactTestRenderer) => {
  const k = tree.root.findAll((n) => n.type === 'View' && flat(n.props.style)?.borderRadius === 13);
  return k.length ? (flat(k[0].props.style).left as number) : null;
};

it('중간 틱 3개 = i×25% 절대 고정 — 선택이 바뀌어도 좌표 동일(이동 0)', async () => {
  const a = await render('NONE');
  const b = await render('HOT');
  const expected = [1, 2, 3].map((i) => (W * i) / 4 - 1); // toX(i) - 1
  expect(ticksOf(a)).toEqual(expected);
  expect(ticksOf(b)).toEqual(expected); // 선택 무관 동일 — 레이아웃 스냅샷 잠금
});

it('노브 = 선택 스톱 위치만 이동 · 미설정(null)은 노브 없음', async () => {
  expect(knobOf(await render('NONE'))).toBe(0 - 13);
  expect(knobOf(await render('HOT'))).toBe((W * 3) / 4 - 13);
  expect(knobOf(await render(null))).toBe(null);
});

it('라벨 5개 전부 렌더 — 선택(MEDIUM)만 강조 스타일', async () => {
  const tree = await render('MEDIUM');
  // Txt 래퍼 중첩 — 호스트 Text 노드만 (라벨당 1)
  const labels = tree.root.findAll((n) => n.type === 'Text' && typeof n.props?.adjustsFontSizeToFit === 'boolean');
  expect(labels).toHaveLength(5);
  const byKey = Object.fromEntries(labels.map((n) => [n.props.children, flat(n.props.style)]));
  expect(byKey['spice.band.2'].color).not.toBe(byKey['spice.band.0'].color); // 선택 잉크 vs 비선택 회색
  expect(byKey['spice.band.2'].fontWeight).not.toBe(byKey['spice.band.0'].fontWeight); // 볼드 전환 (P-135: 시스템 폰트 = weight 위계)
});

it('릴리즈 = 최근접 스톱 스냅 (트랙 레벨 제스처 — 개별 탭 타깃 없음)', async () => {
  const onChange = jest.fn();
  const tree = await render('NONE', onChange);
  const trackBox = tree.root.findAll((n) => typeof n.props?.onResponderRelease === 'function')[0];
  await act(async () => {
    trackBox.props.onResponderRelease({ nativeEvent: { pageX: 230 } }); // P-098: pageX 기반 (offset 0) — 230/300*4 ≈ 3.07 → HOT
  });
  expect(onChange).toHaveBeenCalledWith('HOT');
});
