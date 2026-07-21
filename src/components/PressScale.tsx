/**
 * PressScale — 생 Pressable 버튼용 공용 press 피드백 래퍼 (P-042/Q-18 2번).
 * 공용 Btn과 동일 프리셋(spring.press, scale 0.97, onPressIn 즉발 — 릴리스 대기
 * 금지). 버튼 모양(pill·아이콘 버튼·액션 행)에만 쓸 것 — 리스트 행/카드
 * 내비게이션엔 과적용 금지 (Q-18 지시).
 */
import * as React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PRESS_SCALE, spring } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressScale({
  style,
  children,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(PRESS_SCALE, spring.press);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, spring.press);
        rest.onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}

export default PressScale;
