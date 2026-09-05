/**
 * RiskBadge (KB-429, 4095:1428) — 썸네일 좌상단 리본형 위험도 배지.
 * 26×34: 사각 22×31(radius 1) 상태색 fill + 흰 1.5px 보더 + shBadge 그림자,
 * 내부 = 흰 원 14 + 상태색 글리프(9/5 예진 확정 — 시안 4095:1428 그대로, 실루엣 폐기).
 * 텍스트형 RiskPill과 별개(공존) — 썸네일 위 오프셋은 호출측(x 3~9, y 0).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { color as C, shadow, type RiskState } from '@/lib/theme';

const STATE_COLOR: Record<RiskState, string> = {
  safe: C.riskSafe,
  caution: C.riskCaution,
  danger: C.riskDanger,
  unable: C.riskUnable,
};

/** 리본 내부 글리프 — RiskMark와 동일 문법(24 그리드, 상태색 stroke). */
function Glyph({ state, stroke }: { state: RiskState; stroke: string }) {
  switch (state) {
    case 'safe':
      return <Path d="M7.5 12.4 l3 3 L16.6 8.8" fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />;
    case 'danger':
      return (
        <G stroke={stroke} strokeWidth={2.6} strokeLinecap="round">
          <Line x1="8.6" y1="8.6" x2="15.4" y2="15.4" />
          <Line x1="15.4" y1="8.6" x2="8.6" y2="15.4" />
        </G>
      );
    case 'caution':
      return (
        <G stroke={stroke} strokeWidth={2.6} strokeLinecap="round">
          <Line x1="12" y1="7.5" x2="12" y2="14" />
          <Circle cx="12" cy="17.6" r="0.2" strokeWidth={2.8} />
        </G>
      );
    case 'unable':
      return (
        <G stroke={stroke} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M9.4 9.6 C9.4 7.4 11.9 6.6 13.4 7.8 C14.9 9 14.1 10.7 12.7 11.5 C11.9 12 11.7 12.6 11.7 13.5" />
          <Circle cx="11.7" cy="16.5" r="0.2" strokeWidth={2.6} />
        </G>
      );
  }
}

export function RiskBadge({ state, testID }: { state: RiskState; testID?: string }) {
  const c = STATE_COLOR[state];
  return (
    <View style={[styles.ribbon, { backgroundColor: c }]} testID={testID ?? `risk-badge-${state}`}>
      <View style={styles.dot}>
        <Svg width={11} height={11} viewBox="0 0 24 24">
          <Glyph state={state} stroke={c} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    width: 22,
    height: 31,
    borderRadius: 1,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.shBadge,
  },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});

export default RiskBadge;
