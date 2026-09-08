/**
 * SectionHead (KB-429, 4064:785) — 섹션 헤더 공용.
 * 라벨(12/500 ink3 대문자) + 타이틀(20/400 #2F3137) · pad 32/20/8 · gap 2.
 * 화면 적용은 D-2~6(여기선 프리미티브만 — 소비 전까지 미사용 무해).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt as Text } from './Txt';
import { color as C } from '@/lib/theme';

export function SectionHead({ label, title, testID }: { label?: string; title: string; testID?: string }) {
  return (
    <View style={styles.wrap} testID={testID}>
      {!!label && <Text style={styles.label}>{label.toUpperCase()}</Text>}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 32, paddingHorizontal: 20, paddingBottom: 8, gap: 2 },
  // A-DS-01(KB-486): 라벨 11/700 ls1.6 lh16 · 타이틀 22/700 lh30 ls-0.6 — 색은 C-08 전까지 현행
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, lineHeight: 16, color: C.ink3 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 30, letterSpacing: -0.6, color: '#2F3137' },
});

export default SectionHead;
