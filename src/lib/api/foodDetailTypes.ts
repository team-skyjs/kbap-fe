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
}
