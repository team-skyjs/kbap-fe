/**
 * Chip (KB-429, 4064:986) — 필터 칩 공용.
 * selected = bg #2F3137 + 흰 텍스트 / unselected = 흰 bg + line 1px + #2F3137.
 * 14/500 · pad 8/14 · pill. 선택 전환은 색만(프레임 불변 P-151 — 보더는 양 상태
 * 동일 폭, selected는 bg와 동색 보더로 자리 유지).
 */
import * as React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Txt as Text } from './Txt';
import { color as C, radius, riskTone, type RiskState } from '@/lib/theme';

const INK_ACTIVE = '#2F3137'; // 시안 gray-900(발주 표 외 명시값)

export function Chip({
  label,
  selected = false,
  onPress,
  testID,
  risk,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  /** P-391(KB-582): 위험도 필터 칩 — 선택 시 **RiskMark와 같은 토큰**으로 칠한다(예진 실기: 색이 달랐다). */
  risk?: RiskState;
}) {
  // 선택 = 해당 상태 원색 bg + 흰 글자(마크·배지와 같은 fg 토큰) · 비선택 = 기존 중립.
  // 하드코딩 hex 금지 — riskTone[risk].fg는 RiskMark의 RISK[state].color와 같은 값이다.
  const onBg = risk ? riskTone[risk].fg : INK_ACTIVE;
  return (
    <Pressable
      style={[styles.chip, selected ? { backgroundColor: onBg, borderColor: onBg } : styles.off]}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
    >
      <Text style={[styles.label, { color: selected ? '#FFFFFF' : INK_ACTIVE }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  on: { backgroundColor: INK_ACTIVE, borderColor: INK_ACTIVE },
  off: { backgroundColor: '#FFFFFF', borderColor: C.line },
  // P-371: lineHeight 20 고정 — 8+20+8=36 칩 높이 유지, Android 한글 세로 중앙
  label: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
});

export default Chip;
