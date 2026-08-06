/**
 * P-131: 카메라 줌·UI 회전 순수 로직 잠금 — 프리셋 매핑/클램프/핀치 누적/회전각.
 */
import { activePreset, CAM_ZOOM_PRESETS, clamp01, pinchToZoom, uiRotationDeg } from '../cameraZoom';

it('프리셋 매핑 — 1x=0 · 2x=근사 상수, 하이라이트 판정(근처 포함)', () => {
  expect(CAM_ZOOM_PRESETS.x1).toBe(0);
  expect(activePreset(0)).toBe('x1');
  expect(activePreset(CAM_ZOOM_PRESETS.x2)).toBe('x2');
  expect(activePreset(CAM_ZOOM_PRESETS.x2 + 0.01)).toBe('x2'); // 핀치로 근처
  expect(activePreset(0.5)).toBe(null);
});

it('핀치 누적 — 확대/축소·0~1 클램프 방어', () => {
  expect(pinchToZoom(0, 1)).toBe(0); // 무변
  expect(pinchToZoom(0, 1.4)).toBeCloseTo(0.2);
  expect(pinchToZoom(0.5, 0.6)).toBeCloseTo(0.3);
  expect(pinchToZoom(0.9, 3)).toBe(1); // 상한
  expect(pinchToZoom(0.1, 0.1)).toBe(0); // 하한
  expect(clamp01(-1)).toBe(0);
  expect(clamp01(2)).toBe(1);
});

it('UI 회전각 — 90° 스냅 (landscapeLeft 90 · Right -90 · 그 외 0)', () => {
  expect(uiRotationDeg('landscapeLeft')).toBe(90);
  expect(uiRotationDeg('landscapeRight')).toBe(-90);
  expect(uiRotationDeg('portrait')).toBe(0);
  expect(uiRotationDeg('portraitUpsideDown')).toBe(0);
});
