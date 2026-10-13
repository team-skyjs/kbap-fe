/**
 * Spinner — small SVG loading spinner (rotating arc). No emoji / no native
 * ActivityIndicator glyph; drawn with react-native-svg + reanimated rotation.
 */
import * as React from 'react';
import Animated from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { color as C } from '@/lib/theme';

// KB-772: 무한 회전 = CSS 애니메이션(Skeleton Shimmer와 같은 이유 — 언마운트 뒤 매퍼 잔여 갱신이 Android ANR 원인)
const SPIN = { from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } };
const spinStyle = { animationName: SPIN, animationDuration: '800ms', animationTimingFunction: 'linear', animationIterationCount: 'infinite' } as const;

export function Spinner({ size = 16, color = C.ink2 }: { size?: number; color?: string }) {
  return (
    /* P-036(Q-08 ②): 크기 고정 — 너비 미지정 상태로 FlatList 푸터 직속에 놓이면
       전폭 stretch된 띠가 통째로 회전해 아이콘이 화면을 공전했다. 회전축 = 자기 중심. */
    <Animated.View style={[{ width: size, height: size, alignSelf: 'center' }, spinStyle]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* ~3/4 arc: dash of ~42 over circumference 2π·9 ≈ 56.5 */}
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="42 100" />
      </Svg>
    </Animated.View>
  );
}

export default Spinner;
