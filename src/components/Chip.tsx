/**
 * Chip (KB-429, 4064:986) — 필터 칩 공용.
 * selected = bg #2F3137 + 흰 텍스트 / unselected = 흰 bg + line 1px + #2F3137.
 * 14/500 · pad 8/14 · pill. 선택 전환은 색만(프레임 불변 P-151 — 보더는 양 상태
 * 동일 폭, selected는 bg와 동색 보더로 자리 유지).
 */
import * as React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Txt as Text } from './Txt';
import { color as C, radius } from '@/lib/theme';

const INK_ACTIVE = '#2F3137'; // 시안 gray-900(발주 표 외 명시값)

export function Chip({
  label,
  selected = false,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      style={[styles.chip, selected ? styles.on : styles.off]}
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
  label: { fontSize: 14, fontWeight: '500' },
});

export default Chip;
