/**
 * RiskMark — the fixed 4-state risk badge (Constitution III, NON-NEGOTIABLE).
 * KB-429(디자인 4차, 4064:789 — 커맨드 센터 헌법 게이트 판단): 실루엣은 4상태
 * **원형 통일**, 색맹 안전의 "형태 구분"은 **글리프 상이**가 담당:
 *   safe = ✓ · danger = ✕ · caution = ! · unable = ?  (+ 고정 색)
 * 글리프·색 페어링은 불변 — 리컬러/글리프 교차 금지. 색맹 시뮬 스냅샷 =
 * docs/design/riskmark-colorblind.svg (PR 첨부분).
 */
import * as React from 'react';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { color as C, type RiskState } from '@/lib/theme';

// Fixed per-state color (silhouette/glyph are defined below). Human-readable
// labels are NOT here — they are reader-language i18n (`risk.*`), see RiskPill.
export const RISK: Record<RiskState, { color: string }> = {
  safe: { color: C.riskSafe },
  caution: { color: C.riskCaution },
  danger: { color: C.riskDanger },
  unable: { color: C.riskUnable },
};

function Silhouette(_props: { state: RiskState }) {
  // KB-429: 4상태 전부 원형(4064:789) — 상태 구분은 글리프(✓ ✕ ! ?)와 색.
  return <Circle cx="12" cy="12" r="10.2" />;
}

function GlyphInner({ state, stroke }: { state: RiskState; stroke: string }) {
  switch (state) {
    case 'safe':
      return <Path d="M7.5 12.4 l3 3 L16.6 8.8" fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />;
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
