/**
 * Stars — rating display. Single Star supports partial fill via a clip rect
 * (ported from mockup icons.jsx, Math.random id → stable React.useId).
 */
import * as React from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import { color as C } from '@/lib/theme';

const STAR_D =
  'M12 2.6 l2.7 5.95 6.5.62 -4.9 4.32 1.45 6.36 L12 16.9 l-5.75 3.55 1.45 -6.36 -4.9 -4.32 6.5 -.62 Z';

export function Star({
  size = 20,
  fillPct = 100,
  fillColor = C.ink,
  emptyColor = C.ink,
}: {
  size?: number;
  fillPct?: number;
  fillColor?: string;
  emptyColor?: string;
}) {
  const rawId = React.useId();
  const id = `st${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <ClipPath id={id}>
          <Rect x="0" y="0" width={(24 * fillPct) / 100} height="24" />
        </ClipPath>
      </Defs>
      <Path d={STAR_D} fill="none" stroke={emptyColor} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d={STAR_D} fill={fillColor} clipPath={`url(#${id})`} />
    </Svg>
  );
}

/** A row of 5 stars rendering a 0–5 rating with fractional fill. */
export function Stars({
  value,
  size = 16,
  color = C.primary,
}: {
  value: number;
  size?: number;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const pct = Math.max(0, Math.min(1, value - i)) * 100;
        return <Star key={i} size={size} fillPct={pct} fillColor={color} emptyColor={C.ink3} />;
      })}
    </View>
  );
}

export default Stars;
