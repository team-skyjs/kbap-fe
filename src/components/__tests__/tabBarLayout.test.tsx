/**
 * P-118(테플 빌드14 반려): 탭바 레이아웃 잠금 — 바 직계 자식 = **5슬롯 전부
 * flex:1**(균등 분배). P-110의 양측 flex 래퍼(좌우 묶음 1/3 분배 → 간격 불균등)
 * 재발 방지. + 높이 -4pt(paddingTop 6·gap 2).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { TabBar, TABBAR_CONTENT_H, TABBAR_V_SHIFT, FAB_OVERHANG } from '../TabBar';

const LABELS = { home: 'H', food: 'F', scan: 'S', community: 'C', profile: 'P' };
const flat = (s: unknown) => StyleSheet.flatten(s) as Record<string, unknown>;

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<TabBar active="home" labels={LABELS} onPress={jest.fn()} onScan={jest.fn()} />);
  });
  return tree;
}

it('바 직계 자식 = 5슬롯 전부 flex:1 — 래퍼 없음(균등 분배 원복)', () => {
  const tree = render();
  const bar = tree.root.findAll((n) => n.type === 'View' && flat(n.props.style)?.borderTopWidth != null)[0];
  const slots = bar.children.filter((c) => typeof c !== 'string');
  expect(slots).toHaveLength(5); // home·food·FAB·community·profile — 묶음 래퍼면 3이 된다
  for (const slot of slots) {
    // 컴포지트(Tab)는 호스트 루트로 내려가 flex 확인 — 어느 슬롯도 묶음 래퍼(비 flex:1) 금지
    const el = slot as { type: unknown; props: { style?: unknown }; children: unknown[] };
    const host = typeof el.type === 'string' ? el : (el.children[0] as { props: { style?: unknown } });
    expect(flat(host.props.style).flex).toBe(1);
  }
});

it('P-128: 바 높이 = 플랫폼 상수(iOS 49)+세이프에어리어 — FAB 레이아웃 미기여', () => {
  const tree = render();
  const bar = tree.root.findAll((n) => n.type === 'View' && flat(n.props.style)?.borderTopWidth != null)[0];
  const st = flat(bar.props.style);
  // 테스트 인셋 bottom 0 → pb=10, 높이 = 49+10 (jest 플랫폼 ios)
  expect(st.height).toBe(TABBAR_CONTENT_H + 10);
  expect(TABBAR_CONTENT_H).toBe(49); // iOS HIG 공식(P-146 재확인 — 안드는 M3 80)
  // FAB = 절대 배치(레이아웃 흐름 밖) — 바 높이를 견인하지 않는다
  const fab = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && flat(n.props.style)?.borderRadius === 28)[0];
  expect(flat(fab.props.style).position).toBe('absolute');
});

it('P-146: 콘텐츠 존 시각 센터 보정 — 존 높이 불변(하향 시프트) + FAB 돌출 24', () => {
  const tree = render();
  const bar = tree.root.findAll((n) => n.type === 'View' && flat(n.props.style)?.borderTopWidth != null)[0];
  const st = flat(bar.props.style);
  // 존 높이 = height − paddingTop − paddingBottom = CONTENT_H (시프트가 존을 줄이지 않는다)
  expect((st.height as number) - (st.paddingTop as number) - (st.paddingBottom as number)).toBe(TABBAR_CONTENT_H);
  expect(st.paddingTop).toBe(TABBAR_V_SHIFT); // iOS 6pt 하향(예진 "위로 몰림" 보정)
  const fab = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && flat(n.props.style)?.borderRadius === 28)[0];
  expect(flat(fab.props.style).top).toBe(-FAB_OVERHANG);
  expect(FAB_OVERHANG).toBe(24); // 전 30 → 24 완화
});
