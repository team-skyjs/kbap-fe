/**
 * ranking.ts — the 7-tier ladder SSOT (fe-handoff §15-3, mirrors my-ranking.jsx
 * TIERS + TIER_COLOR + PTS, and FR-025). Tier NAMES live in i18n by stable key
 * (BE never sends a translated name); this file holds the domain numbers and the
 * warm medallion color ramp used by the ladder (department/medal design).
 */

export interface Tier {
  key: string; // stable i18n key
  level: number; // 1–7
  at: number; // cumulative entry points to reach this tier
  color: string; // ladder medallion color, warm ramp (light → deep) = my-ranking.jsx TIER_COLOR
}

/** Ordered low→high. `at` = points needed to enter. Colors = TIER_COLOR[level-1]. */
export const TIERS: readonly Tier[] = [
  { key: 'newcomer', level: 1, at: 0, color: '#E7B36A' },
  { key: 'taster', level: 2, at: 30, color: '#E89A44' },
  { key: 'explorer', level: 3, at: 80, color: '#E2580C' },
  { key: 'regular', level: 4, at: 180, color: '#CE4A15' },
  { key: 'gourmet', level: 5, at: 350, color: '#B23C18' },
  { key: 'kfood_master', level: 6, at: 600, color: '#8F3417' },
  { key: 'korean_at_heart', level: 7, at: 1000, color: '#6E2A12' },
] as const;

/** Points per activity (BE computes score; FE shows the weighting). my-ranking.jsx PTS. */
export const FACTOR_WEIGHTS = { reviews: 10, diversity: 5, scans: 2 } as const;

export function tierByKey(key: string): Tier | undefined {
  return TIERS.find((t) => t.key === key);
}
export function tierByLevel(level: number): Tier | undefined {
  return TIERS.find((t) => t.level === level);
}
