/**
 * FlameShape (KB-680) — 카운트다운 뱃지의 불꽃 그림 **한 곳**. 시안(D-21) 확정 전 임시 형태 — 레퍼런스(Me+ 스트릭:
 * 둥근 아래 · 위로 솟은 끝 · 흰 테두리)를 근사. 시안이 오면 이 파일만 교체한다(뱃지·호출부 무변).
 * 색 = DS 토큰만(active = primary→primary2 그라데이션, empty = ink3). 위험도 4색 금지(뱃지가 위험 판정으로 읽히면 안 됨).
 */
import * as React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { color as C } from '@/lib/theme';

const VB_W = 64;
const VB_H = 72;
const FLAME = 'M32 4 C41 15 57 25 58 45 C59 60 47 69 32 69 C17 69 5 60 6 45 C7 35 12 29 18 23 C19 30 23 34 27 34 C24 22 27 12 32 4 Z';

export function FlameShape({ width, height, state }: { width: number; height: number; state: 'active' | 'empty' }) {
  const on = state === 'active';
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} testID={`flame-${state}`}>
      <Defs>
        <LinearGradient id="flameFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={on ? C.primary2 : C.ink3} />
          <Stop offset="1" stopColor={on ? C.primary : C.ink3} />
        </LinearGradient>
      </Defs>
      <Path d={FLAME} fill="url(#flameFill)" stroke={C.surface} strokeWidth={4} strokeLinejoin="round" />
    </Svg>
  );
}
