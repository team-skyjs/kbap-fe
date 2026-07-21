/**
 * useShake — Error Shake 마이크로 인터랙션 (P-032/KB-207, kinetics 직역).
 * 감쇠 진동(진폭이 줄며 멈춤), shake() 재호출 시 0으로 리셋 후 재트리거.
 * reduced-motion이면 전역 ReducedMotionConfig가 timing을 스킵 — 정지 폴백.
 */
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

export function useShake() {
  const x = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = () => {
    x.value = 0; // 재트리거: 진행 중이어도 원점에서 다시
    x.value = withSequence(
      withTiming(-7, { duration: 45 }),
      withTiming(6, { duration: 45 }),
      withTiming(-4, { duration: 45 }),
      withTiming(3, { duration: 45 }),
      withTiming(0, { duration: 60 }),
    );
  };
  return { shakeStyle, shake };
}
