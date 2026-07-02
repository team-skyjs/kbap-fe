/**
 * mocks/ranking.ts — mock GET /me/ranking, typed against the contract Ranking
 * (with breakdown). Persona = the same signed-in user as mocks/me.ts.
 *
 * Internally consistent with ranking.ts TIERS + FACTOR_WEIGHTS:
 *   reviews  8 × 10 = 80
 *   diversity 6 ×  5 = 30
 *   scans     5 ×  2 = 10   → score 120 (inside explorer 80..180)
 *   nextTier regular @180 → pointsToNext 60.
 */
import type { Ranking } from '../api/types';

export const MOCK_RANKING_DETAIL: Ranking = {
  tier: 'explorer',
  level: 3,
  score: 120,
  nextTier: 'regular',
  pointsToNext: 60,
  breakdown: {
    reviews: { count: 8, points: 80 },
    diversity: { count: 6, points: 30 },
    scans: { count: 5, points: 10 },
  },
};
