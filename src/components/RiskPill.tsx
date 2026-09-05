/**
 * RiskPill — the canonical text risk badge (mark + reader-language label on a
 * color-tinted pill). Two sizes: `sm` (list rows) and `lg` (detail header).
 *
 * Labels come from i18n (`risk.safe|caution|danger|unable`, reader-language
 * only — never Korean). Pass `label` to override the text (e.g. the detail
 * verdict phrase) while keeping the tint/mark/false-safe treatment.
 *
 * FALSE-SAFE: `unable` must never read like `safe`. It gets the grey tone AND a
 * dashed border so "no data" is visually unmistakable next to a solid safe pill.
 * The mark silhouette/glyph/color are fixed in RiskMark (Constitution III).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { font, radius, riskText, riskTone, type RiskState } from '@/lib/theme';
import { RiskMark } from './RiskMark';

export function RiskPill({
  state,
  size = 'sm',
  label,
}: {
  state: RiskState;
  size?: 'sm' | 'lg';
  label?: string;
}) {
  const { t } = useTranslation();
  const tone = riskTone[state];
  const lg = size === 'lg';
  const dashed = state === 'unable';
  const text = label ?? t(`risk.${state}`);
  return (
    <View
      style={[
        styles.pill,
        lg ? styles.lg : styles.sm,
        { backgroundColor: tone.bg },
        dashed && { borderWidth: 1, borderColor: tone.line, borderStyle: 'dashed' },
      ]}
    >
      <RiskMark state={state} size={lg ? 20 : 14} />
      {/* KB-429(Codex #27): 소형 텍스트는 riskText(대비 변형) — 아이콘·bg는 riskTone 유지 */}
      <Text style={[lg ? styles.lgText : styles.smText, { color: riskText[state] }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill },
  sm: { gap: 5, paddingHorizontal: 9, paddingVertical: 4 },
  lg: { gap: 7, paddingHorizontal: 13, paddingVertical: 8 },
  smText: { fontFamily: font.bodyBold, fontSize: 11.5 },
  lgText: { fontFamily: font.display, fontSize: 14.5 },
});

export default RiskPill;
