/**
 * useBottomInset — Android 하단 내비바 클리어런스 공용 보정 (P-055/KB-225).
 * edge-to-edge에서 일부 안드 기기(3버튼 내비 등)가 insets.bottom을 0으로
 * 과소보고 → 하단 고정 UI가 내비바에 짤린다(P-021 온보딩 국소 처치의 전수판).
 * 안드는 48 floor, iOS는 실측 그대로(무회귀).
 */
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ANDROID_BOTTOM_MIN = 48;

/** 순수 분기 — 테스트 잠금용 분리 */
export function bottomInsetFloor(bottom: number, os: string = Platform.OS): number {
  return os === 'android' ? Math.max(bottom, ANDROID_BOTTOM_MIN) : bottom;
}

export function useBottomInset(): number {
  return bottomInsetFloor(useSafeAreaInsets().bottom);
}
