/**
 * foodAdapter — 상세 bookmarked 매핑 (KB-142 후속, 계약 갭 해소 2026-07-15).
 * 서버 필드가 저장 버튼의 진실이 됐으므로 true/false/누락(방어) 매핑을 잠근다.
 */
import { adaptFoodDetail, adaptMenuSummary } from '../foodAdapter';
import type { FoodDetailWire } from '../foodDetailTypes';

const WIRE: FoodDetailWire = {
  name: 'Bibimbap',
  koreanName: '비빔밥',
  imageRef: null,
  description: 'rice bowl',
  spiciness: 2,
  bookmarked: false,
  overallRiskStatus: 'SAFE',
  ingredients: [],
};

it('bookmarked true/false가 그대로 매핑된다', () => {
  expect(adaptFoodDetail({ ...WIRE, bookmarked: true }, '7').bookmarked).toBe(true);
  expect(adaptFoodDetail({ ...WIRE, bookmarked: false }, '7').bookmarked).toBe(false);
});

it('bookmarked 누락/비불리언은 false로 방어 (비회원 조회 = 항상 false 계약)', () => {
  const noField = { ...WIRE } as Partial<FoodDetailWire>;
  delete noField.bookmarked;
  expect(adaptFoodDetail(noField as FoodDetailWire, '7').bookmarked).toBe(false);
});

/* ---- P-107(KB-275, #121): 리뷰 요약 겸수신 ---- */

it('신계약 중첩(스냅샷 8/3) — overall·sameCountry 수신, count 0 = average null(0.0 강등)', () => {
  const d = adaptFoodDetail(
    { ...WIRE, review: { blur: false, overall: { averageRating: 3.7, reviewCount: 3 }, sameCountry: { averageRating: 4.5, reviewCount: 2 } } },
    '7',
  );
  expect(d.overall).toEqual({ average: 3.7, count: 3 });
  expect(d.sameNationality).toEqual({ average: 4.5, count: 2 });
  // 리뷰 없음 = 계약상 0.0·0 (null 없음) → 내부 null (화면 '—', 0.0점 오표시 금지)
  const empty = adaptFoodDetail(
    { ...WIRE, review: { blur: false, overall: { averageRating: 0.0, reviewCount: 0 }, sameCountry: { averageRating: 0.0, reviewCount: 0 } } },
    '7',
  );
  expect(empty.overall).toEqual({ average: null, count: 0 });
  expect(empty.sameNationality).toEqual({ average: null, count: 0 });
});

it('blur=true(비회원 기본값 0.0·0) — 수치 미노출용 null/0으로 강등', () => {
  const d = adaptFoodDetail(
    { ...WIRE, review: { blur: true, overall: { averageRating: 0.0, reviewCount: 0 }, sameCountry: { averageRating: 0.0, reviewCount: 0 } } },
    '7',
  );
  expect(d.overall).toEqual({ average: null, count: 0 });
});

it('발주문 단층 중첩({averageRating,…}) — 겸수신', () => {
  const d = adaptFoodDetail({ ...WIRE, review: { averageRating: 4.2, reviewCount: 5, sameCountryAverageRating: 3.9 } }, '7');
  expect(d.overall).toEqual({ average: 4.2, count: 5 });
  expect(d.sameNationality).toEqual({ average: 3.9, count: 0 });
});

it('구 평면(prod 폴백) — review 부재 시 평면 필드 수신', () => {
  const d = adaptFoodDetail({ ...WIRE, averageRating: 4.0, reviewCount: 7, sameCountryAverageRating: null }, '7');
  expect(d.overall).toEqual({ average: 4.0, count: 7 });
  expect(d.sameNationality).toEqual({ average: null, count: 0 });
});

it('둘 다 없음 — null/0 (표시 "—")', () => {
  const d = adaptFoodDetail({ ...WIRE }, '7');
  expect(d.overall).toEqual({ average: null, count: 0 });
  expect(d.sameNationality).toEqual({ average: null, count: 0 });
});

describe('P-165(#146): 목록 리뷰 요약(FoodSummaryResponse.review) 실값', () => {
  const base = { foodId: 1, name: 'Kimbap', koreanName: '김밥', spiciness: 0, overallRiskStatus: 'SAFE' as const };

  it('count>0 → 별점·수 실값', () => {
    const c = adaptMenuSummary({ ...base, review: { averageRating: 4.2, count: 5 } });
    expect(c.overall).toEqual({ average: 4.2, count: 5 });
  });

  it('리뷰 0개(0.0·0) → average null·count 0 ("— · 0"은 이때만)', () => {
    const c = adaptMenuSummary({ ...base, review: { averageRating: 0, count: 0 } });
    expect(c.overall).toEqual({ average: null, count: 0 });
  });

  it('구응답(review 부재) → 동일 강등(무크래시)', () => {
    const c = adaptMenuSummary(base);
    expect(c.overall).toEqual({ average: null, count: 0 });
  });
});

/* ---- P-206: 리뷰 요약 마스킹(blur) vs 실측 0건 구분 ---- */
describe('P-206: reviewsMasked', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { adaptFoodDetail } = require('../foodAdapter') as typeof import('../foodAdapter');
  const base = { name: 'Squid', koreanName: '오징어튀김', overallRiskStatus: 'SAFE', ingredients: [] };

  it('blur=true(게스트 실측 — 0.0/0은 마스킹 값) → reviewsMasked true, count 0 유지', () => {
    const d = adaptFoodDetail({ ...base, review: { blur: true, overall: { averageRating: 0.0, reviewCount: 0 }, sameCountry: { averageRating: 0.0, reviewCount: 0 } } } as never, '501');
    expect(d.reviewsMasked).toBe(true);
    expect(d.overall.count).toBe(0);
  });

  it('blur=false + 실측 0건 → masked false(진짜 be-first 대상)', () => {
    const d = adaptFoodDetail({ ...base, review: { blur: false, overall: { averageRating: 0.0, reviewCount: 0 } } } as never, '501');
    expect(d.reviewsMasked).toBe(false);
  });

  it('구 평면 응답(review 부재) → masked false(prod 폴백 무변)', () => {
    const d = adaptFoodDetail({ ...base, averageRating: 4.2, reviewCount: 5 } as never, '501');
    expect(d.reviewsMasked).toBe(false);
    expect(d.overall.count).toBe(5);
  });
});
