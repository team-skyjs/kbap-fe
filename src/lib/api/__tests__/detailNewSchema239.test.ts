/**
 * P-239(KB-30) 🚨 핫픽스: 상세 신스키마 어댑터 — reviewSummary 1순위(★요약 소실
 * 복구)·avoidedIngredients 재료 조인·recentReviews 인라인·구스키마(prod) 폴백.
 */
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));

import { adaptFoodDetail } from '../foodAdapter';
import type { FoodDetailWire } from '../foodDetailTypes';

const BASE = {
  name: 'Kimchi Stew',
  koreanName: '김치찌개',
  imageRef: null,
  description: 'stew',
  spiciness: 4,
  bookmarked: false,
  overallRiskStatus: 'CAUTION',
  ingredients: [],
} as unknown as FoodDetailWire;

describe('① reviewSummary 1순위 — dev ★요약 소실 복구', () => {
  it('신스키마(reviewSummary.overall) = 요약 채택 + missing false', () => {
    const d = adaptFoodDetail(
      { ...BASE, reviewSummary: { overall: { averageRating: 4.3, reviewCount: 12 }, sameCountry: { averageRating: 4.0, reviewCount: 3 } } },
      '7',
    );
    expect(d.overall).toEqual({ average: 4.3, count: 12 });
    expect(d.sameNationality).toEqual({ average: 4.0, count: 3 });
    expect(d.reviewSummaryMissing).toBe(false);
  });

  it('비회원 신스키마 — overall 공개·sameCountry null = overall만 채택', () => {
    const d = adaptFoodDetail({ ...BASE, reviewSummary: { overall: { averageRating: 4.3, reviewCount: 12 } } }, '7');
    expect(d.overall).toEqual({ average: 4.3, count: 12 });
    expect(d.sameNationality).toEqual({ average: null, count: 0 });
  });

  it('구스키마(review — prod 폴백) 무변 · 평면 폴백 무변', () => {
    const oldNested = adaptFoodDetail({ ...BASE, review: { overall: { averageRating: 3.5, reviewCount: 2 } } }, '7');
    expect(oldNested.overall).toEqual({ average: 3.5, count: 2 });
    const flat = adaptFoodDetail({ ...BASE, averageRating: 4.0, reviewCount: 7 }, '7');
    expect(flat.overall).toEqual({ average: 4.0, count: 7 });
  });
});

describe('② 재료 마크 조인 — ingredients × avoidedIngredients', () => {
  const ING = [
    { code: 'PORK', name: 'Pork', inclusionPercent: 90 },
    { code: 'ONION', name: 'Onion', inclusionPercent: 100 },
  ] as FoodDetailWire['ingredients'];

  it('회원(배열) = 겹침만 위험 마크·미겹침 = SAFE(서버 의미 — 구계약과 동일 정보량)', () => {
    const d = adaptFoodDetail(
      { ...BASE, ingredients: ING, avoidedIngredients: [{ code: 'PORK', riskStatus: 'DANGER' }] },
      '7',
    );
    expect(d.ingredients.find((i) => i.code === 'PORK')?.risk).toBe('danger');
    expect(d.ingredients.find((i) => i.code === 'ONION')?.risk).toBe('safe');
  });

  it('비회원(null/부재) = unable(판정 없음 — 게스트 렌더는 마크 슬롯 미렌더)', () => {
    const d = adaptFoodDetail({ ...BASE, ingredients: ING, avoidedIngredients: null }, '7');
    expect(d.ingredients.every((i) => i.risk === 'unable')).toBe(true);
  });

  it('구스키마(재료 내 riskStatus — prod) = 기존 경로 무변 + 합성 키 유지', () => {
    const d = adaptFoodDetail(
      { ...BASE, ingredients: [{ name: 'Pork', inclusionPercent: 90, riskStatus: 'DANGER' }] as FoodDetailWire['ingredients'] },
      '7',
    );
    expect(d.ingredients[0].risk).toBe('danger');
    expect(d.ingredients[0].code).toBe('ing:0:Pork'); // code 부재 = 합성 키 폴백
  });

  it('신스키마 = 실코드 채택(스캔 v1 폴백 조인·owner 파라미터 정확도)', () => {
    const d = adaptFoodDetail({ ...BASE, ingredients: ING, avoidedIngredients: [] }, '7');
    expect(d.ingredients[0].code).toBe('PORK');
  });
});

describe('③ recentReviews 인라인', () => {
  it('있으면 파싱(food null·게스트 likedByMe false 계약) — 화면이 목록 호출 생략', () => {
    const d = adaptFoodDetail(
      {
        ...BASE,
        recentReviews: [
          { reviewId: 1, foodId: 7, memberId: 9, rating: 5, content: 'good', imageUrls: [], createdAt: '2026-08-19T00:00:00Z', author: null, likeCount: 2, likedByMe: false },
        ] as never,
      },
      '7',
    );
    expect(d.recentReviews).toHaveLength(1);
    expect(d.recentReviews![0].rating).toBe(5);
  });

  it('부재(prod) = undefined — 기존 목록 호출 폴백(빈 배열과 구분)', () => {
    expect(adaptFoodDetail({ ...BASE }, '7').recentReviews).toBeUndefined();
    expect(adaptFoodDetail({ ...BASE, recentReviews: [] }, '7').recentReviews).toEqual([]);
  });

  it('배선 — 인라인 있으면 useFoodReviews 비활성(요청 1개 절감) + X-API-Version 무변', () => {
    const fs = require('fs');
    const detail = fs.readFileSync('src/app/food/[id]/index.tsx', 'utf8') as string;
    expect(detail).toContain('const hasInline = food.recentReviews !== undefined;');
    expect(detail).toContain("useFoodReviews(FLAGS.reviewsEnabled && !hasInline ? id : '')");
    // 상세는 1.0 유지(버전 무관 단일 핸들러 — 게이트 불필요 판명)
    expect(fs.readFileSync('src/lib/data/useFoods.ts', 'utf8')).not.toContain("X-API-Version");
  });
});
