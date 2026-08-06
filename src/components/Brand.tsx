/**
 * Brand — the K-Bap wordmark lockup for in-app headers (JS/OTA, not the native
 * launcher icon). Ported from assets/images/kbowl.svg: a "K" over a rice-bowl
 * arc. The lockup is an orange radial-gradient rounded tile holding the white
 * mark, next to the "K-Bap" wordmark whose hyphen is the teal accent.
 *
 * All colors come from theme tokens (no hardcoding). Fonts are already bundled.
 */
import * as React from 'react';
// Brand wordmark uses the RAW react-native Text (NOT the script-aware Txt): the
// "K-Bap" mark is a fixed Latin logo and must always render in Baloo 2, never
// remapped to the active reader language's script font.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { color as C, font } from '@/lib/theme';

/** Bare mark (K + bowl), single color via `color` (currentColor equivalent). */
export function KbowlMark({ size = 100, color = C.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <SvgText x={50} y={52} textAnchor="middle" fontFamily={font.displayBlack} fontSize={56} fill={color}>
        K
      </SvgText>
      <Path d="M18 55 H82 a32 32 0 0 1 -64 0 Z" fill={color} />
    </Svg>
  );
}

/** P-133(kbap-logo-flat): 플랫 타일 — 쉐도우·글로스(라디얼 그라데이션) 전무.
 *  단색 primary + 흰 마크, radius = size×0.224(rx 22.4/100). 실사용 톤 = orange만
 *  이식(cream/onbrand/ink는 노출처 생기면 추가). */
export function BrandTile({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x={0} y={0} width={100} height={100} rx={22.4} fill={C.primary} />
      <G transform="translate(18 18) scale(0.64)">
        <SvgText x={50} y={52} textAnchor="middle" fontFamily={font.displayBlack} fontSize={56} fill="#fff">
          K
        </SvgText>
        <Path d="M18 55 H82 a32 32 0 0 1 -64 0 Z" fill="#fff" />
      </G>
    </Svg>
  );
}

/** Standalone "K-Bap" wordmark (teal hyphen), sized. Raw Baloo, never remapped. */
export function BrandWordmark({ size = 22 }: { size?: number }) {
  return (
    <Text style={[styles.word, { fontSize: size }]}>
      K<Text style={styles.hyphen}>-</Text>Bap
    </Text>
  );
}

/** Full header lockup: tile + "K-Bap" wordmark (teal hyphen). */
export function BrandLockup({ tileSize = 36 }: { tileSize?: number }) {
  return (
    <View style={styles.row}>
      <BrandTile size={tileSize} />
      <BrandWordmark size={22} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { fontFamily: font.displayBlack, color: C.primary, letterSpacing: -0.44 }, // P-133: -0.02em(22pt 기준)
  hyphen: { color: C.accent },
});

export default BrandLockup;
