/**
 * zoom.ts — 스캔 결과 핀치 줌/팬 클램프 (P-064④, 순수 함수 — 유닛 잠금).
 * 스케일 1~4, 팬은 확대분의 절반(경계 밖 이동 금지). 더블탭 토글 목표 2.5x.
 */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const DOUBLE_TAP_ZOOM = 2.5;

export function clampScale(s: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));
}

/** 축 하나의 팬 클램프 — 확대로 생긴 여분(절반)까지만. scale<=1이면 0. */
export function clampPan(t: number, scale: number, dim: number): number {
  const max = Math.max(0, ((scale - 1) * dim) / 2);
  return Math.min(max, Math.max(-max, t));
}
