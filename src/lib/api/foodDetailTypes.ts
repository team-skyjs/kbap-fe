/**
 * foodDetailTypes.ts — WIRE types for GET /api/v1/foods/{foodId} (KB-70).
 * Mirror the redeployed Swagger EXACTLY (FoodDetailResponse / IngredientResponse).
 * Kept separate from our internal contract types; foodAdapter.ts translates
 * BE → internal so the detail screen never sees BE enums/field names.
 *
 *   GET /api/v1/foods/{foodId}?lang=<bcp47>   (foodId: int64 path param)
 *   res: BaseResponse<FoodDetailWire>
 *     - overallRiskStatus / ingredients[].riskStatus: SAFE|CAUTION|DANGER|UNKNOWN
 *     - ⚠️ field is `riskStatus` here (scan uses `riskLevel`)
 */
import type { BeRiskLevel } from './scanTypes';

/** Same 4-state enum as scan (BeRiskLevel), different field name on the wire. */
export type BeRiskStatus = BeRiskLevel;

export interface IngredientWire {
  name: string; // ingredient name, request language
  iconRef: string | null; // nullable, currently not provided
  inclusionPercent: number; // 1..100
  riskStatus: BeRiskStatus;
}

/** P-107(KB-275, BE #121): 평점 단위 — 계약상 리뷰 없으면 0.0·0 (null 없음). */
export interface ReviewRatingWire {
  averageRating?: number | null;
  reviewCount?: number;
}

/** 음식 상세 리뷰 요약 묶음 — 8/3 스냅샷 정본 {blur, overall, sameCountry}.
 *  발주문의 단층 형태({averageRating, reviewCount, sameCountryAverageRating})도
 *  겸수신(필드 비충돌 — overall 존재 여부로 판별). */
export interface ReviewSummaryWire extends ReviewRatingWire {
  /** 비회원 가림 — true면 수치는 기본값(0.0·0). */
  blur?: boolean;
  overall?: ReviewRatingWire;
  sameCountry?: ReviewRatingWire;
  sameCountryAverageRating?: number | null;
}

export interface FoodDetailWire {
  name: string; // request-language name (falls back to Korean)
  /** Korean name regardless of lang. null when the localized name IS Korean (lang=ko / fallback). */
  koreanName: string | null;
  imageRef: string | null; // nullable, bare image filename
  description: string; // request language
  spiciness: number; // 0..10
  /** 조회 회원의 북마크 여부 — 비회원 조회는 항상 false (KB-142 계약 갭 해소, 2026-07-15 배포). */
  bookmarked: boolean;
  overallRiskStatus: BeRiskStatus; // whole-dish verdict
  ingredients: IngredientWire[]; // inclusion% descending
  /** P-085(KB-73): 리뷰 평점 집계 — 구 평면 계약(prod 호환 폴백). */
  averageRating?: number | null;
  reviewCount?: number;
  /** 같은 국적 평균 — 비회원·국적 미보유 null. */
  sameCountryAverageRating?: number | null;
  /** P-107(KB-275, #121 breaking): 신계약 중첩 리뷰 요약 — 있으면 이쪽 우선. */
  review?: ReviewSummaryWire | null;
}
