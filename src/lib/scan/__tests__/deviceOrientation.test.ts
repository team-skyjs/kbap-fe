/**
 * P-022(KB-198): 중력 벡터 → 화면 방향 판정 경계를 잠근다.
 * 임계각(35°)+flat 가드 — 45° 근처 떨림·화면 위/아래 향함에서 portrait로 수렴.
 */
import { orientationFromGravity } from '../deviceOrientation';

// 세로 기준(x=오른쪽+, y=위+): 세워 들면 g=(0,-9.8). ±각도로 기울인 중력 성분.
const G = 9.8;
const tilt = (deg: number) => {
  const r = (deg * Math.PI) / 180;
  // 오른쪽으로 deg 눕히면 x가 음(-sin), y도 음(-cos) — landscapeLeft 방향
  return { x: -G * Math.sin(r), y: -G * Math.cos(r) };
};

describe('orientationFromGravity', () => {
  it('세워 들면(0°) portrait', () => {
    expect(orientationFromGravity({ x: 0, y: -G })).toBe('portrait');
  });

  it('임계각(35°) 미만 기울기는 portrait 유지 (떨림 방지)', () => {
    expect(orientationFromGravity(tilt(20))).toBe('portrait');
    expect(orientationFromGravity(tilt(34))).toBe('portrait');
  });

  it('임계각 이상 → 가로: x<0 landscapeLeft / x>0 landscapeRight', () => {
    expect(orientationFromGravity(tilt(60))).toBe('landscapeLeft'); // 오른쪽 눕힘, x<0
    expect(orientationFromGravity({ x: G, y: 0 })).toBe('landscapeRight'); // 왼쪽 눕힘(90°), x>0
    expect(orientationFromGravity({ x: -G, y: 0 })).toBe('landscapeLeft'); // 오른쪽 눕힘(90°)
  });

  it('화면 위/아래로 향해 눕히면(x·y 미약) portrait — flat 가드', () => {
    expect(orientationFromGravity({ x: 0.2, y: -0.3 })).toBe('portrait');
    expect(orientationFromGravity({ x: 0, y: 0 })).toBe('portrait');
  });

  it('portraitUpsideDown 계열(y>0)도 좌우 기울기 기준 판정', () => {
    // 거꾸로 세움(180°): x≈0, y≈+G → 세로 종횡비라 portrait
    expect(orientationFromGravity({ x: 0, y: G })).toBe('portrait');
  });
});
