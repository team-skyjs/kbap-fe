/**
 * RankMedal (KB-429 → 9/5 시안 원본 SVG) — 랭킹 메달(Rosette 대체 — 화면 스왑은 D-6).
 * 메달 = 스펙 bridge/design/4th/icons/medal-1~7.svg 그대로(28×35, 숫자·리본·글로우색
 * 내장 — 형태·치수 무수정). size = 메달 원 지름(28 기준), 전체 높이 = size×35/28.
 * P-315(KB-482): 최종 시안(2200:20903) = 글로우 없음 — shadowGlow 제거. 숫자 16/800.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt as Text } from './Txt';
import { Medal1, Medal2, Medal3, Medal4, Medal5, Medal6, Medal7 } from './design4Assets';

const MEDALS = [Medal1, Medal2, Medal3, Medal4, Medal5, Medal6, Medal7] as const;

/** P-369 ②(KB-532): 등급별 메달 원색(design4Assets 원 fill — 시안 2179:10075 글로우 요소색). */
export const MEDAL_COLORS = ['#ffc700', '#ff6a3c', '#26de81', '#45aaf2', '#a55eea', '#fc5c65', '#fd79a8'] as const;

export function RankMedal({ level, size = 28, testID }: { level: number; size?: number; testID?: string }) {
  const lv = Math.min(Math.max(level, 1), 7);
  const Medal = MEDALS[lv - 1];
  const height = (size * 35) / 28;
  return (
    <View style={styles.wrap} testID={testID ?? `rank-medal-${lv}`}>
      <Medal height={height} />
      {/* Codex #30 P2: 시안 place-number는 TEXT 노드(SVG 추출 미포함) — 14/900 흰,
          메달 원 중심(28×35 그리드에서 원 중심 y21) 오버레이. 크기 비례 축소. */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingTop: height * (7 / 35) }]} pointerEvents="none">
        <Text style={{ fontSize: (size * 16) / 28, fontWeight: '800', color: '#FFFFFF' }}>{lv}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});

export default RankMedal;
