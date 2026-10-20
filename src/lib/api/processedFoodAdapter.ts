/**
 * processedFoodAdapter (KB-812) — 가공식품 와이어(dev Swagger 3.2 ProcessedFoodSummary·Detail) → 앱 모델. 와이어 변환은 여기만
 * (AGENTS.md 어댑터 격리 — 데이터 훅 useProcessedFoods는 조회·캐시만).
 * - 이미지 URL은 https로 올린다: HACCP 이미지가 `http://`로 오는데 iOS ATS·Android cleartext 기본 차단이라 릴리스 빌드에서
 *   전부 안 뜬다(같은 경로 https = 200 실측). 네이티브 설정 변경 없이 여기서 승격.
 * - 판정은 검출(detections)·회원 대조(avoidance: DETECTED|UNCONFIRMED)뿐 — "없음·안전"은 서버도 앱도 만들지 않는다.
 *   검출되지 않은 재료 = 미확인. 비회원 avoidance = null 그대로(빈 배열로 바꾸지 않는다 — "대조했는데 0"과 구별).
 * - unmapped(미매핑 원문 토큰)는 3.2에 아직 없다 — 서버 후속이 오면 그대로 쓰고, 없으면 빈 배열(노란 행 렌더 0).
 */

export type LabelSource = 'DECLARED' | 'INGREDIENTS_ONLY' | 'NONE';
/** 시안 유형 플레이스홀더 4종(Ramen = soup 아이콘, 나머지 = camera 아이콘 + 유형 글자). 매핑 안 되면 null(카메라 + 원문 유형). */
export type PackagedType = 'snacks' | 'ramen' | 'bread' | 'drinks';

export type ProcessedFoodSummary = {
  id: string;
  name: string;
  maker: string | null;
  foodType: string | null;
  type: PackagedType | null;
  imageUrl: string | null;
};

export type ProcessedDetection = { code: string; evidence: string; fromLabel: boolean };
export type ProcessedAvoidance = { code: string; detected: boolean; evidence: string[] };

export type ProcessedFoodDetail = ProcessedFoodSummary & {
  capacity: string | null;
  rawMaterials: string | null;
  /** 알레르기 표시란 원문 — DECLARED일 때만 의미가 있다('알수없음' 등은 null로) */
  allergens: string | null;
  labelSource: LabelSource;
  detections: ProcessedDetection[];
  /** 회원 대조 — 비회원 null */
  avoidance: ProcessedAvoidance[] | null;
  unmapped: string[];
  sourceAttributionKey: string;
  image: { url: string; attributionKey: string } | null;
};

type SummaryWire = { id: number; productName: string; maker?: string | null; foodType?: string | null; imageUrl?: string | null };
export type SearchPageWire = { items: SummaryWire[]; hasNext: boolean; nextCursor?: string | null };
export type DetailWire = SummaryWire & {
  capacity?: string | null;
  rawMaterials?: string | null;
  allergens?: string | null;
  labelSource: string;
  detections: { code: string; source: string; evidence: string }[];
  avoidance?: { code: string; match: string; matchedCodes?: string[]; evidence?: string[] }[] | null;
  unmapped?: string[] | null;
  source: { provider: string; attributionKey: string };
  image?: { url: string; source: string; attributionKey: string } | null;
};

const blankToNull = (s: string | null | undefined): string | null => (s && s.trim() ? s.trim() : null);
export const toHttps = (u: string | null | undefined): string | null => {
  const v = blankToNull(u);
  return v ? v.replace(/^http:\/\//i, 'https://') : null;
};

/** 식품 유형 원문(한국어) → 시안 4종. 순서 중요: '면류'를 과자보다 먼저, '유음료'는 음료로. */
export function packagedTypeOf(foodType: string | null | undefined): PackagedType | null {
  const f = foodType ?? '';
  if (/라면|면류|국수|냉면|당면/.test(f)) return 'ramen';
  if (/빵|떡|케이크/.test(f)) return 'bread';
  if (/음료|우유|유음료|두유|커피|주스|차$|발효유|탄산|생수/.test(f)) return 'drinks';
  if (/과자|스낵|캔디|사탕|초콜릿|쿠키|비스킷|젤리|껌|빙과|아이스크림/.test(f)) return 'snacks';
  return null;
}

const LABEL_SOURCES: LabelSource[] = ['DECLARED', 'INGREDIENTS_ONLY', 'NONE'];
/** 모르는 값 = NONE(가장 보수적 — "성분 정보 없음, 직접 확인") */
const labelSourceOf = (v: string): LabelSource => ((LABEL_SOURCES as string[]).includes(v) ? (v as LabelSource) : 'NONE');

export function adaptProcessedSummary(w: SummaryWire): ProcessedFoodSummary {
  const foodType = blankToNull(w.foodType);
  return { id: String(w.id), name: w.productName, maker: blankToNull(w.maker), foodType, type: packagedTypeOf(foodType), imageUrl: toHttps(w.imageUrl) };
}

export function adaptProcessedDetail(w: DetailWire): ProcessedFoodDetail {
  const labelSource = labelSourceOf(w.labelSource);
  return {
    ...adaptProcessedSummary(w),
    imageUrl: toHttps(w.image?.url ?? w.imageUrl),
    capacity: blankToNull(w.capacity),
    rawMaterials: blankToNull(w.rawMaterials),
    allergens: labelSource === 'DECLARED' ? blankToNull(w.allergens) : null,
    labelSource,
    detections: (w.detections ?? []).map((d) => ({ code: d.code, evidence: d.evidence, fromLabel: d.source === 'ALLERGEN_DECLARATION' })),
    avoidance: w.avoidance == null ? null : w.avoidance.map((a) => ({ code: a.code, detected: a.match === 'DETECTED', evidence: a.evidence ?? [] })),
    unmapped: (w.unmapped ?? []).map((u) => u.trim()).filter(Boolean),
    sourceAttributionKey: w.source.attributionKey,
    image: w.image?.url ? { url: toHttps(w.image.url) as string, attributionKey: w.image.attributionKey } : null,
  };
}

// ── KB-813 이름 스캔(S4 계약 processed-food-s4-name-scan-contract.md) ──
export type ScanCandidate = ProcessedFoodSummary & { reportNo: string };
export type ScanNameResult = { analysisId: string; candidates: ScanCandidate[]; expiresAt: string | null };
/** 확정 결과 — charged = 이번 호출에서 서버가 1회 차감했는지(표시는 이 값만 — 로컬 추정 금지) */
export type ScanConfirmResult = { analysisId: string; rejected: boolean; charged: boolean; product: ProcessedFoodDetail | null };

type CandidateWire = SummaryWire & { reportNo: string };
export type ScanNameWire = { analysisId: string; state: string; candidates?: CandidateWire[] | null; expiresAt?: string | null };
export type ScanConfirmWire = { analysisId: string; state: string; charged?: boolean | null; product?: DetailWire | null };

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
  return { analysisId: w.analysisId, rejected, charged: w.charged === true, product: !rejected && w.product ? adaptProcessedDetail(w.product) : null };
}
