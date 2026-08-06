/**
 * AvoidChip (P-136) — 기피 재료 칩. 홈 diet 배너 칩(achip)의 공용 승격 +
 * 색상 variant: danger(위험 red 계열 틴트) · caution(amber 계열).
 * 스캔 리치 리스트의 기피 경고 줄이 재사용(예진 확정 — 시안 텍스트 줄 대체).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font } from '@/lib/theme';

export function AvoidChip({ label, variant = 'danger' }: { label: string; variant?: 'danger' | 'caution' }) {
  return (
    <View style={[styles.chip, variant === 'caution' && styles.chipCaution]}>
      <Text style={[styles.text, variant === 'caution' && styles.textCaution]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // 홈 achip 규격 승계 — 배경/보더 틴트만 variant
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eeccc8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipCaution: { borderColor: '#ecd9b0', backgroundColor: '#fffdf7' },
  text: { fontFamily: font.bodyBold, fontSize: 11.5, color: C.riskDanger },
  textCaution: { color: '#a06a00' },
});

export default AvoidChip;
