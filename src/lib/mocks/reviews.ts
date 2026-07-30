/**
 * mocks/reviews.ts — per-food reviews (GET /foods/{foodId}/reviews response,
 * FoodReviewsResponse). Mixed nationalities / body languages / one anonymized,
 * so the same-nationality filter, translation toggle, and anonymization all have
 * data to exercise. Foods without an entry return an empty response (empty state).
 */
import type { Review, ReviewPage } from '../api/types';

const KIMCHI_REVIEWS: Review[] = [
  {
    id: 'rv_1',
    foodId: 'kimchi-jjigae',
    rating: 5,
    body: "My rainy-day comfort food. Deep and properly spicy — I ask them to go easy on the pork.",
    bodyLanguage: 'en',
    translatedBody: null,
    authorNationality: 'US',
    authorRankTier: 'Foodie',
    anonymized: false,
    createdAt: '2026-06-30T09:20:00Z',
  },
  {
    id: 'rv_2',
    foodId: 'kimchi-jjigae',
    rating: 4,
    body: 'อร่อยมาก เผ็ดกำลังดี แต่ร้านนี้ใส่หมูเยอะ',
    bodyLanguage: 'th',
    translatedBody: 'Really tasty, nicely spicy — but this place adds a lot of pork.',
    authorNationality: 'TH',
    authorRankTier: 'Regular',
    anonymized: false,
    createdAt: '2026-06-28T12:00:00Z',
  },
  {
    id: 'rv_3',
    foodId: 'kimchi-jjigae',
    rating: 4,
    // translatedBody null → on-demand translation path (B): fetch on tap
    body: 'Herzhaft und sauer auf die gute Art. Etwas zu salzig für mich, aber ein super günstiges Mittagessen.',
    bodyLanguage: 'de',
    translatedBody: null,
    authorNationality: 'DE',
    authorRankTier: 'Explorer',
    anonymized: false,
    createdAt: '2026-06-24T18:30:00Z',
  },
  {
    id: 'rv_6',
    foodId: 'kimchi-jjigae',
    rating: 5,
    // on-demand + fails first attempt → exercises loading → error → retry → success
    body: '国産のキムチを使っていて、豆腐がとても滑らかでした。寒い日に最高です。',
    bodyLanguage: 'ja',
    translatedBody: null,
    authorNationality: 'JP',
    authorRankTier: 'Foodie',
    anonymized: false,
    createdAt: '2026-06-22T10:00:00Z',
  },
  {
    id: 'rv_4',
    foodId: 'kimchi-jjigae',
    rating: 4,
    body: 'Solid and reliable. Good portion for the price.',
    bodyLanguage: 'en',
    translatedBody: null,
    authorNationality: 'US',
    authorRankTier: 'Explorer',
    anonymized: false,
    createdAt: '2026-06-20T11:00:00Z',
  },
  {
    id: 'rv_5',
    foodId: 'kimchi-jjigae',
    rating: 3,
    body: 'A little too sour for my taste, but the tofu was fresh.',
    bodyLanguage: 'en',
    translatedBody: null,
    authorNationality: null,
    authorRankTier: null,
    anonymized: true,
    createdAt: '2026-06-12T08:00:00Z',
  },
];

// P-085: 평점 집계는 음식 상세(averageRating 계열)로 이동 — 목록 목은 keyset 페이지 형태
const MOCK_FOOD_REVIEWS: Record<string, ReviewPage> = {
  'kimchi-jjigae': { items: KIMCHI_REVIEWS, hasNext: false, nextCursor: null },
};

const EMPTY: ReviewPage = { items: [], hasNext: false, nextCursor: null };

export function mockFoodReviews(foodId: string): ReviewPage {
  return MOCK_FOOD_REVIEWS[foodId] ?? EMPTY;
}

/* ---- on-demand translation mock (strategy B) ---- */

/** "true" translations for reviews shipped WITHOUT a pre-translated body. */
const ON_DEMAND: Record<string, string> = {
  rv_3: 'Hearty and sour in a good way. A bit too salty for me, but a great cheap lunch.',
  rv_6: 'They use domestic kimchi and the tofu was so silky. Perfect on a cold day.',
};

// reviews that fail their FIRST on-demand attempt (to exercise error → retry).
const flakyAttempted = new Set<string>();

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Mock on-demand translation. Simulates latency; rv_6 fails once then succeeds
 * so the loading → error → retry → success path is demoable.
 */
export async function translateReviewMock(
  review: Review,
  targetLang: string,
): Promise<{ translatedBody: string; from: string }> {
  await delay(800);
  if (review.id === 'rv_6' && !flakyAttempted.has(review.id)) {
    flakyAttempted.add(review.id);
    throw new Error('translation service unavailable');
  }
  const translatedBody = review.translatedBody ?? ON_DEMAND[review.id] ?? `[${targetLang}] ${review.body}`;
  return { translatedBody, from: review.bodyLanguage ?? '' };
}
