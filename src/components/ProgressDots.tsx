/**
 * ProgressDots — 진행 점(KB-433 §3 title-stack: 17×4 r8, 활성 primary / 나머지 line2, gap 4). 온보딩 ObTitle에서 공용화(KB-729 설문 시트 재사용).
 * testID는 호출측 접두(온보딩 `ob-dot-i-on|off` 잠금 유지).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { color as C } from '@/lib/theme';

export function ProgressDots({ count, active, testID = 'ob-dots', dotTestIDPrefix = 'ob-dot' }: { count: number; active: number; testID?: string; dotTestIDPrefix?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.on]} testID={`${dotTestIDPrefix}-${i}-${i === active ? 'on' : 'off'}`} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  dot: { width: 17, height: 4, borderRadius: 8, backgroundColor: C.line2 },
  on: { backgroundColor: C.primary },
});
