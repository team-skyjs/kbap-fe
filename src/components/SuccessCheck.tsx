/**
 * SuccessCheck — 완료 체크 SVG 스트로크 드로잉 (P-032/KB-207, kinetics 직역).
 * strokeDashoffset을 당겨 체크가 "그려지는" 연출. 온보딩 제출 완료가 첫 사용처.
 * reduced-motion이면 전역 config가 timing을 스킵 → 완성된 체크가 정적으로 표시.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { color as C } from '@/lib/theme';

const APath = Animated.createAnimatedComponent(Path);

/** 체크 패스(M14 27 l8 8 16-16) 길이 근사: 8√2 + 16√2 ≈ 34 → 여유 36 */
const CHECK_LEN = 36;

export function SuccessCheck({ size = 96 }: { size?: number }) {
  const p = useSharedValue(0);
  React.useEffect(() => {
    p.value = withDelay(120, withTiming(1, { duration: 550, easing: Easing.out(Easing.quad) }));
  }, [p]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - p.value) }));
  return (
    <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size * 0.58} height={size * 0.58} viewBox="0 0 52 52">
        <Circle cx="26" cy="26" r="24" stroke="rgba(255,255,255,0.35)" strokeWidth="3" fill="none" />
        <APath
          d="M14 27 l8 8 16 -16"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={`${CHECK_LEN}`}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { backgroundColor: C.riskSafe, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});

export default SuccessCheck;
