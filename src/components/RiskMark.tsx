/**
 * RiskMark — the fixed 4-state risk badge (Constitution III, NON-NEGOTIABLE).
 * 9/5 예진 확정("싹 다 시안대로"): 실루엣 = 4상태 원형 통일, 형태 구분 = 글리프.
 * 글리프·원 경로 = 시안 .fig 원본 디코드(스펙 bridge/design/4th/icons/mark-*.svg,
 * 22 그리드) — 형태·치수 무수정, 색만 상태색/panel로 치환. 글리프·색 페어링 불변.
 * 색맹 시뮬 스냅샷 = docs/design/riskmark-colorblind.svg (PR 첨부분).
 */
import * as React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { color as C, type RiskState } from '@/lib/theme';

// Fixed per-state color (silhouette/glyph are defined below). Human-readable
// labels are NOT here — they are reader-language i18n (`risk.*`), see RiskPill.
export const RISK: Record<RiskState, { color: string }> = {
  safe: { color: C.riskSafe },
  caution: { color: C.riskCaution },
  danger: { color: C.riskDanger },
  unable: { color: C.riskUnable },
};

/** 시안 mark-*.svg의 글리프 경로(22 그리드) — ✓ ! ✕ ? 스트로크 확장형 원본 그대로. */
const GLYPH: Record<RiskState, { d: string; transform: string; fillRule?: 'nonzero' }> = {
  safe: {
    d: 'M9.061 1.061C9.646 0.475 9.646 -0.475 9.061 -1.061C8.475 -1.646 7.525 -1.646 6.939 -1.061L8 0L9.061 1.061ZM2.5 5.5L1.439 6.561C2.025 7.146 2.975 7.146 3.561 6.561L2.5 5.5ZM1.061 1.939C0.475 1.354 -0.475 1.354 -1.061 1.939C-1.646 2.525 -1.646 3.475 -1.061 4.061L0 3L1.061 1.939ZM8 0L6.939 -1.061L1.439 4.439L2.5 5.5L3.561 6.561L9.061 1.061L8 0ZM2.5 5.5L3.561 4.439L1.061 1.939L0 3L-1.061 4.061L1.439 6.561L2.5 5.5Z',
    transform: 'matrix(1,0,0,1,7,8)',
  },
  caution: {
    d: 'M1.495 0C2.254 0 2.863 0.627 2.842 1.386L2.679 7.167C2.661 7.809 2.136 8.319 1.495 8.319C0.853 8.319 0.328 7.809 0.31 7.167L0.147 1.386C0.126 0.627 0.735 0 1.495 0ZM0 10.649C-0.018 9.894 0.666 9.279 1.513 9.287C2.314 9.279 3.007 9.894 3.007 10.649C3.007 11.412 2.314 12.027 1.513 12.027C0.666 12.027 -0.018 11.412 0 10.649Z',
    transform: 'matrix(1,0,0,1,9.497,4.986)',
    fillRule: 'nonzero',
  },
  danger: {
    d: 'M7.061 1.061C7.646 0.475 7.646 -0.475 7.061 -1.061C6.475 -1.646 5.525 -1.646 4.939 -1.061L6 0L7.061 1.061ZM-1.061 4.939C-1.646 5.525 -1.646 6.475 -1.061 7.061C-0.475 7.646 0.475 7.646 1.061 7.061L0 6L-1.061 4.939ZM1.061 -1.061C0.475 -1.646 -0.475 -1.646 -1.061 -1.061C-1.646 -0.475 -1.646 0.475 -1.061 1.061L0 0L1.061 -1.061ZM4.939 7.061C5.525 7.646 6.475 7.646 7.061 7.061C7.646 6.475 7.646 5.525 7.061 4.939L6 6L4.939 7.061ZM6 0L4.939 -1.061L-1.061 4.939L0 6L1.061 7.061L7.061 1.061L6 0ZM0 0L-1.061 1.061L4.939 7.061L6 6L7.061 4.939L1.061 -1.061L0 0Z',
    transform: 'matrix(1,0,0,1,8,8)',
  },
  unable: {
    d: 'M2.22 7.439C2.227 5.609 2.72 5.05 3.602 4.499C4.234 4.087 4.727 3.631 4.719 2.955C4.727 2.22 4.153 1.742 3.44 1.735C3.069 1.739 2.711 1.875 2.457 2.136C2.061 2.542 1.638 3.058 1.071 3.058C0.483 3.058 -0.015 2.563 0.172 2.005C0.627 0.654 1.927 0 3.455 0C5.506 0 6.954 1.066 6.954 2.882C6.954 4.095 6.329 4.859 5.366 5.44C4.536 5.932 4.168 6.41 4.161 7.439C4.161 7.529 4.088 7.601 3.999 7.601L2.382 7.601C2.292 7.601 2.22 7.529 2.22 7.439ZM1.999 9.689C1.985 9.012 2.543 8.461 3.234 8.468C3.889 8.461 4.455 9.012 4.455 9.689C4.455 10.372 3.889 10.924 3.234 10.924C2.543 10.924 1.985 10.372 1.999 9.689Z',
    transform: 'matrix(1,0,0,1,7.523,5.538)',
    fillRule: 'nonzero',
  },
};

/** 시안 글리프(상태별 상이 — 소비처가 색만 지정해 그릴 때 사용). */
export function RiskGlyph({ state, fill }: { state: RiskState; fill: string }) {
  const g = GLYPH[state];
  return <Path d={g.d} fill={fill} fillRule={g.fillRule} transform={g.transform} />;
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
      <Svg width={size} height={size} viewBox="0 0 22 22">
        <Circle cx="11" cy="11" r="10" stroke={c} strokeWidth={2} fill="none" />
        <RiskGlyph state={state} fill={c} />
      </Svg>
    );
  }
  // solid: 원 fill = 상태색, 글리프 = panel 색(시안 흰)
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Circle cx="11" cy="11" r="11" fill={c} />
      <RiskGlyph state={state} fill={C.panel} />
    </Svg>
  );
}

/** Tiny silhouette badge for dense lists. */
export function RiskDot({ state = 'safe', size = 16 }: { state?: RiskState; size?: number }) {
  return <RiskMark state={state} size={size} variant="solid" />;
}

export default RiskMark;
