/**
 * StateBlock — shared empty / error / offline / unable state (mockup Screen J).
 * Tone tints the icon bubble. Buttons are optional; labels are i18n text.
 */
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color as C, font, riskTone } from '@/lib/theme';
import { Btn } from './Btn';

export type StateTone = 'default' | 'err' | 'unable';

export function StateBlock({
  icon,
  title,
  body,
  tone = 'default',
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: StateTone;
  primary?: { label: string; icon?: React.ReactNode; onPress?: () => void };
  secondary?: { label: string; onPress?: () => void };
}) {
  return (
    <View style={styles.root}>
      <View style={[styles.ic, TONE_BG[tone]]}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {(primary || secondary) && (
        <View style={styles.btns}>
          {primary && (
            <Btn icon={primary.icon} onPress={primary.onPress}>
              {primary.label}
            </Btn>
          )}
          {secondary && (
            <Btn variant="ghost" onPress={secondary.onPress}>
              {secondary.label}
            </Btn>
          )}
        </View>
      )}
    </View>
  );
}

/** Icon tint color for each tone (pass to the icon's color prop). */
export const stateIconColor: Record<StateTone, string> = {
  default: C.primary,
  err: riskTone.danger.fg,
  unable: C.riskUnable,
};

const TONE_BG: Record<StateTone, { backgroundColor: string }> = {
  default: { backgroundColor: 'rgba(226,88,12,0.08)' },
  err: { backgroundColor: riskTone.danger.bg },
  unable: { backgroundColor: '#eef0f2' },
};

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 11, paddingHorizontal: 24, paddingVertical: 24, maxWidth: 320, alignSelf: 'center' },
  ic: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.display, fontSize: 20, color: C.ink, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 14, color: C.ink2, lineHeight: 21, textAlign: 'center' },
  btns: { width: '100%', gap: 9, marginTop: 6 },
});

export default StateBlock;
