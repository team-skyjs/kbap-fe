/**
 * mocks/me.ts — mock signed-in user + ranking, typed against the contract.
 * Persona matches mocks/foods.ts (shellfish allergy).
 */
import type { Ranking, Review, User } from '../api/types';

/**
 * Ranking summary reuses the 7-tier FR-025 model (same source as the ranking
 * detail screen — see lib/ranking.ts + mocks/ranking.ts). tier is the stable key.
 */
export const MOCK_RANKING: Ranking = {
  tier: 'explorer',
  level: 3,
  score: 120,
  nextTier: 'regular',
  pointsToNext: 60,
};

/**
 * restrictions are now a FLAT list of ingredient codes (KB-6 override, no
 * category). `kind` is vestigial (kept for the contract type) — always 'allergy'.
 */
export const MOCK_USER: User = {
  id: 'u_001',
  email: 'mina@kbap.app',
  nickname: 'Mina',
  nationality: 'US',
  readerLanguage: 'en',
  spiceTolerance: 6,
  restrictions: [
    { kind: 'allergy', code: 'SHRIMP' },
    { kind: 'allergy', code: 'CRAB' },
    { kind: 'allergy', code: 'SEAFOOD' },
    { kind: 'allergy', code: 'PEANUT' },
    { kind: 'allergy', code: 'EGG' },
    { kind: 'allergy', code: 'SESAME' },
    { kind: 'allergy', code: 'PORK' },
    { kind: 'allergy', code: 'FISH_SAUCE' },
  ],
  rank: MOCK_RANKING,
};

export const MOCK_MY_REVIEWS: Review[] = [
  {
    id: 'r_101',
    foodId: 'bibimbap',
    rating: 5,
    body: 'Fresh and balanced — asked for no gochujang and it was perfect.',
    bodyLanguage: 'en',
    translatedBody: null,
    authorNationality: 'US',
    authorRankTier: 'Explorer',
    anonymized: false,
    createdAt: '2026-06-20T12:30:00Z',
  },
  {
    id: 'r_102',
    foodId: 'samgyeopsal',
    rating: 4,
    body: 'Great grilled pork, the staff helped me avoid the shrimp dip.',
    bodyLanguage: 'en',
    translatedBody: null,
    authorNationality: 'US',
    authorRankTier: 'Explorer',
    anonymized: false,
    createdAt: '2026-06-15T19:05:00Z',
  },
];
