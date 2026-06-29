/**
 * RiskMark — the fixed 4-state risk badge (Constitution III, NON-NEGOTIABLE).
 * Each state = unique SILHOUETTE (colorblind-safe) + unique GLYPH + fixed color:
 *   safe = circle + check       (#2f8f5b)
 *   caution = triangle + !       (#d28a12)
 *   danger = octagon + ✕         (#cf3a2c)
 *   unable = diamond + ?         (#5b6470)
 * Ported 1:1 from mockup icons.jsx. NEVER recolor/reshape these.
 */
import * as React from 'react';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { color as C, type RiskState } from '@/lib/theme';

export const RISK: Record<RiskState, { color: string; label: string; ko: string }> = {
  safe: { color: C.riskSafe, label: 'Safe', ko: '안전' },
  caution: { color: C.riskCaution, label: 'Caution', ko: '주의' },
  danger: { color: C.riskDanger, label: 'Danger', ko: '위험' },
  unable: { color: C.riskUnable, label: 'Unable to assess', ko: '판정불가' },
};

function Silhouette({ state }: { state: RiskState }) {
  switch (state) {
    case 'safe':
      return <Circle cx="12" cy="12" r="10.2" />;
    case 'caution':
      return <Path d="M12 2.6 L22 20 H2 Z" />;
    case 'danger':
      return <Path d="M8.2 2.5 H15.8 L21.5 8.2 V15.8 L15.8 21.5 H8.2 L2.5 15.8 V8.2 Z" />;
    case 'unable':
      return <Path d="M12 1.8 L22.2 12 L12 22.2 L1.8 12 Z" />;
  }
}

function GlyphInner({ state, stroke }: { state: RiskState; stroke: string }) {
  switch (state) {
    case 'safe':
      return <Path d="M7.5 12.4 l3 3 L16.6 8.8" fill="none" stroke={stroke} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />;
    case 'caution':
      return (
        <G stroke={stroke} strokeWidth={2.4} strokeLinecap="round">
          <Line x1="12" y1="9.5" x2="12" y2="14.4" />
          <Circle cx="12" cy="17.6" r="0.2" strokeWidth={2.6} />
        </G>
      );
    case 'danger':
      return (
        <G stroke={stroke} strokeWidth={2.4} strokeLinecap="round">
          <Line x1="8.6" y1="8.6" x2="15.4" y2="15.4" />
          <Line x1="15.4" y1="8.6" x2="8.6" y2="15.4" />
        </G>
      );
    case 'unable':
      return (
        <G stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M9.4 9.6 C9.4 7.4 11.9 6.6 13.4 7.8 C14.9 9 14.1 10.7 12.7 11.5 C11.9 12 11.7 12.6 11.7 13.5" />
          <Circle cx="11.7" cy="16.5" r="0.2" strokeWidth={2.4} />
        </G>
      );
  }
}

export function RiskMark({
  state = 'safe',
  size = 28,
  variant = 'solid',
}: {
  state?: RiskState;
  size?: number;
  variant?: 'solid' | 'outline';
}) {
  const c = RISK[state].color;
  if (variant === 'outline') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Silhouette state={state} />
        </G>
        <GlyphInner state={state} stroke={c} />
      </Svg>
    );
  }
  // solid: filled silhouette, glyph cut to panel color
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={c} stroke={c} strokeWidth={1.4} strokeLinejoin="round">
        <Silhouette state={state} />
      </G>
      <GlyphInner state={state} stroke={C.panel} />
    </Svg>
  );
}

/** Tiny silhouette badge for dense lists. */
export function RiskDot({ state = 'safe', size = 16 }: { state?: RiskState; size?: number }) {
  return <RiskMark state={state} size={size} variant="solid" />;
}

export default RiskMark;
