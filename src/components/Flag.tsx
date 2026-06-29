/**
 * Flag — simplified circular nationality flags (ported from mockup icons.jsx).
 * Used for nationality selection + same-nationality reviews/ranking.
 * Geometry is approximate by design (a glyph, not an accurate flag).
 */
import * as React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { color as C } from '@/lib/theme';

const RED = '#cf3a2c';
const BLUE = '#34507a';
const CREAM = '#f1eee6';
const GOLD = '#d28a12';
const INK = '#262420';

function Inner({ code }: { code: string }) {
  switch (code) {
    case 'US':
      return (
        <G>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Rect key={i} x="0" y={i * (24 / 7)} width="24" height={24 / 7} fill={i % 2 ? CREAM : RED} />
          ))}
          <Rect x="0" y="0" width="11" height={(24 * 4) / 7} fill={BLUE} />
        </G>
      );
    case 'TH':
      return (
        <G>
          <Rect x="0" y="0" width="24" height="24" fill={RED} />
          <Rect x="0" y="4" width="24" height="16" fill={CREAM} />
          <Rect x="0" y="9" width="24" height="6" fill={BLUE} />
        </G>
      );
    case 'JP':
      return (
        <G>
          <Rect width="24" height="24" fill={CREAM} />
          <Circle cx="12" cy="12" r="6" fill={RED} />
        </G>
      );
    case 'FR':
      return (
        <G>
          <Rect width="8" height="24" fill={BLUE} />
          <Rect x="8" width="8" height="24" fill={CREAM} />
          <Rect x="16" width="8" height="24" fill={RED} />
        </G>
      );
    case 'DE':
      return (
        <G>
          <Rect width="24" height="8" fill={INK} />
          <Rect y="8" width="24" height="8" fill={RED} />
          <Rect y="16" width="24" height="8" fill={GOLD} />
        </G>
      );
    case 'VN':
      return (
        <G>
          <Rect width="24" height="24" fill={RED} />
          <Path
            transform="translate(6 6)"
            d="M6 0.6 l1.6 3.6 3.9.4 -2.95 2.6 .87 3.83 L6 9.1 l-3.45 2.13 .87 -3.83 L0.47 4.6 4.4 4.2 Z"
            fill={GOLD}
          />
        </G>
      );
    default:
      return <Rect width="24" height="24" fill="#bdb6a6" />;
  }
}

export function Flag({ code = 'US', size = 22 }: { code?: string; size?: number }) {
  const rawId = React.useId();
  const id = `fl${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <ClipPath id={id}>
          <Circle cx="12" cy="12" r="11.4" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <Inner code={code} />
      </G>
      <Circle cx="12" cy="12" r="11.4" fill="none" stroke={C.line} strokeWidth="1.5" />
    </Svg>
  );
}

export default Flag;
