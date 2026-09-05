/**
 * Btn — primary action button + variants (ghost / off / danger) and a small size.
 * Ported from hifi-g.css `.btn`. Label is i18n text passed by the caller.
 */
import * as React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, shadow } from '@/lib/theme';
import { PRESS_SCALE, spring } from '@/lib/motion';

export type BtnVariant = 'primary' | 'ghost' | 'off' | 'secondary' | 'danger' | 'dangerGhost';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Btn({
  children,
  variant = 'primary',
  busy = false,
  testID,
  icon,
  sm,
  disabled,
  onPress,
  style,
}: {
  children?: React.ReactNode;
  variant?: BtnVariant;
  /** P-173: 제출 중 — 라벨 자리 스피너(원 라벨 투명 보존 = 메트릭 불변) + 탭 차단. */
  busy?: boolean;
  testID?: string;
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
      disabled={disabled || busy || variant === 'off'}
      testID={testID}
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
        {/* P-173: busy = 원 콘텐츠 투명 보존(프레임 불변) + 스피너 오버레이 */}
        <View style={[styles.inner, busy && styles.innerHidden]} pointerEvents={busy ? 'none' : undefined}>
          {icon}
          {children != null && (
            <Text style={[styles.label, sm && styles.labelSm, palette.label, icon != null && styles.labelGap]}>
              {children}
            </Text>
          )}
        </View>
        {busy && (
          <View style={[StyleSheet.absoluteFill, styles.busyFill]} testID="btn-busy">
            <ActivityIndicator color={palette.label.color} />
          </View>
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
    // KB-429(4123:3985): h48 · radius xs(4) · pad 10
    minHeight: 48,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  // inner row: shrink-wraps icon+label; spacing via labelGap (marginLeft).
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center' },
  innerHidden: { opacity: 0 },
  busyFill: { alignItems: 'center', justifyContent: 'center' },
  // KB-429(btn/review 4123:3696): h30 · pad 7/13 · radius 4 · line 보더 + sh1
  sm: {
    minHeight: 30,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 4,
    width: 'auto',
    borderWidth: 1,
    borderColor: C.line,
    ...shadow.sh1,
    // ⚠️ P-159 함정: 의도적 좌측 정렬 기본(인라인 액션용) — 센터 맥락(빈 상태 등)에선
    // 부모 alignItems를 오버라이드하니 호출측에서 style alignSelf:'center' 명시할 것.
    alignSelf: 'flex-start',
  },
  label: { fontFamily: font.bodySemi, fontSize: 15, color: '#fff' }, // 15/600
  labelSm: { fontSize: 12, fontWeight: '500' }, // 12/500
  labelGap: { marginLeft: 9 },
});

const VARIANTS: Record<
  BtnVariant,
  { container: ViewStyle; pressed: ViewStyle; label: { color: string } & import('react-native').TextStyle }
> = {
  primary: {
    container: { backgroundColor: C.primary },
    pressed: { backgroundColor: C.primaryPress },
    label: { color: '#fff' },
  },
  // KB-429(4123:3640): 흰 bg + line2 1px + ink 14/500
  ghost: {
    container: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line2 },
    pressed: { backgroundColor: C.surface2 },
    label: { color: C.ink, fontSize: 14, fontWeight: '500' as const },
  },
  // KB-429(4123:3997): disabled — bg line(#EAEBEE) / 텍스트 inkDisabled
  off: {
    container: { backgroundColor: C.line },
    pressed: {},
    label: { color: C.inkDisabled },
  },
  // KB-429(4123:4002): Alert 취소 등 — bg inkMute + 흰 텍스트
  secondary: {
    container: { backgroundColor: C.inkMute },
    pressed: { backgroundColor: '#9EA3AC' },
    label: { color: '#fff' },
  },
  danger: {
    container: { backgroundColor: C.riskDanger },
    pressed: { backgroundColor: '#d94f4a' },
    label: { color: '#fff' },
  },
  // P-175: destructive 확인 행 — ghost와 같은 버튼 프레임(보더+라운딩+패딩), 색만 destructive
  dangerGhost: {
    container: { backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(247,102,97,0.5)', ...shadow.sh1 },
    pressed: { backgroundColor: 'rgba(207,58,44,0.06)' },
    label: { color: C.riskDanger },
  },
};

export default Btn;
