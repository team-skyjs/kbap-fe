/**
 * Choice (KB-429) — 체크박스(4150:14083/14089)·라디오(4150:13838/13840) 공용.
 * Checkbox 20 radius 4: checked = primary fill + 흰 체크 / unchecked = line2 1.5px.
 * Radio 16: checked = primary 5px 링 / unchecked = line2 1.5px.
 * 화면 배선은 D-5(온보딩) 등 후속 — 여기선 프리미티브만.
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color as C } from '@/lib/theme';

export function Checkbox({ checked, onPress, testID }: { checked: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable style={[styles.box, checked ? styles.boxOn : styles.boxOff]} onPress={onPress} testID={testID} hitSlop={8}>
      {checked && (
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </Pressable>
  );
}

export function Radio({ selected, onPress, testID }: { selected: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} hitSlop={8}>
      <View style={[styles.radio, selected ? styles.radioOn : styles.radioOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { width: 20, height: 20, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.primary },
  boxOff: { borderWidth: 1.5, borderColor: C.line2, backgroundColor: '#FFFFFF' },
  radio: { width: 16, height: 16, borderRadius: 8 },
  radioOn: { borderWidth: 5, borderColor: C.primary, backgroundColor: '#FFFFFF' },
  radioOff: { borderWidth: 1.5, borderColor: C.line2, backgroundColor: '#FFFFFF' },
});
