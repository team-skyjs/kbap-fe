/**
 * AvoidChip (P-136 → P-160) — 스캔 행 기피 재료 칩. P-160(예진 확정, 목업
 * scan-profile-bar-options ② '후'): **solid 진한 배경** — danger #cf3a2c ·
 * caution #d28a12, 흰 글자 800. "May contain" 라벨은 소멸(칩 색이 말한다).
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
  // P-160 목업 .chip/.ch-d/.ch-c 전사 — solid, 12.5/800, padding 4/11, radius 999
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#cf3a2c', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  chipCaution: { backgroundColor: '#d28a12' },
  text: { fontFamily: font.displayBlack, fontSize: 12.5, color: '#fff' },
  textCaution: { color: '#fff' },
});

export default AvoidChip;
