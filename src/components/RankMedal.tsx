/**
 * RankMedal (KB-429 → 9/5 시안 원본 SVG) — 랭킹 메달(Rosette 대체 — 화면 스왑은 D-6).
 * 메달 = 스펙 bridge/design/4th/icons/medal-1~7.svg 그대로(28×35, 숫자·리본·글로우색
 * 내장 — 형태·치수 무수정). size = 메달 원 지름(28 기준), 전체 높이 = size×35/28.
 * 레벨 색 글로우는 shadowGlow 유지(시안 4150:16186).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt as Text } from './Txt';
import { shadowGlow } from '@/lib/theme';
import { Medal1, Medal2, Medal3, Medal4, Medal5, Medal6, Medal7 } from './design4Assets';

const MEDALS = [Medal1, Medal2, Medal3, Medal4, Medal5, Medal6, Medal7] as const;
const GLOW: Record<number, string> = { 1: '#FFC700', 2: '#FF6A3C', 3: '#26DE81', 4: '#45AAF2', 5: '#A55EEA', 6: '#FC5C65', 7: '#FD79A8' };

export function RankMedal({ level, size = 28, testID }: { level: number; size?: number; testID?: string }) {
  const lv = Math.min(Math.max(level, 1), 7);
  const Medal = MEDALS[lv - 1];
  const height = (size * 35) / 28;
  return (
    <View style={[styles.wrap, shadowGlow(GLOW[lv])]} testID={testID ?? `rank-medal-${lv}`}>
      <Medal height={height} />
      {/* Codex #30 P2: 시안 place-number는 TEXT 노드(SVG 추출 미포함) — 14/900 흰,
          메달 원 중심(28×35 그리드에서 원 중심 y21) 오버레이. 크기 비례 축소. */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingTop: height * (7 / 35) }]} pointerEvents="none">
        <Text style={{ fontSize: (size * 14) / 28, fontWeight: '900', color: '#FFFFFF' }}>{lv}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});

export default RankMedal;
