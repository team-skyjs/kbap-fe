/**
 * Btn — primary action button + variants (ghost / off / danger) and a small size.
 * Ported from hifi-g.css `.btn`. Label is i18n text passed by the caller.
 */
import * as React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, shadow } from '@/lib/theme';

export type BtnVariant = 'primary' | 'ghost' | 'off' | 'danger';

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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || variant === 'off'}
      style={({ pressed }) => [
        styles.base,
        sm && styles.sm,
        palette.container,
        pressed && palette.pressed,
        style,
      ]}
    >
      {icon}
      {children != null && (
        <Text style={[styles.label, sm && styles.labelSm, palette.label, icon != null && styles.labelGap]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    // NOTE: spacing between icon and label uses labelGap (marginLeft), NOT the
    // flex `gap` prop — RN 0.85 native miscomputes `gap` + justifyContent:center
    // and shifts the icon+label group off-center (web is fine, device is not).
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  sm: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    width: 'auto',
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
