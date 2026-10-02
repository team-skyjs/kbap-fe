/**
 * FlameShape (KB-680) — 카운트다운 뱃지의 불꽃 그림 **한 곳**. 시안(D-21) 확정 전 임시 형태 — 레퍼런스(Me+ 스트릭:
 * 둥근 아래 · 위로 솟은 끝 · 흰 테두리)를 근사. 시안이 오면 이 파일만 교체한다(뱃지·호출부 무변).
 * 색 = DS 토큰만(active = primary 단색 — KB-701 그라데이션 제거, empty = ink3). 위험도 4색 금지(뱃지가 위험 판정으로 읽히면 안 됨).
 */
import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
import { color as C } from '@/lib/theme';

const VB_W = 64;
const VB_H = 72;
// KB-701(예진 10/2 실기): 옛 path의 왼쪽 안쪽 홈(흰 테두리가 몸통 안으로 휘어 들어감)이 숫자 왼쪽 위와 겹쳐 안 보였다 → 홈 없는 물방울형.
// 몸통 안 흰 선 0 = 숫자 영역(라벨 박스) 전체가 단색 위.
export const FLAME_PATH = 'M32 4 C41 15 57 25 58 45 C59 60 47 69 32 69 C17 69 5 60 6 45 C7 25 23 15 32 4 Z';

export function FlameShape({ width, height, state }: { width: number; height: number; state: 'active' | 'empty' }) {
  const on = state === 'active';
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} testID={`flame-${state}`}>
      {/* KB-701: 그라데이션(위쪽 연한 보조 주황) 제거 — 숫자 위 밝은 영역이 흰 글자 대비를 깎았다. 단색 = 기존 토큰(새 색 0) */}
      <Path d={FLAME_PATH} fill={on ? C.primary : C.ink3} stroke={C.surface} strokeWidth={4} strokeLinejoin="round" />
    </Svg>
  );
}
