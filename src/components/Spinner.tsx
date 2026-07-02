/**
 * Spinner — small SVG loading spinner (rotating arc). No emoji / no native
 * ActivityIndicator glyph; drawn with react-native-svg + reanimated rotation.
 */
import * as React from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { color as C } from '@/lib/theme';

export function Spinner({ size = 16, color = C.ink2 }: { size?: number; color?: string }) {
  const deg = useSharedValue(0);
  React.useEffect(() => {
    deg.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1, false);
  }, [deg]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${deg.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* ~3/4 arc: dash of ~42 over circumference 2π·9 ≈ 56.5 */}
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="42 100" />
      </Svg>
    </Animated.View>
  );
}

export default Spinner;
