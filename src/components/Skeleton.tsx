/**
 * Skeleton — loading placeholders with a shimmer sweep (mockup Screen J1).
 * Shimmer runs on the UI thread via reanimated.
 */
import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { color as C, radius } from '@/lib/theme';

function Shimmer({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const p = useSharedValue(0);
  React.useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [p]);
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(p.value, [0, 1], [-220, 220]) }],
  }));
  return (
    <View style={[styles.block, style]}>
      <Animated.View style={[styles.sweep, sweep]} />
    </View>
  );
}

/** Home-style loading skeleton: banner + a few list rows. */
export function SkeletonList() {
  return (
    <View style={styles.wrap}>
      <Shimmer style={styles.banner} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.card}>
          <Shimmer style={styles.thumb} />
          <View style={{ flex: 1, gap: 8 }}>
            <Shimmer style={[styles.line, { width: '70%' }]} />
            <Shimmer style={[styles.line, { width: '40%' }]} />
            <Shimmer style={[styles.line, { width: '55%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, gap: 14 },
  block: { backgroundColor: C.surface2, overflow: 'hidden' },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 120, backgroundColor: 'rgba(255,255,255,0.45)', opacity: 0.7 },
  banner: { height: 64, borderRadius: radius.lg },
  card: { flexDirection: 'row', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  line: { height: 12, borderRadius: 6 },
});

export { Shimmer };
export default SkeletonList;
