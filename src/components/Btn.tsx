/**
 * Btn — primary action button + variants (ghost / off / danger) and a small size.
 * Ported from hifi-g.css `.btn`. Label is i18n text passed by the caller.
 */
import * as React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, shadow } from '@/lib/theme';
import { PRESS_SCALE, spring } from '@/lib/motion';

export type BtnVariant = 'primary' | 'ghost' | 'off' | 'danger';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Btn({
  children,
  variant = 'primary',
  icon,
  sm,
  disabled,
  onPress,
  style,
}: {
  children?: React.ReactNode;
  variant?: BtnVariant;
  icon?: React.ReactNode;
  sm?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const palette = VARIANTS[variant];
  // P-031(KB-206): press 즉시 피드백 — onPressIn에서 바로(릴리스 대기 금지),
  // damped 스프링이라 인터럽트(빠른 탭 연타)에도 현재값에서 자연 재출발.
  const scale = useSharedValue(1);
  const pressAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const [pressed, setPressed] = React.useState(false);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        setPressed(true);
        scale.value = withSpring(PRESS_SCALE, spring.press);
      }}
      onPressOut={() => {
        setPressed(false);
        scale.value = withSpring(1, spring.press);
      }}
      disabled={disabled || variant === 'off'}
      style={[
        styles.base,
        sm && styles.sm,
        palette.container,
        pressed && palette.pressed,
        style,
        pressAnim,
      ]}
    >
      {/* icon+label in a shrink-wrapped inner row (belt-and-suspenders centering). */}
      <View style={styles.content}>
        {icon}
        {children != null && (
          <Text style={[styles.label, sm && styles.labelSm, palette.label, icon != null && styles.labelGap]}>
            {children}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Fill the container via alignSelf:stretch, NOT width:'100%'. On RN 0.85
    // native (Fabric/Yoga) a `width:'100%'` flex child miscomputes its own
    // justifyContent:center as flex-end — the icon+label rendered flush-right on
    // device (web was fine). Element-inspector confirmed. alignSelf:stretch
    // gives the same full width without tripping that path.
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  // inner row: shrink-wraps icon+label; spacing via labelGap (marginLeft).
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sm: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    width: 'auto',
    // ⚠️ P-159 함정: 의도적 좌측 정렬 기본(인라인 액션용) — 센터 맥락(빈 상태 등)에선
    // 부모 alignItems를 오버라이드하니 호출측에서 style alignSelf:'center' 명시할 것.
    alignSelf: 'flex-start',
  },
  label: { fontFamily: font.display, fontSize: 16, color: '#fff' },
  labelSm: { fontSize: 14.5 },
  labelGap: { marginLeft: 9 },
});

const VARIANTS: Record<
  BtnVariant,
  { container: ViewStyle; pressed: ViewStyle; label: { color: string } }
> = {
  primary: {
    container: { backgroundColor: C.primary, ...shadow.sh2 },
    pressed: { backgroundColor: C.primaryPress },
    label: { color: '#fff' },
  },
  ghost: {
    container: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, ...shadow.sh1 },
    pressed: { backgroundColor: C.surface2 },
    label: { color: C.ink },
  },
  off: {
    container: { backgroundColor: C.surface2 },
    pressed: {},
    label: { color: C.ink3 },
  },
  danger: {
    container: { backgroundColor: C.riskDanger, ...shadow.sh2 },
    pressed: { backgroundColor: '#b5301f' },
    label: { color: '#fff' },
  },
};

export default Btn;
