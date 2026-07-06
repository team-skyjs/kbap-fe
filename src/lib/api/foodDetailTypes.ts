/**
 * foodDetailTypes.ts — WIRE types for GET /api/v1/foods/detail (KB-70).
 * Mirror the redeployed Swagger EXACTLY (FoodDetailResponse / IngredientResponse).
 * Kept separate from our internal contract types; foodAdapter.ts translates
 * BE → internal so the detail screen never sees BE enums/field names.
 *
 *   GET /api/v1/foods/detail?menuName=<ko>&lang=<bcp47>
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
  imageRef: string | null; // nullable, bare image filename
  description: string; // request language
  spiciness: number; // 0..10
  overallRiskStatus: BeRiskStatus; // whole-dish verdict
  ingredients: IngredientWire[]; // inclusion% descending
}
