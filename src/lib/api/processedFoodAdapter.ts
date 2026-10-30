/**
 * processedFoodAdapter (KB-812) — 가공식품 와이어(dev Swagger 3.2 ProcessedFoodSummary·Detail) → 앱 모델. 와이어 변환은 여기만
 * (AGENTS.md 어댑터 격리 — 데이터 훅 useProcessedFoods는 조회·캐시만).
 * - 이미지 URL은 https로 올린다: HACCP 이미지가 `http://`로 오는데 iOS ATS·Android cleartext 기본 차단이라 릴리스 빌드에서
 *   전부 안 뜬다(같은 경로 https = 200 실측). 네이티브 설정 변경 없이 여기서 승격.
 * - KB-865 v4(서버 #457): 판정 = 서버 `verdict` + avoidMatches·mayContainMatches·unclearIngredients(회원) / majorAllergens·mayContain
 *   (비회원·회피 0개). 앱은 판정을 만들지 않는다 — 모르는 verdict = null. detections·avoidance는 보조(구서버·성분표 화면).
 * - unmapped는 서버가 폐기(항상 빈 배열) — 받지 않는다(Needs checking 경로 삭제).
 */

export type LabelSource = 'DECLARED' | 'INGREDIENTS_ONLY' | 'NONE';
/** KB-867(서버 #458) 유형 8종 — 목록 칩·요청 파라미터·플레이스홀더(RAMEN = 그릇, 나머지 = 카메라 + 유형 글자). 매핑 안 되면 null(카메라 + 원문 유형). */
export const PACKAGED_TYPES = ['SNACKS', 'RAMEN', 'DRINKS', 'BREAD', 'ICE_CREAM', 'DAIRY', 'MEALS', 'SAUCES'] as const; // 칩 순서 = 시안 01(All 다음) + 나머지 4
export type PackagedType = (typeof PACKAGED_TYPES)[number];
export const packagedTypeKey = (t: PackagedType) => `packaged.type.${t.toLowerCase()}`;

/** KB-865 v4 판정(서버가 내림 — 앱은 그대로 그린다). 비회원·회피 0개·구서버 = null(배지 없음). */
export type ProcessedVerdict = 'AVOID' | 'CAUTION' | 'SAFE' | 'SAFE_WITH_NOTE';

export type ProcessedFoodSummary = {
  id: string;
  name: string;
  maker: string | null;
  foodType: string | null;
  type: PackagedType | null;
  imageUrl: string | null;
  /** v4 한국어 원명 — 구서버·표시명과 같으면 null(중복 줄 숨김) */
  nameKo: string | null;
  /** v4 평점 — 구서버·리뷰 0 = null(줄 숨김) */
  rating: { average: number; count: number } | null;
  verdict: ProcessedVerdict | null;
  /** 비회원·회피 0개 후보 줄 "Contains …"(시안 45) — 목록·후보 응답에 없으면 null(줄 숨김) */
  majorAllergens: string[] | null;
  /** 품목보고번호 — 스캔 "이름으로 찾기"에서 고른 제품을 확정할 때(후보 밖 선택 — 진입 플로우 ②). 없으면 null(그 항목은 확정 불가) */
  reportNo: string | null;
};

export type ProcessedDetection = { code: string; evidence: string; fromLabel: boolean };
export type ProcessedAvoidance = { code: string; detected: boolean; evidence: string[] };
/** v4 판정 근거 — 회피 코드 + 근거 원문(원재료·알레르기 표시 / 혼입 문장) */
export type ProcessedMatch = { code: string; evidence: string[] };
/** 비회원·회피 0개용 혼입 가능 판독 전체(회원 여부 무관, #457 mayContain) */
export type ProcessedMayContain = { code: string; evidence: string };
export type ProcessedAxis = { average: number | null; count: number };
/** KB-869(#461): overall = 별점 평균 = taste. 축 없음 = null(숨김) */
export type ProcessedReviewSummary = { overall: ProcessedAxis; taste: ProcessedAxis | null; spiciness: ProcessedAxis | null; sweetness: ProcessedAxis | null };

export type ProcessedFoodDetail = ProcessedFoodSummary & {
  capacity: string | null;
  rawMaterials: string | null;
  /** 알레르기 표시란 원문 — DECLARED일 때만 의미가 있다('알수없음' 등은 null로) */
  allergens: string | null;
  labelSource: LabelSource;
  detections: ProcessedDetection[];
  /** 회원 대조 — 비회원 null */
  avoidance: ProcessedAvoidance[] | null;
  avoidMatches: ProcessedMatch[];
  mayContainMatches: ProcessedMatch[];
  mayContain: ProcessedMayContain[];
  /** 내용 불명 원재료(서버 사전) — 한국어 원문 */
  unclearIngredients: string[];
  /** 비회원·회피 0개: 한국 표시 의무 주요 알레르기 중 포함된 코드. **필드 없음(구서버·부분 배포) = null = 모름** — 빈 배열(서버가 확인한 0)과 구별(Codex #338 P1) */
  majorAllergens: string[] | null;
  /** 원재료 — 번역(#462, 요청 언어) 없으면 null(원문만). 원문 = rawMaterials */
  ingredients: { translated: string | null; original: string | null };
  /** 알레르기 표시란 — 번역 + 원문(DECLARED일 때만) */
  allergenStatement: { translated: string | null; original: string } | null;
  /** 출처 — HACCP | C002(#455) | 그 밖(문구 = HACCP 기본) */
  sourceProvider: string;
  sourceAttributionKey: string;
  image: { url: string; attributionKey: string } | null;
  /** 리뷰 요약 — 구서버(필드 없음) = null → 화면은 숨김 */
  reviewSummary: ProcessedReviewSummary | null;
};

type SummaryWire = {
  id: number;
  productName: string;
  maker?: string | null;
  foodType?: string | null;
  imageUrl?: string | null;
  // KB-865 v4 계약 초안(2026-10-22-packaged-v4-contract-draft §2) — 전부 optional, 없으면 숨김
  nameKo?: string | null;
  rating?: { average?: number | null; count?: number | null } | null;
  verdict?: string | null;
  type?: string | null;
  /** KB-867(#458): 요청 언어 표시명 — 번역 전엔 원문. 없으면 productName */
  name?: string | null;
  majorAllergens?: string[] | null;
  reportNo?: string | number | null;
};
export type SearchPageWire = { items: SummaryWire[]; hasNext: boolean; nextCursor?: string | null };
export type DetailWire = SummaryWire & {
  capacity?: string | null;
  rawMaterials?: string | null;
  allergens?: string | null;
  labelSource: string;
  detections: { code: string; source: string; evidence: string }[];
  avoidance?: { code: string; match: string; matchedCodes?: string[]; evidence?: string[] }[] | null;
  source: { provider: string; attributionKey: string };
  image?: { url: string; source: string; attributionKey: string } | null;
  // 구 3.2 = {count, avgRating} · KB-869(#461) = {overall, taste, spiciness, sweetness} 각 {average, count}
  reviewSummary?: { count?: number | null; avgRating?: number | null; overall?: AxisWire; taste?: AxisWire; spiciness?: AxisWire; sweetness?: AxisWire } | null;
  // KB-865 v4(#457·#462) — 전부 optional
  avoidMatches?: MatchWire[] | null;
  mayContainMatches?: MatchWire[] | null;
  mayContain?: { code: string; source?: string; evidence: string }[] | null;
  unclearIngredients?: string[] | null;
  majorAllergens?: string[] | null;
  ingredients?: { translated?: string | null; original?: string | null } | null;
  allergenStatement?: { translated?: string | null; original?: string | null } | null;
};
type AxisWire = { average?: number | null; count?: number | null } | null;
type MatchWire = { code: string; evidence?: string[] | string | null };

const blankToNull = (s: string | null | undefined): string | null => (s && s.trim() ? s.trim() : null);
/** KB-901(T-003·T-012): 서버는 번역이 없을 때 translated에 원문을 그대로 채운다(dev 2453 실측 — 원재료) → "English translation" 아래 한국어,
 *  알레르기 문장 두 번. 원문과 같은 "번역" = 번역 없음(null) */
export const realTranslation = (translated: string | null | undefined, original: string | null): string | null => {
  const tr = blankToNull(translated);
  return tr && tr !== original ? tr : null;
};
/** KB-877: 서버 무료 창 끝 시각(ISO) — 해석 못 하는 값 = 창 없음(null). 창 계산은 서버만 한다 */
export const isoOrNull = (s: string | null | undefined): string | null => (s && Number.isFinite(Date.parse(s)) ? s : null);
export const toHttps = (u: string | null | undefined): string | null => {
  const v = blankToNull(u);
  return v ? v.replace(/^http:\/\//i, 'https://') : null;
};

/** 식품 유형 원문(한국어) → 유형(서버 `type`이 없을 때만 — 구서버 폴백). 순서 중요: '면류'를 과자보다 먼저, '유음료'는 음료로. */
export function packagedTypeOf(foodType: string | null | undefined): PackagedType | null {
  const f = foodType ?? '';
  if (/라면|면류|국수|냉면|당면/.test(f)) return 'RAMEN';
  if (/빵|떡|케이크/.test(f)) return 'BREAD';
  if (/음료|우유|유음료|두유|커피|주스|차$|발효유|탄산|생수/.test(f)) return 'DRINKS';
  if (/과자|스낵|캔디|사탕|초콜릿|쿠키|비스킷|젤리|껌|빙과|아이스크림/.test(f)) return 'SNACKS';
  return null;
}
/** 서버 유형(대문자 8종) 우선 — 모르는 값은 원문 매핑으로 */
const typeOf = (wire: string | null | undefined, foodType: string | null): PackagedType | null =>
  (PACKAGED_TYPES as readonly string[]).includes(wire ?? '') ? (wire as PackagedType) : packagedTypeOf(foodType);

const LABEL_SOURCES: LabelSource[] = ['DECLARED', 'INGREDIENTS_ONLY', 'NONE'];
/** 모르는 값 = NONE(가장 보수적 — "성분 정보 없음, 직접 확인") */
const labelSourceOf = (v: string): LabelSource => ((LABEL_SOURCES as string[]).includes(v) ? (v as LabelSource) : 'NONE');

const VERDICTS: ProcessedVerdict[] = ['AVOID', 'CAUTION', 'SAFE', 'SAFE_WITH_NOTE'];
/** 모르는 값 = null(배지 없음) — 앱이 SAFE를 만들지 않는다(server-truth, 헌법 III) */
const verdictOf = (v: string | null | undefined): ProcessedVerdict | null => ((VERDICTS as (string | null | undefined)[]).includes(v) ? (v as ProcessedVerdict) : null);
const ratingOf = (r: SummaryWire['rating']): ProcessedFoodSummary['rating'] =>
  r && typeof r.average === 'number' && typeof r.count === 'number' && r.count > 0 ? { average: r.average, count: r.count } : null;

export function adaptProcessedSummary(w: SummaryWire): ProcessedFoodSummary {
  const foodType = blankToNull(w.foodType);
  const nameKo = blankToNull(w.nameKo);
  const name = blankToNull(w.name) ?? w.productName;
  return {
    id: String(w.id),
    name,
    maker: blankToNull(w.maker),
    foodType,
    type: typeOf(w.type, foodType),
    imageUrl: toHttps(w.imageUrl),
    nameKo: nameKo === name.trim() ? null : nameKo,
    rating: ratingOf(w.rating),
    verdict: verdictOf(w.verdict),
    majorAllergens: w.majorAllergens == null ? null : w.majorAllergens,
    reportNo: w.reportNo == null || w.reportNo === '' ? null : String(w.reportNo),
  };
}

/** 판정 → RiskBadge 상태. 내용 불명 메모가 붙은 Safe도 배지는 safe(결정 4) */
// KB-921(R-147): SAFE_WITH_NOTE = 속을 알 수 없는 원재료(혼합제제·양념 등)가 있음 → 주의 — "모름"을 초록으로 그리지 않는다(false-safe 0). 띠·목록 리본·후보 줄이 전부 이 표를 거친다
export const VERDICT_RISK = { AVOID: 'danger', CAUTION: 'caution', SAFE: 'safe', SAFE_WITH_NOTE: 'caution' } as const;

// 판정 원소 변환 — 상세(GET /processed-foods/{id})와 성분표 분석(scan/label)이 같은 모양이라 한 벌로
const adaptDetections = (ds: DetailWire['detections'] | null | undefined): ProcessedDetection[] =>
  (ds ?? []).map((d) => ({ code: d.code, evidence: d.evidence, fromLabel: d.source === 'ALLERGEN_DECLARATION' }));
const adaptAvoidance = (as: NonNullable<DetailWire['avoidance']>): ProcessedAvoidance[] =>
  as.map((a) => ({ code: a.code, detected: a.match === 'DETECTED', evidence: a.evidence ?? [] }));
const adaptMatches = (ms: MatchWire[] | null | undefined): ProcessedMatch[] =>
  (ms ?? []).map((m) => ({ code: m.code, evidence: (Array.isArray(m.evidence) ? m.evidence : m.evidence ? [m.evidence] : []).map((e) => e.trim()).filter(Boolean) }));
const axisOf = (a: AxisWire | undefined): ProcessedAxis | null =>
  a && typeof a.count === 'number' && a.count > 0 ? { average: typeof a.average === 'number' ? a.average : null, count: a.count } : null;
/** 구 3.2({count, avgRating}) = overall·taste 하나(별점 평균 = taste) · 새 축 없음 */
function reviewSummaryOf(w: DetailWire['reviewSummary']): ProcessedReviewSummary | null {
  if (!w) return null;
  if (w.overall !== undefined) {
    const overall = { average: w.overall?.average ?? null, count: w.overall?.count ?? 0 };
    return { overall, taste: axisOf(w.taste) ?? axisOf(w.overall), spiciness: axisOf(w.spiciness), sweetness: axisOf(w.sweetness) };
  }
  const overall = { average: w.avgRating ?? null, count: w.count ?? 0 };
  return { overall, taste: overall.count > 0 ? overall : null, spiciness: null, sweetness: null };
}

const ingredientsOf = (w: { translated?: string | null; original?: string | null } | null | undefined, fallback: string | null) => {
  const original = blankToNull(w?.original) ?? fallback;
  return { translated: realTranslation(w?.translated, original), original };
};

export function adaptProcessedDetail(w: DetailWire): ProcessedFoodDetail {
  const labelSource = labelSourceOf(w.labelSource);
  const allergens = labelSource === 'DECLARED' ? blankToNull(w.allergenStatement?.original) ?? blankToNull(w.allergens) : null;
  return {
    ...adaptProcessedSummary(w),
    imageUrl: toHttps(w.image?.url ?? w.imageUrl),
    capacity: blankToNull(w.capacity),
    rawMaterials: blankToNull(w.rawMaterials),
    allergens,
    labelSource,
    detections: adaptDetections(w.detections),
    avoidance: w.avoidance == null ? null : adaptAvoidance(w.avoidance),
    avoidMatches: adaptMatches(w.avoidMatches),
    mayContainMatches: adaptMatches(w.mayContainMatches),
    mayContain: (w.mayContain ?? []).map((m) => ({ code: m.code, evidence: m.evidence })),
    unclearIngredients: (w.unclearIngredients ?? []).map((u) => u.trim()).filter(Boolean),
    majorAllergens: w.majorAllergens == null ? null : w.majorAllergens,
    // #462 전 = 원문만(번역 null). 원문은 서버 ingredients.original → 없으면 rawMaterials
    ingredients: ingredientsOf(w.ingredients, blankToNull(w.rawMaterials)),
    allergenStatement: allergens ? { translated: realTranslation(w.allergenStatement?.translated, allergens), original: allergens } : null,
    sourceProvider: w.source.provider,
    sourceAttributionKey: w.source.attributionKey,
    image: w.image?.url ? { url: toHttps(w.image.url) as string, attributionKey: w.image.attributionKey } : null,
    reviewSummary: reviewSummaryOf(w.reviewSummary),
  };
}

// ── KB-813 이름 스캔(S4 계약 processed-food-s4-name-scan-contract.md) ──
export type ScanCandidate = ProcessedFoodSummary & { reportNo: string };
export type ScanNameResult = { analysisId: string; candidates: ScanCandidate[]; expiresAt: string | null };
/** 확정 결과 — charged = 이번 호출에서 서버가 1회 차감했는지(표시는 이 값만 — 로컬 추정 금지) */
/** freeUntil(KB-877) = 가공식품 1시간 무료 창 끝(서버 정본) — null = 창 없음 */
export type ScanConfirmResult = { analysisId: string; rejected: boolean; charged: boolean; product: ProcessedFoodDetail | null; freeUntil: string | null };

type CandidateWire = SummaryWire & { reportNo: string };
export type ScanNameWire = { analysisId: string; state: string; candidates?: CandidateWire[] | null; expiresAt?: string | null };
export type ScanConfirmWire = { analysisId: string; state: string; charged?: boolean | null; product?: DetailWire | null; freeUntil?: string | null };

/** NO_CANDIDATE면 후보 0 — 서버 state가 정본(후보가 와도 state가 NO_CANDIDATE면 쓰지 않는다). 최대 5. */
export function adaptScanName(w: ScanNameWire): ScanNameResult {
  const list = w.state === 'CANDIDATES' ? (w.candidates ?? []) : [];
  return {
    analysisId: w.analysisId,
    candidates: list.slice(0, 5).map((c) => ({ ...adaptProcessedSummary(c), reportNo: String(c.reportNo) })),
    expiresAt: w.expiresAt ?? null,
  };
}
/** charged는 true일 때만 true(없음·null = 차감 없음으로 보지 않고 "표시 안 함" — 호출측은 true만 차감 표시) */
export function adaptScanConfirm(w: ScanConfirmWire): ScanConfirmResult {
  const rejected = w.state === 'REJECTED' || !w.product;
  return { analysisId: w.analysisId, rejected, charged: w.charged === true, product: !rejected && w.product ? adaptProcessedDetail(w.product) : null, freeUntil: isoOrNull(w.freeUntil) };
}

// ── KB-813 후속(P-508): 성분표 분석 S5 — POST /api/processed-foods/scan/label (서버 #442) ──
/** 성분표 판독 결과. 제품이 정해지지 않았으니 상세 연결 없음. avoidance = 회원 대조(엔드포인트가 회원 전용이라 늘 배열). */
export type LabelScanResult = {
  analysisId: string;
  /** KB-865 v4(#457) — 상세와 같은 판정 필드(구서버 = null/빈 배열 → 구 판정 부품으로) */
  verdict: ProcessedVerdict | null;
  avoidMatches: ProcessedMatch[];
  mayContainMatches: ProcessedMatch[];
  unclearIngredients: string[];
  majorAllergens: string[] | null;
  ingredients: { translated: string | null; original: string | null };
  allergenStatement: { translated: string | null; original: string } | null;
  labelSource: LabelSource;
  detections: ProcessedDetection[];
  mayContain: ProcessedMayContain[];
  avoidance: ProcessedAvoidance[];
  rawText: string;
  /** 이번 호출에서 서버가 1회 차감했는지 — true일 때만 차감 표시(로컬 추정 0) */
  charged: boolean;
  /** KB-877: 가공식품 1시간 무료 창 끝(서버 정본) — null = 창 없음 */
  freeUntil: string | null;
};
export type LabelScanWire = {
  analysisId: string;
  state: string;
  labelSource: string;
  detections?: DetailWire['detections'] | null;
  mayContain?: { code: string; source?: string; evidence: string }[] | null;
  avoidance?: DetailWire['avoidance'];
  rawText?: string | null;
  charged?: boolean | null;
  verdict?: string | null;
  avoidMatches?: MatchWire[] | null;
  mayContainMatches?: MatchWire[] | null;
  unclearIngredients?: string[] | null;
  majorAllergens?: string[] | null;
  ingredients?: { translated?: string | null; original?: string | null } | null;
  allergenStatement?: { translated?: string | null; original?: string | null } | null;
  freeUntil?: string | null;
};
export function adaptLabelScan(w: LabelScanWire): LabelScanResult {
  const rawText = blankToNull(w.rawText);
  const allergenOriginal = blankToNull(w.allergenStatement?.original);
  return {
    analysisId: w.analysisId,
    verdict: verdictOf(w.verdict),
    avoidMatches: adaptMatches(w.avoidMatches),
    mayContainMatches: adaptMatches(w.mayContainMatches),
    unclearIngredients: (w.unclearIngredients ?? []).map((u) => u.trim()).filter(Boolean),
    majorAllergens: w.majorAllergens == null ? null : w.majorAllergens,
    // 원문 = 서버 ingredients.original → 없으면 읽은 원문(rawText)
    ingredients: ingredientsOf(w.ingredients, rawText),
    allergenStatement: allergenOriginal ? { translated: realTranslation(w.allergenStatement?.translated, allergenOriginal), original: allergenOriginal } : null,
    labelSource: labelSourceOf(w.labelSource),
    detections: adaptDetections(w.detections),
    mayContain: (w.mayContain ?? []).map((m) => ({ code: m.code, evidence: m.evidence })),
    avoidance: adaptAvoidance(w.avoidance ?? []),
    rawText: blankToNull(w.rawText) ?? '',
    charged: w.charged === true,
    freeUntil: isoOrNull(w.freeUntil),
  };
}
