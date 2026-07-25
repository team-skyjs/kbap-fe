/**
 * P-070(KB-240): 마커 사다리 버그 잠금.
 * 재현 픽스처 = 원거리 촬영 조밀 2열(줄 간격 18pt < PILL_H, 열 간격 145pt < 구 X_CLUSTER 150).
 */
import { estimatePillWidth, layoutPills, PILL_H } from '../pillLayout';

/** 구 알고리즘(ScanResultOverlay 인라인이던 것) — 가설 검증용 사본. */
function legacyLayout(items: { lx: number; ty: number }[]): { lx: number; ty: number }[] {
  const X_CLUSTER = 150;
  const placed: { lx: number; ty: number }[] = [];
  return items.map((it) => {
    let ty = it.ty;
    let guard = 0;
    while (guard++ < items.length && placed.some((p) => Math.abs(p.ty - ty) < PILL_H && Math.abs(p.lx - it.lx) < X_CLUSTER)) {
      ty += PILL_H;
    }
    placed.push({ lx: it.lx, ty });
    return { lx: it.lx, ty };
  });
}

// 조밀 2열: 6줄 × 2열, 줄 18pt 간격·열 145pt 간격, 이름 4자(추정 폭 ~98pt → 열 비교차)
const dense = Array.from({ length: 6 }, (_, row) =>
  [20, 165].map((lx) => ({ lx, ty: row * 18, width: estimatePillWidth('김치찌개') })),
).flat();

it('가설 검증: 구 알고리즘은 조밀 2열에서 연쇄 사다리 (누적 이동 ≥ 3단)', () => {
  const out = legacyLayout(dense);
  const shifts = out.map((p, i) => p.ty - dense[i].ty);
  expect(Math.max(...shifts)).toBeGreaterThanOrEqual(3 * PILL_H); // 열 병합 + 연쇄 스태거
});

it('보수: 실폭 판정 + 1단 상한 — 이동은 원 앵커에서 최대 PILL_H, 좌우 열 비간섭', () => {
  const out = layoutPills(dense);
  out.forEach((p, i) => {
    expect(Math.abs(p.ty - dense[i].ty)).toBeLessThanOrEqual(PILL_H); // 사다리 0
  });
  // 열 비간섭: 왼쪽 열만 배치했을 때와 2열 동시 배치의 왼쪽 열 결과가 동일
  const leftOnly = layoutPills(dense.filter((d) => d.lx === 20));
  const leftInBoth = out.filter((d) => d.lx === 20);
  expect(leftInBoth.map((p) => p.ty)).toEqual(leftOnly.map((p) => p.ty));
});

it('근접 무회귀: 성긴 배치(세로 여유·좁은 이름)는 이동 0', () => {
  const sparse = [
    { lx: 30, ty: 100, width: estimatePillWidth('된장찌개') },
    { lx: 30, ty: 160, width: estimatePillWidth('김치찌개') },
    { lx: 30, ty: 220, width: estimatePillWidth('공기밥') },
  ];
  expect(layoutPills(sparse).map((p) => p.ty)).toEqual([100, 160, 220]);
});

it('겹침 방지 자체는 유지: 같은 줄 실폭 교차 → 1단 스태거', () => {
  const w = estimatePillWidth('Doenjang Jjigae Stew');
  const same = [
    { lx: 20, ty: 50, width: w },
    { lx: 40, ty: 50, width: w }, // 실폭 교차
  ];
  const out = layoutPills(same);
  expect(out[0].ty).toBe(50);
  expect(out[1].ty).toBe(50 + PILL_H);
});

it('estimatePillWidth — 전각>반각 가중, 상한 = PILL_MAX_W(150, P-072)', () => {
  expect(estimatePillWidth('김치찌개')).toBeGreaterThan(estimatePillWidth('abcd'));
  expect(estimatePillWidth('아주아주아주아주긴한국음식이름입니다만')).toBe(150);
});

// P-072: 긴 영문명도 상한(150)에 잘려 열 경계를 못 넘는다
it('P-072 긴 영문명 2열 — 상한 말줄임으로 열 비교차·스태거 0', () => {
  const name = 'Crab Meat Oyster Sauce Pasta'; // 추정 원폭 244 → 상한 150
  expect(estimatePillWidth(name)).toBe(150);
  const twoCol = Array.from({ length: 4 }, (_, row) =>
    [20, 180].map((lx) => ({ lx, ty: row * 36, width: estimatePillWidth(name) })),
  ).flat();
  const out = layoutPills(twoCol);
  out.forEach((p, i) => expect(p.ty).toBe(twoCol[i].ty)); // 전 마커 정위치
});
