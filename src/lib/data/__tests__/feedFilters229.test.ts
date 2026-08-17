/**
 * P-229(KB-307): 리뷰 피드 필터 — 서버 쿼리 실측(country·foodId·복합) +
 * 클라 필터 금지·소팅 부재(BE 대기) 잠금.
 */
jest.mock('@/lib/flags', () => ({ FLAGS: { reviewsLiveEnabled: true }, isProdChannel: () => false }));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn().mockResolvedValue(true) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
const mockGet = jest.fn().mockResolvedValue({ items: [], hasNext: false });
jest.mock('@/lib/api/client', () => ({
  api: { get: (p: string) => mockGet(p) },
  apiLang: () => 'en',
}));

import { fetchGlobalReviewsPage } from '../useFoodReviews';

beforeEach(() => jest.clearAllMocks());

it('국가 필터 = countryCode 서버 쿼리(클라 필터 아님)', async () => {
  await fetchGlobalReviewsPage(null, { countryCode: 'US' });
  expect(mockGet).toHaveBeenCalledWith('/api/reviews?lang=en&countryCode=US');
});

it('음식 필터 = foodId 서버 쿼리', async () => {
  await fetchGlobalReviewsPage(null, { foodId: '7' });
  expect(mockGet).toHaveBeenCalledWith('/api/reviews?lang=en&foodId=7');
});

it('복합(국가+음식) 동시 적용 + 커서 공존', async () => {
  await fetchGlobalReviewsPage('42', { countryCode: 'JP', foodId: '7' });
  expect(mockGet).toHaveBeenCalledWith('/api/reviews?lang=en&cursor=42&countryCode=JP&foodId=7');
});

it('무필터 = 현행 쿼리 무변(회귀 방지)', async () => {
  await fetchGlobalReviewsPage(null);
  expect(mockGet).toHaveBeenCalledWith('/api/reviews?lang=en');
});

it('배선 소스 잠금 — 필터 UI·쿼리키 프리픽스·클라 소팅 부재', () => {
  const fs = require('fs');
  const feed = fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8') as string;
  expect(feed).toContain("testID=\"feed-filter-country\"");
  expect(feed).toContain("testID=\"feed-filter-food\"");
  expect(feed).toContain('countryCode: sameNatOnly ? nationality : null');
  expect(feed).toContain("foodId: foodFilter?.foodId ?? null");
  // 빈 결과 = 필터 초기화 CTA(재량 채택)
  expect(feed).toContain("t('reviews.clearFilters')");
  // 클라 로컬 소팅 금지(커서 페이지네이션 왜곡) — sort 호출 부재
  expect(feed).not.toMatch(/reviews\s*\.\s*sort\(/);
  const hook = fs.readFileSync('src/lib/data/useFoodReviews.ts', 'utf8') as string;
  // 프리픽스 유지 — 좋아요 낙관·작성 무효화의 프리픽스 매칭 안전
  expect(hook).toContain("queryKey: ['reviews', 'global', filters.countryCode ?? 'all', filters.foodId ?? 'all']");
});
