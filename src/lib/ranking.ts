/**
 * ranking.ts — the 7-tier ladder SSOT (fe-handoff §15-3, mirrors my-ranking.jsx
 * TIERS and FR-025). Tier NAMES are not here: they're i18n'd by stable key
 * (BE never sends a translated name). This file holds only domain numbers +
 * the warm medallion color ramp (department/medal design).
 *
 * Entry points (cumulative) and factor weights match FR-025 exactly.
 */

export interface Tier {
  key: string; // stable i18n key
  level: number; // 1–7
  at: number; // cumulative entry points to reach this tier
  color: string; // medallion color, warm lamp ramp (muted → deep)
}

/** Ordered low→high. `at` = points needed to enter. */
export const TIERS: readonly Tier[] = [
  { key: 'newcomer', level: 1, at: 0, color: '#B9A48C' },
  { key: 'taster', level: 2, at: 30, color: '#D0A05B' },
  { key: 'explorer', level: 3, at: 80, color: '#E08A3C' },
  { key: 'regular', level: 4, at: 180, color: '#E2580C' },
  { key: 'gourmet', level: 5, at: 350, color: '#C6461A' },
  { key: 'kfood_master', level: 6, at: 600, color: '#A83A26' },
  { key: 'korean_at_heart', level: 7, at: 1000, color: '#8A2F22' },
] as const;

/** Points per activity (BE computes score; FE shows the weighting). */
export const FACTOR_WEIGHTS = { reviews: 10, diversity: 5, scans: 2 } as const;

export function tierByKey(key: string): Tier | undefined {
  return TIERS.find((t) => t.key === key);
}
export function tierByLevel(level: number): Tier | undefined {
  return TIERS.find((t) => t.level === level);
}
