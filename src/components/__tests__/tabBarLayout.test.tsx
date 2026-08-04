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

import { TabBar } from '../TabBar';

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

it('높이 -4pt — paddingTop 6·아이콘/라벨 gap 2 (터치는 행 전체+hitSlop)', () => {
  const tree = render();
  const bar = tree.root.findAll((n) => n.type === 'View' && flat(n.props.style)?.borderTopWidth != null)[0];
  expect(flat(bar.props.style).paddingTop).toBe(6);
  const tab = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && flat(n.props.style)?.flex === 1)[0];
  expect(flat(tab.props.style).gap).toBe(2);
});
