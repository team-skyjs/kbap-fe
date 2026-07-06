/**
 * foodAdapter.ts — boundary translation BE FoodDetailWire → internal FoodDetail
 * (KB-70), mirroring scanAdapter. The detail screen is built around the richer
 * internal contract; this fills the gaps the thin BE contract doesn't carry:
 *
 *   - nameKo/foodId ← the Korean menuName we queried with (the BE keys by it)
 *   - riskBasis     ← [] (no per-ingredient reason in the detail contract)
 *   - overall/sameNationality ← null aggregates (reviews API not deployed, KB-73)
 *   - isRegistered  ← derived: UNKNOWN overall + no ingredients ⇒ unregistered
 *   - photoUrl      ← null (imageRef is a bare filename; no image host defined —
 *                     BE 논의 필요)
 *
 * Risk enums reuse scanAdapter.mapRisk → UNKNOWN/unrecognized ⇒ 'unable',
 * NEVER 'safe' (Constitution III, false-safe = 0).
 */
import type { FoodDetail, IngredientRisk, RatingAggregate } from './types';
import type { FoodDetailWire } from './foodDetailTypes';
import { mapRisk } from './scanAdapter';

const NO_RATING: RatingAggregate = { average: null, count: 0 };

export function adaptFoodDetail(wire: FoodDetailWire, menuNameKo: string): FoodDetail {
  const ingredients: IngredientRisk[] = (wire.ingredients ?? []).map((ing, i) => ({
    // stable key for React + the "ask the owner" route param (name is user-facing,
    // index keeps it unique when the BE repeats a name).
    code: `ing:${i}:${ing.name}`,
    name: ing.name,
    percentage: typeof ing.inclusionPercent === 'number' ? ing.inclusionPercent : null,
    risk: mapRisk(ing.riskStatus),
    note: null,
  }));

  // Unregistered ⇒ the "Unable to assess" screen (FR-033). A dish the BE can't
  // judge comes back UNKNOWN with no ingredient breakdown.
  const isRegistered = wire.overallRiskStatus !== 'UNKNOWN' || ingredients.length > 0;

  return {
    foodId: menuNameKo,
    name: wire.name,
    nameKo: menuNameKo,
    risk: mapRisk(wire.overallRiskStatus),
    riskBasis: [],
    overall: NO_RATING,
    sameNationality: NO_RATING,
    description: wire.description ?? '',
    spiceLevel: typeof wire.spiciness === 'number' ? wire.spiciness : null,
    photoUrl: null,
    ingredients,
    isRegistered,
  };
}

/**
 * Unregistered / not-in-catalog dish → the "Unable to assess" screen (FR-033).
 * The BE currently signals this as HTTP 400 "해당 음식 정보 없음" rather than an
 * in-band UNKNOWN, so the hook synthesizes this from the queried Korean name.
 */
export function unregisteredFoodDetail(menuNameKo: string): FoodDetail {
  return {
    foodId: menuNameKo,
    name: menuNameKo,
    nameKo: menuNameKo,
    risk: 'unable',
    riskBasis: [],
    overall: NO_RATING,
    sameNationality: NO_RATING,
    description: '',
    spiceLevel: null,
    photoUrl: null,
    ingredients: [],
    isRegistered: false,
  };
}
