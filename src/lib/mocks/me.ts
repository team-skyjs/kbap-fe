/**
 * mocks/me.ts — mock signed-in user + ranking, typed against the contract.
 * Persona matches mocks/foods.ts (shellfish allergy).
 */
import type { Ranking, Review, User } from '../api/types';

/** Fixed ranking ladder (UI domain). */
export const RANK_TIERS = ['Rookie', 'Explorer', 'Regular', 'Foodie', 'Native'];

export const MOCK_RANKING: Ranking = {
  tier: 'Regular',
  level: 3,
  score: 320,
  nextTier: 'Foodie',
  pointsToNext: 80,
};

export const MOCK_USER: User = {
  id: 'u_001',
  nickname: 'Mina',
  nationality: 'US',
  readerLanguage: 'en',
  spiceTolerance: 6,
  restrictions: [
    { kind: 'allergy', code: 'allergy:shellfish' },
    { kind: 'allergy', code: 'allergy:shrimp' },
    { kind: 'allergy', code: 'allergy:crab' },
    { kind: 'allergy', code: 'allergy:peanut' },
    { kind: 'allergy', code: 'allergy:egg' },
    { kind: 'allergy', code: 'allergy:sesame' },
    { kind: 'diet', code: 'diet:pescatarian' },
    { kind: 'religion', code: 'religion:nopork' },
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
