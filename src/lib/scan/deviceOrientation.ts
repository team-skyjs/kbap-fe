/**
 * deviceOrientation.ts — 중력 벡터 → 화면 방향 판정 (KB-198/P-022).
 *
 * Android는 expo-camera의 responsiveOrientation 콜백이 없어(@platform ios) 스캔의
 * 세로 유도 힌트가 미동작 → DeviceMotion 중력(accelerationIncludingGravity)으로
 * 물리 방향을 직접 판정한다. 앱은 세로 고정을 유지하고 힌트만 반응(iOS와 동일).
 *
 * 좌표계(expo-sensors, 세로 기준): x=오른쪽+, y=위쪽+. 세워 들면 g는 -y로(y≈-9.8),
 * 오른쪽으로 눕히면 g는 -x(x≈-9.8)=landscapeLeft, 왼쪽으로 눕히면 x≈+9.8=landscapeRight.
 * (KB-141 오버레이의 rotate 부호와 일치: landscapeLeft→+90°, landscapeRight→-90°)
 */

export type ScreenOrientation = 'portrait' | 'landscapeLeft' | 'landscapeRight';

export interface Gravity {
  x: number;
  y: number;
}

/**
 * 중력 벡터 → 방향. **임계각 THRESHOLD_DEG로 45° 근처 떨림 방지**:
 * |x| 성분이 임계 이상 우세할 때만 가로로 판정, 아니면 portrait 유지(히스테리시스).
 * 화면을 위/아래로 향하게 눕히면(g가 z축) x·y 모두 작아 portrait로 수렴 — 안전.
 */
export function orientationFromGravity(g: Gravity, thresholdDeg = 35): ScreenOrientation {
  const mag = Math.hypot(g.x, g.y);
  if (mag < 1) return 'portrait'; // flat(위/아래 향함) — 기울기 정보 없음
  // 수직에서 벗어난 각(기기를 세운 상태 대비 좌우 기울기): atan2(|x|, |y|)
  const tiltDeg = (Math.atan2(Math.abs(g.x), Math.abs(g.y)) * 180) / Math.PI;
  if (tiltDeg < thresholdDeg) return 'portrait';
  return g.x < 0 ? 'landscapeLeft' : 'landscapeRight';
}
