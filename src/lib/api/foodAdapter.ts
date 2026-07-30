/**
 * foodAdapter.ts — boundary translation BE wire → internal contract for the
 * foods endpoints (KB-70 detail · KB-71 list), mirroring scanAdapter. Screens
 * are built around the richer internal contract; this fills the gaps the thin
 * BE contract doesn't carry:
 *
 *   - foodId        ← the numeric id we queried with (path param, kept as string
 *                     internally — route params and mock ids are strings)
 *   - nameKo        ← wire.koreanName, falling back to wire.name (the BE sends
 *                     koreanName=null when the localized name IS Korean)
 *   - riskBasis     ← [] (no per-ingredient reason in the detail contract)
 *   - overall/sameNationality ← null aggregates (reviews API not deployed, KB-73)
 *   - photoUrl      ← imageRef when it's an absolute URL (BE now serves
 *                     CloudFront URLs on list + detail); bare filenames (schema
 *                     example "doenjang.png") still drop to null
 *
 * Risk enums reuse scanAdapter.mapRisk → UNKNOWN/unrecognized ⇒ 'unable',
 * NEVER 'safe' (Constitution III, false-safe = 0).
 */
import type { FoodCard, FoodDetail, IngredientRisk, RatingAggregate } from './types';
import { wireToFoodSpice } from './spiceAdapter';
import type { FoodDetailWire } from './foodDetailTypes';
import type { MenuSummaryWire } from './foodListTypes';
import { mapRisk } from './scanAdapter';

const NO_RATING: RatingAggregate = { average: null, count: 0 };

/** imageRef → usable URL, else null (bare filenames have no host yet). */
function refToUrl(ref: string | null | undefined): string | null {
  return ref && /^https?:\/\//.test(ref) ? ref : null;
}

export function adaptFoodDetail(wire: FoodDetailWire, foodId: string): FoodDetail {
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
    foodId,
    name: wire.name,
    nameKo: wire.koreanName ?? wire.name,
    risk: mapRisk(wire.overallRiskStatus),
    riskBasis: [],
    // P-085(KB-73): 평점 = 서버값 (목 재계산 폐기). sameCountry는 count 미제공 — 0 고정.
    overall: { average: wire.averageRating ?? null, count: wire.reviewCount ?? 0 },
    sameNationality: { average: wire.sameCountryAverageRating ?? null, count: 0 },
    description: wire.description ?? '',
    // P-081: 와이어 정수 → 단계 enum (변환은 spiceAdapter 격리 — 스웨거 enum 재배포 시 스왑)
    spiceLevel: wireToFoodSpice(wire.spiciness),
    photoUrl: refToUrl(wire.imageRef),
    ingredients,
    isRegistered,
    bookmarked: wire.bookmarked === true, // 계약: 비회원 항상 false (KB-142)
  };
}

/**
 * Unregistered / not-in-catalog dish → the "Unable to assess" screen (FR-033).
 * Reached two ways: the BE 400s on an unknown foodId, or a scan→detail nav
 * passes a raw Korean menu name (no foodId in the scan contract yet — KB-71
 * blocker, BE 질의 중). `label` is whatever we can show: the scanned Korean
 * name, or the queried id as a last resort.
 */
export function unregisteredFoodDetail(label: string): FoodDetail {
  return {
    foodId: label,
    name: label,
    nameKo: label,
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

/** List summary → the FoodCard the browse grid renders (KB-71). */
export function adaptMenuSummary(wire: MenuSummaryWire): FoodCard {
  return {
    foodId: String(wire.foodId),
    name: wire.name,
    nameKo: wire.koreanName ?? wire.name,
    photoUrl: refToUrl(wire.imageRef),
    risk: mapRisk(wire.overallRiskStatus),
    overall: NO_RATING, // review aggregates land with KB-73
  };
}
