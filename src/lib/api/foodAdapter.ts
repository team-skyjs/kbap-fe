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
import { adaptReview } from './reviewAdapter';

const NO_RATING: RatingAggregate = { average: null, count: 0 };

/** imageRef → usable URL, else null (bare filenames have no host yet). */
function refToUrl(ref: string | null | undefined): string | null {
  return ref && /^https?:\/\//.test(ref) ? ref : null;
}

/** 중첩 평점 단위 → 내부 집계. 계약 "리뷰 없으면 0.0·0(null 없음)" → count 0이면
 *  average null(화면 '—'). */
function aggFromRating(r: ReviewRatingWire | undefined): RatingAggregate {
  const count = r?.reviewCount ?? 0;
  return { average: count > 0 && typeof r?.averageRating === 'number' ? r.averageRating : null, count };
}

/** P-107(KB-275, #121): 리뷰 요약 겸수신 — ① 신계약 중첩(스냅샷 8/3 정본
 *  {overall, sameCountry}) ② 발주문 단층 중첩 ③ 구 평면(prod 폴백) 순. */
function adaptReviewSummary(wire: FoodDetailWire): Pick<FoodDetail, 'overall' | 'sameNationality' | 'reviewSummaryMissing'> {
  // P-239 핫픽스: 신스키마 reviewSummary 1순위(8/19 낮 배포 — 버전 무관 단일 핸들러.
  // 구 review만 읽던 어댑터가 dev ★요약을 소실시키던 원인). 채널이 아니라 **필드
  // 존재 기준** 겸수신 — 신필드 있으면 신, 없으면 구(review·평면 = prod 폴백).
  const rv = wire.reviewSummary ?? wire.review;
  // P-235: blur 소멸(8/19 응답 실측). 🔴 review:null 방어 — 현재 서버가 비회원
  // 상세의 요약을 null로 준다(리뷰 있는 음식도 — 종한 확인 중 버그 후보, 합의
  // 규격은 overall 공개·sameCountry만 null). null = 브리프 섹션 미렌더
  // (reviewSummaryMissing — 빈 컨테이너 금지), 서버가 고치면 **코드 무변**으로
  // 표시된다(옵셔널 배선 — 필드 존재 가정 없음).
  if (rv) {
    if (rv.overall || rv.sameCountry) {
      return { overall: aggFromRating(rv.overall), sameNationality: aggFromRating(rv.sameCountry), reviewSummaryMissing: false };
    }
    return {
      overall: { average: rv.averageRating ?? null, count: rv.reviewCount ?? 0 },
      sameNationality: { average: rv.sameCountryAverageRating ?? null, count: 0 },
      reviewSummaryMissing: false,
    };
  }
  return {
    overall: { average: wire.averageRating ?? null, count: wire.reviewCount ?? 0 },
    sameNationality: { average: wire.sameCountryAverageRating ?? null, count: 0 },
    // 구응답 최상위 필드 폴백 — 그것도 없으면 요약 미상(missing)
    reviewSummaryMissing: wire.averageRating == null && wire.reviewCount == null,
  };
}

export function adaptFoodDetail(wire: FoodDetailWire, foodId: string): FoodDetail {
  // P-239: 신스키마 재료 마크 = avoidedIngredients(회원 겹침) 클라 조인.
  // 배열 = 회원 신스키마(미겹침 = 서버 의미상 SAFE — 구계약의 재료별 SAFE와 동일 정보량),
  // null/부재 = 비회원 신스키마(판정 자체 없음 → unable, 게스트 렌더는 마크 슬롯 미렌더)
  // 또는 구스키마(재료 내 riskStatus — prod 폴백 경로가 우선 처리).
  const avoidedMap = Array.isArray(wire.avoidedIngredients)
    ? new Map(wire.avoidedIngredients.map((a) => [a.code, a.riskStatus]))
    : null;
  const ingredients: IngredientRisk[] = (wire.ingredients ?? []).map((ing, i) => ({
    // 신스키마 = 실코드(81종 — 스캔 v1 폴백 조인·owner 파라미터 정확도↑),
    // 구스키마 = 합성 키 유지(stable key + owner 라우트 파라미터).
    code: ing.code ?? `ing:${i}:${ing.name}`,
    name: ing.name,
    percentage: typeof ing.inclusionPercent === 'number' ? ing.inclusionPercent : null,
    risk:
      ing.riskStatus != null
        ? mapRisk(ing.riskStatus) // 구스키마(prod) — 기존 경로 무변
        : avoidedMap
          ? mapRisk(avoidedMap.get(ing.code ?? '') ?? 'SAFE') // 회원 조인 — 겹침만 위험 마크
          : 'unable', // 비회원 — 판정 없음(마크 미렌더)
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
    // P-239: 신스키마 인라인 최신 5건 — 있으면 상세가 목록 호출 생략(요청 1개 절감).
    // 부재(prod 구스키마) = undefined → 화면이 기존 목록 호출 폴백.
    recentReviews: Array.isArray(wire.recentReviews) ? wire.recentReviews.map(adaptReview) : undefined,
    // P-251(BE #185): 리뷰 자격 서버 정본 — boolean만 통과(부재 = undefined = 게이트 없음,
    // prod 구응답·강제 미배포 호환). 클라 이력 추정 금지.
    reviewEligible: typeof wire.reviewEligible === 'boolean' ? wire.reviewEligible : undefined,
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
  // P-165(#146): 리뷰 요약 실값 — count 0이면 average null(화면 '— · 0'), 구응답(필드 부재)도 동일 강등
  const rvCount = wire.review?.count ?? 0;
  return {
    foodId: String(wire.foodId),
    name: wire.name,
    nameKo: wire.koreanName ?? wire.name,
    photoUrl: refToUrl(wire.imageRef),
    risk: mapRisk(wire.overallRiskStatus),
    overall:
      rvCount > 0 && typeof wire.review?.averageRating === 'number'
        ? { average: wire.review.averageRating, count: rvCount }
        : NO_RATING,
  };
}
