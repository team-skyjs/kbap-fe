/**
 * P-125(KB-240): 글래스 캡슐 마커 잠금 — 번호↔리스트 매핑 안정성(itemId 오름차순,
 * 배열 순서 무관), 글리프 4상태 형태 구분(색+형태 병행 — 헌법), 겹침 미세 오프셋
 * (사다리 폐기 — 한 단만), 미니시트 하이라이트/전 항목 유지.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import { assignScanNumbers, layoutCapsules, CapsuleGlyph, CAPSULE_H } from '../capsuleMarker';
import { ScanMiniSheet } from '../ScanMiniSheet';
import type { ResultDish } from '@/lib/scan/segmentMenu';

const dish = (itemId: number, risk: ResultDish['risk'] = 'safe', name = `dish${itemId}`): ResultDish => ({
  itemId,
  rawMenuName: name,
  box: { x: 0.1, y: 0.1 * itemId, width: 0.4, height: 0.06 },
  latin: null,
  priceKrw: null,
  risk,
  matched: true,
  foodId: String(itemId),
  displayName: name,
  koreanName: null,
});

const flat = (s: unknown) => StyleSheet.flatten(s) as Record<string, unknown>;

describe('번호 부여 — 스캔 항목 idx 기준 안정', () => {
  it('배열 순서와 무관하게 itemId 오름차순 1..n (미니시트 순번과 1:1 전제)', () => {
    const shuffled = [dish(3), dish(0), dish(7), dish(1)];
    const numbered = assignScanNumbers(shuffled);
    expect(numbered.map((d) => [d.itemId, d.no])).toEqual([[0, 1], [1, 2], [3, 3], [7, 4]]);
    // 같은 입력 재호출 = 같은 번호 (안정성)
    expect(assignScanNumbers([...shuffled].reverse()).map((d) => d.no)).toEqual([1, 2, 3, 4]);
  });
});

describe('겹침 — 미세 오프셋 한 단 (사다리 알고리즘 폐기)', () => {
  it('겹치면 아래로 한 단, 비겹침은 원위치 — 연쇄 하강 없음', () => {
    const a = { lx: 10, ty: 100, width: 40 };
    const b = { lx: 20, ty: 104, width: 40 }; // a와 겹침
    const c = { lx: 300, ty: 100, width: 40 }; // 멀리 — 무이동
    const out = layoutCapsules([a, b, c]);
    const byLx = Object.fromEntries(out.map((o) => [o.lx, o.ty]));
    expect(byLx[10]).toBe(100);
    expect(byLx[20]).toBe(104 + CAPSULE_H - 6); // 한 단
    expect(byLx[300]).toBe(100);
  });
});

describe('글리프 4상태 — 색+형태 병행 (색맹 구분)', () => {
  const render = (el: React.ReactElement) => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(el);
    });
    return tree;
  };

  it('안전=원 · 주의=사각 · 회피=45° 마름모 · 정보없음=물음표', () => {
    const safe = render(<CapsuleGlyph risk="safe" />).root.findByProps({ testID: 'glyph-safe' });
    expect(flat(safe.props.style).borderRadius).toBe(5); // 원(9×9의 절반 이상)
    const caution = render(<CapsuleGlyph risk="caution" />).root.findByProps({ testID: 'glyph-caution' });
    expect(flat(caution.props.style).borderRadius).toBe(2); // 사각
    const danger = render(<CapsuleGlyph risk="danger" />).root.findByProps({ testID: 'glyph-danger' });
    expect(flat(danger.props.style).transform).toEqual([{ rotate: '45deg' }]); // 마름모
    const unable = render(<CapsuleGlyph risk="unable" />);
    expect(unable.root.findAll((n) => n.props?.children === '?').length).toBeGreaterThanOrEqual(1);
  });
});

describe('미니시트 — 하이라이트·전 항목 유지', () => {
  const render = (el: React.ReactElement) => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(el);
    });
    return tree;
  };
  const numbered = assignScanNumbers([dish(0), dish(1, 'danger'), dish(2, 'caution')]);
  const extras = [{ ...dish(-1, 'unable', 'photo-only-dish'), box: { x: 0, y: 0, width: 0, height: 0 } }];

  it('highlightId 행 = 목업 hl 스타일(#fdf0e6+아웃라인)', () => {
    const tree = render(
      <ScanMiniSheet numbered={numbered} extras={extras} highlightId={1} riskLabel={(r) => r} onRowPress={jest.fn()} bottomOffset={0} />,
    );
    const hlRow = tree.root.findByProps({ testID: 'sheet-row-1' });
    expect(flat(hlRow.props.style).backgroundColor).toBe('#fdf0e6');
    const other = tree.root.findByProps({ testID: 'sheet-row-0' });
    expect(flat(other.props.style).backgroundColor).toBeUndefined();
  });

  it('확장 시 전 항목 — photoOnly(번호 없음 "–" 칩) 포함, 접힘 시 번호 항목만', () => {
    const collapsed = render(
      <ScanMiniSheet numbered={numbered} extras={extras} highlightId={null} riskLabel={(r) => r} onRowPress={jest.fn()} bottomOffset={0} />,
    );
    expect(collapsed.root.findAll((n) => n.props?.testID === 'sheet-row--1')).toHaveLength(0);
    const expanded = render(
      <ScanMiniSheet numbered={numbered} extras={extras} highlightId={null} riskLabel={(r) => r} onRowPress={jest.fn()} bottomOffset={0} initiallyExpanded />,
    );
    expect(expanded.root.findAll((n) => n.props?.testID === 'sheet-row--1').length).toBeGreaterThanOrEqual(1);
    const dash = expanded.root.findByProps({ testID: 'sheet-row--1' });
    expect(dash.findAll((n) => n.props?.children === '–').length).toBeGreaterThanOrEqual(1); // 번호 없음 칩
  });

  it('행 탭 = onRowPress(상세 이동은 시트 몫 — 캡슐 탭은 하이라이트 전용)', () => {
    const onRow = jest.fn();
    const tree = render(
      <ScanMiniSheet numbered={numbered} extras={[]} highlightId={null} riskLabel={(r) => r} onRowPress={onRow} bottomOffset={0} />,
    );
    act(() => tree.root.findByProps({ testID: 'sheet-row-2' }).props.onPress());
    expect(onRow).toHaveBeenCalledWith(expect.objectContaining({ itemId: 2 }));
  });
});
