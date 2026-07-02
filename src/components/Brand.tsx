/**
 * Brand — the K-Bap wordmark lockup for in-app headers (JS/OTA, not the native
 * launcher icon). Ported from assets/images/kbowl.svg: a "K" over a rice-bowl
 * arc. The lockup is an orange radial-gradient rounded tile holding the white
 * mark, next to the "K-Bap" wordmark whose hyphen is the teal accent.
 *
 * All colors come from theme tokens (no hardcoding). Fonts are already bundled.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Svg, { Defs, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
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

/** Orange radial tile with the white mark inset. */
export function BrandTile({ size = 36 }: { size?: number }) {
  const gid = React.useId();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={gid} cx="35%" cy="28%" r="85%">
          <Stop offset="0" stopColor="#F0803C" />
          <Stop offset="0.55" stopColor={C.primary} />
          <Stop offset="1" stopColor="#C4400A" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} rx={22.4} fill={`url(#${gid})`} />
      <G transform="translate(18 18) scale(0.64)">
        <SvgText x={50} y={52} textAnchor="middle" fontFamily={font.displayBlack} fontSize={56} fill="#fff">
          K
        </SvgText>
        <Path d="M18 55 H82 a32 32 0 0 1 -64 0 Z" fill="#fff" />
      </G>
    </Svg>
  );
}

/** Full header lockup: tile + "K-Bap" wordmark (teal hyphen). */
export function BrandLockup({ tileSize = 36 }: { tileSize?: number }) {
  return (
    <View style={styles.row}>
      <BrandTile size={tileSize} />
      <Text style={styles.word}>
        K<Text style={styles.hyphen}>-</Text>Bap
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { fontFamily: font.displayBlack, fontSize: 22, color: C.primary, letterSpacing: -0.2 },
  hyphen: { color: C.accent },
});

export default BrandLockup;
