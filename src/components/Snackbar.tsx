/**
 * Snackbar — bottom dark pill with optional action (design: Bookmark Mods /
 * Saved). Presentational only; visibility/timers are the caller's job.
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, radius, shadow } from '@/lib/theme';

export function Snackbar({
  icon,
  text,
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.bar}>
        {icon}
        <Text style={styles.text}>{text}</Text>
        {actionLabel != null && (
          <Pressable onPress={onAction} hitSlop={10}>
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 16, right: 16, bottom: 24 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: C.ink,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadow.sh2,
  },
  text: { flex: 1, fontFamily: font.body, fontSize: 13.5, color: '#fff' },
  action: { fontFamily: font.bodyBold, fontSize: 13.5, color: '#FFB27A' },
});

export default Snackbar;
