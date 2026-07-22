/**
 * P-055(KB-225): 안드 하단 내비바 클리어런스 분기 잠금.
 * 안드 = max(bottom, 48) floor / iOS = 실측 통과(무회귀).
 */
import { bottomInsetFloor, ANDROID_BOTTOM_MIN } from '../useBottomInset';

it('안드: 과소보고(0)·부분(24) → 48 floor, 초과(60)는 실측 유지', () => {
  expect(bottomInsetFloor(0, 'android')).toBe(ANDROID_BOTTOM_MIN);
  expect(bottomInsetFloor(24, 'android')).toBe(ANDROID_BOTTOM_MIN);
  expect(bottomInsetFloor(60, 'android')).toBe(60);
});

it('iOS: 실측 그대로 통과 (0/34)', () => {
  expect(bottomInsetFloor(0, 'ios')).toBe(0);
  expect(bottomInsetFloor(34, 'ios')).toBe(34);
});
