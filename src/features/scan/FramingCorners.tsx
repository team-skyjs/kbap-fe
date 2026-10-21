/**
 * 프레이밍 코너 4개(KB-854 카메라 v2 B, 시안 로컬 SVG "Framing guide / four corners") — 촬영 안내일 뿐 크롭 경계가 아니다.
 * 시안 SVG(311×396)의 모서리 한 개 = 길이 24 · 흰 선 3 · 둥근 끝. 프리뷰 크기가 기기마다 달라 모서리 4개를 따로 그려 상자 네 귀퉁이에 붙인다.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color as C } from '@/lib/theme';

const S = 28; // 선 3의 절반이 잘리지 않게 24 + 여백 2씩
const CORNER = 'M2 26V2H26'; // 시안 좌상단 모서리 — 나머지는 회전

export function FramingCorners({ style }: { style?: object }) {
  return (
    <View style={[st.box, style]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID="scan-frame-corners">
      {(['tl', 'tr', 'br', 'bl'] as const).map((k, i) => (
        <Svg key={k} width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={[st.corner, st[k], { transform: [{ rotate: `${i * 90}deg` }] }]} testID={`scan-frame-corner-${k}`}>
          <Path d={CORNER} fill="none" stroke={C.surface} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  box: { position: 'absolute' },
  corner: { position: 'absolute' },
  tl: { top: 0, left: 0 },
  tr: { top: 0, right: 0 },
  br: { bottom: 0, right: 0 },
  bl: { bottom: 0, left: 0 },
});
