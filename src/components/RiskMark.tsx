/**
 * RiskMark — the fixed 4-state risk badge (Constitution III, NON-NEGOTIABLE).
 * KB-429 재리뷰 판정(커맨드 센터, Codex #27 P1): 11px급에서 글리프 대비가 형태
 * 채널로 부족 → **상태별 실루엣 유지**가 헌법 정본, 시안에서는 색·글리프만 채택:
 *   safe = 원 + ✓ · caution = 삼각 + ! · danger = 팔각 + ✕ · unable = 마름모 + ?
 * 실루엣·글리프·색 페어링은 불변 — 리컬러/리셰이프/교차 금지. 색맹 시뮬 스냅샷 =
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

export function Silhouette({ state }: { state: RiskState }) {
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
