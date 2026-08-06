/**
 * cameraZoom (P-131) — 스캔 카메라 줌 순수 로직.
 *
 * CameraView zoom prop = 0~1 상대값(플랫폼별 실배율 상이) — 프리셋은 근사 상수
 * (2x ≈ 0.15, 예진 실기 튜닝 여지). 핀치는 배율 델타를 0~1 축으로 환산해 누적,
 * 항상 clamp01 방어.
 */
export const CAM_ZOOM_PRESETS = { x1: 0, x2: 0.15 } as const;
export type CamZoomPreset = keyof typeof CAM_ZOOM_PRESETS;

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 핀치 스케일(1=무변) → 줌 누적 — 감도 0.5/배율. */
export const pinchToZoom = (base: number, scale: number): number => clamp01(base + (scale - 1) * 0.5);

/** 프리셋 하이라이트 판정 — 핀치로 근처에 오면 그 프리셋 활성 표기. */
export const activePreset = (zoom: number): CamZoomPreset | null => {
  if (Math.abs(zoom - CAM_ZOOM_PRESETS.x1) < 0.02) return 'x1';
  if (Math.abs(zoom - CAM_ZOOM_PRESETS.x2) < 0.02) return 'x2';
  return null;
};

/** 기기 방향 → UI 요소 제자리 회전각(90° 스냅 — iOS 카메라 문법). */
export const uiRotationDeg = (o: string): number =>
  o === 'landscapeLeft' ? 90 : o === 'landscapeRight' ? -90 : 0;
