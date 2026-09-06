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

it('배선 소스 잠금 — 쿼리키 프리픽스·클라 소팅 부재 (KB-430: 국가·음식·별점 칩 UI 숨김 — 훅 계약은 위 케이스로 유지)', () => {
  const fs = require('fs');
  const feed = fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8') as string;
  // KB-430 시안(4150:17070) 컨트롤 행 = 정렬 드롭다운만 — 구 필터 칩 UI 소멸
  expect(feed).toContain('testID="feed-sort"');
  expect(feed).not.toContain('feed-filter-country');
  expect(feed).not.toContain('feed-filter-food');
  // 클라 로컬 소팅 금지(커서 페이지네이션 왜곡) — sort 호출 부재
  expect(feed).not.toMatch(/reviews\s*\.\s*sort\(/);
  const hook = fs.readFileSync('src/lib/data/useFoodReviews.ts', 'utf8') as string;
  // 프리픽스 유지 — 좋아요 낙관·작성 무효화의 프리픽스 매칭 안전(P-237에서 sort·rating 키 확장)
  expect(hook).toContain("'reviews', 'global',");
  expect(hook).toContain("filters.sort ?? 'latest', filters.minRating ?? 0, filters.maxRating ?? 5,");
});

/* ---- P-237(KB-346): 소팅 5종 + 별점 필터 ---- */
describe('P-237: sort·rating 서버 쿼리', () => {
  it.each([
    ['rating_high'], ['rating_low'], ['food_review_count'], ['helpful'],
  ] as const)('sort=%s 쿼리 실측(소문자 정확 일치)', async (sort) => {
    await fetchGlobalReviewsPage(null, { sort });
    expect(mockGet).toHaveBeenCalledWith(`/api/reviews?lang=en&sort=${sort}`);
  });

  it('latest(기본) = sort 미전송 — 현행 쿼리 무변', async () => {
    await fetchGlobalReviewsPage(null, { sort: 'latest' });
    expect(mockGet).toHaveBeenCalledWith('/api/reviews?lang=en');
  });

  it('별점 페어 — min만/페어/min>max(클라 방어 = 미전송)', async () => {
    await fetchGlobalReviewsPage(null, { minRating: 4 });
    expect(mockGet).toHaveBeenCalledWith('/api/reviews?lang=en&minRating=4');
    await fetchGlobalReviewsPage(null, { minRating: 2, maxRating: 4 });
    expect(mockGet).toHaveBeenCalledWith('/api/reviews?lang=en&minRating=2&maxRating=4');
    mockGet.mockClear();
    await fetchGlobalReviewsPage(null, { minRating: 5, maxRating: 2 }); // 잘못된 페어
    expect(mockGet).toHaveBeenCalledWith('/api/reviews?lang=en'); // 아예 안 보냄(400 예방)
  });

  it('복합 — 국가+음식+소팅+별점 동시', async () => {
    await fetchGlobalReviewsPage('tok', { countryCode: 'US', foodId: '7', sort: 'helpful', minRating: 3 });
    expect(mockGet).toHaveBeenCalledWith('/api/reviews?lang=en&cursor=tok&countryCode=US&foodId=7&sort=helpful&minRating=3');
  });

  it('🔴 커서 규약 — 정렬·필터 변경 = 쿼리키 분리(구 커서가 새 정렬로 전달될 경로 없음)', () => {
    const hook = require('fs').readFileSync('src/lib/data/useFoodReviews.ts', 'utf8') as string;
    // 키에 sort·rating 포함(react-query 키 분리 = 첫 페이지 자연 재조회) + 수동 리셋 부재
    expect(hook).toContain("filters.sort ?? 'latest'");
    expect(hook).not.toContain('resetQueries'); // 수동 리셋 금지
    // 커서는 불투명 토큰 그대로 전달(해석·조립 없음)
    expect(hook).toContain("q.set('cursor', cursor)");
  });
});
