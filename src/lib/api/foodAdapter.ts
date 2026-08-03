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
import type { FoodDetailWire, ReviewRatingWire } from './foodDetailTypes';
import type { MenuSummaryWire } from './foodListTypes';
import { mapRisk } from './scanAdapter';

const NO_RATING: RatingAggregate = { average: null, count: 0 };

/** imageRef → usable URL, else null (bare filenames have no host yet). */
function refToUrl(ref: string | null | undefined): string | null {
  return ref && /^https?:\/\//.test(ref) ? ref : null;
}

/** 중첩 평점 단위 → 내부 집계. 계약 "리뷰 없으면 0.0·0(null 없음)" → count 0이면
 *  average null(화면 '—'). blur=true의 기본값(0.0·0)도 같은 경로로 자연 강등. */
function aggFromRating(r: ReviewRatingWire | undefined): RatingAggregate {
  const count = r?.reviewCount ?? 0;
  return { average: count > 0 && typeof r?.averageRating === 'number' ? r.averageRating : null, count };
}

/** P-107(KB-275, #121): 리뷰 요약 겸수신 — ① 신계약 중첩(스냅샷 8/3 정본
 *  {overall, sameCountry}) ② 발주문 단층 중첩 ③ 구 평면(prod 폴백) 순. */
function adaptReviewSummary(wire: FoodDetailWire): Pick<FoodDetail, 'overall' | 'sameNationality'> {
  const rv = wire.review;
  if (rv) {
    if (rv.overall || rv.sameCountry) {
      return { overall: aggFromRating(rv.overall), sameNationality: aggFromRating(rv.sameCountry) };
    }
    return {
      overall: { average: rv.averageRating ?? null, count: rv.reviewCount ?? 0 },
      sameNationality: { average: rv.sameCountryAverageRating ?? null, count: 0 },
    };
  }
  return {
    overall: { average: wire.averageRating ?? null, count: wire.reviewCount ?? 0 },
    sameNationality: { average: wire.sameCountryAverageRating ?? null, count: 0 },
  };
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
    // P-085(KB-73)→P-107(KB-275): 평점 = 서버값, 중첩 신계약 우선 + 구 평면 폴백.
    ...adaptReviewSummary(wire),
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
