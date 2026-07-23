/**
 * P-064④: 핀치 줌/팬 클램프 잠금 — 1~4x, 팬은 확대분 절반, 미확대=0.
 */
import { clampPan, clampScale, DOUBLE_TAP_ZOOM, ZOOM_MAX, ZOOM_MIN } from '../zoom';

it('스케일 클램프 1~4 (더블탭 목표 2.5는 범위 내)', () => {
  expect(clampScale(0.3)).toBe(ZOOM_MIN);
  expect(clampScale(2.5)).toBe(2.5);
  expect(clampScale(9)).toBe(ZOOM_MAX);
  expect(clampScale(DOUBLE_TAP_ZOOM)).toBe(DOUBLE_TAP_ZOOM);
});

it('팬 클램프: 확대분의 절반까지, 미확대(1x)=0 고정', () => {
  expect(clampPan(999, 2, 400)).toBe(200);
  expect(clampPan(-999, 2, 400)).toBe(-200);
  expect(clampPan(150, 2, 400)).toBe(150);
  expect(clampPan(50, 1, 400)).toBe(0);
  expect(clampPan(-50, 0.9, 400)).toBe(-0);
});
