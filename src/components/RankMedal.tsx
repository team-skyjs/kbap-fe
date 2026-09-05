/**
 * RankMedal (KB-429, 4150:16186) — 랭킹 메달(Rosette 대체 예정 — 화면 스왑은 D-6).
 * 28 원 + 상단 리본(22×14) + 레벨 숫자(14/900 흰) + 색 글로우(shadowGlow).
 * 레벨 색(원/리본): 1 #FFC700/#A68100 · 2 #FF6A3C/#A64527 · 3 #26DE81/#199054 ·
 * 4 #45AAF2/#2D6F9D · 5 #A55EEA/#6B3D98 · 6 #FC5C65/#A43C42 · 7 #FD79A8/#A44F6D.
 * 크기: 28(랭킹) · 16×20(리뷰 닉네임 옆 — size=16).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Txt as Text } from './Txt';
import { shadowGlow } from '@/lib/theme';

const LEVELS: Record<number, { medal: string; ribbon: string }> = {
  1: { medal: '#FFC700', ribbon: '#A68100' },
  2: { medal: '#FF6A3C', ribbon: '#A64527' },
  3: { medal: '#26DE81', ribbon: '#199054' },
  4: { medal: '#45AAF2', ribbon: '#2D6F9D' },
  5: { medal: '#A55EEA', ribbon: '#6B3D98' },
  6: { medal: '#FC5C65', ribbon: '#A43C42' },
  7: { medal: '#FD79A8', ribbon: '#A44F6D' },
};

export function RankMedal({ level, size = 28, testID }: { level: number; size?: number; testID?: string }) {
  const c = LEVELS[Math.min(Math.max(level, 1), 7)];
  const ribbonW = size * (22 / 28);
  const ribbonH = size * (14 / 28);
  return (
    <View style={{ width: size, height: size + ribbonH * 0.45, alignItems: 'center' }} testID={testID ?? `rank-medal-${level}`}>
      {/* 상단 리본 — 원 뒤로 살짝 노출 */}
      <Svg width={ribbonW} height={ribbonH} viewBox="0 0 22 14" style={styles.ribbon}>
        <Path d="M2 0 H9 V11 L5.5 8.5 L2 11 Z" fill={c.ribbon} />
        <Path d="M13 0 H20 V11 L16.5 8.5 L13 11 Z" fill={c.ribbon} />
      </Svg>
      <View
        style={[
          styles.medal,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: c.medal },
          shadowGlow(c.medal),
        ]}
      >
        {/* 시스템 폰트 최대 굵기(14/900) — 크기 비례 축소 */}
        <Text style={[styles.num, { fontSize: size * 0.5 }]}>{level}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: { position: 'absolute', top: 0 },
  medal: { alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  num: { color: '#FFFFFF', fontWeight: '900' },
});

export default RankMedal;
