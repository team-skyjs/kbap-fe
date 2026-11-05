/**
 * scanAdapter.ts — the boundary translation BE → internal (KB-72, 신계약
 * 2026-07-10).
 *
 * - Maps BE riskLevel → internal RiskState. ANY unrecognized value falls back to
 *   'unable' — NEVER 'safe' (Constitution III, false-safe = 0).
 * - Joins BE results onto the client's scanned items by idx. Items the server
 *   did NOT return are non-food (원산지·가격·UI 문구) → they are DROPPED from
 *   the overlay entirely (server is the food-判定 authority now).
 * - matched=false ⇒ 조사 대기: risk is forced 'unable' regardless of the wire
 *   value (belt-and-braces), and the detail navigation must stay disabled even
 *   when foodId is present — branch on `matched`, never foodId (Swagger 명시).
 */
import type { RiskState } from '@/lib/theme';
import type { AvoidanceOverlapWire, BeRiskLevel, BoundingBox, PriceOptionWire, ScanPendingItemWire, ScanResultWire } from './scanTypes';

const RISK_MAP: Record<BeRiskLevel, RiskState> = {
  SAFE: 'safe',
  CAUTION: 'caution',
  DANGER: 'danger',
  UNKNOWN: 'unable',
};

/** Defensive map: unknown/missing enum → 'unable' (risk-down, never safe). */
export function mapRisk(level: string | null | undefined): RiskState {
  if (level && level in RISK_MAP) return RISK_MAP[level as BeRiskLevel];
  return 'unable';
}

/** A scanned item the client knows about (text + on-device box). */
export interface ScannedItem {
  itemId: number; // internal id; goes on the wire as `idx`
  rawMenuName: string;
  box: BoundingBox;
}

/** Item enriched with the BE verdict — what the overlay renders. */
export interface ScanOverlayItem extends ScannedItem {
  risk: RiskState;
  matched: boolean; // false = 조사 대기 → no detail navigation
  foodId: string | null; // route param when matched (numeric id stringified)
  displayName: string; // pill/list label: BE name, else rawMenuName fallback
  koreanName: string | null;
  /** 서버 판독 가격(KRW 정수, 제공값 그대로). 미표기/비정상 wire 값 = null = 미표시. */
  price: number | null;
  /** P-241 v2: 행 썸네일 URL(매칭 = 대표·비매칭 = 디폴트, 서버가 항상 채움).
   *  v1/비-URL 값 = null(상세 프리페치 photoUrl 폴백). */
  imageUrl: string | null;
  /** P-219 v2: 겹친 회피 성분(overlapped=true만). 빈 배열 = 미표시. */
  avoidances: AvoidanceHit[];
  /** KB-789 v3.0: 유사 음식으로 대체된 항목(foodId·이름·위험도 = 대체 음식). 2.0 = false. */
  substituted: boolean;
  /** KB-789 v3.0: 메뉴판에 적힌 원문 — substituted일 때 "Menu says …"·주문 카드 nameKo. 부재 = null. */
  originalScannedName: string | null;
  /** KB-992: AI 추정 대기 키(미매칭·비대체만). null = 대기 없음. */
  pendingId: string | null;
  /** KB-1006: 수량 옵션(2개 이상) · null = 없음 */
  priceOptions: PriceOption[] | null;
  /** KB-1006: 고추 수 0~5(0 = 표시 안 함) */
  spice: number;
}

/**
 * P-219 v2: 메뉴별 회피 성분 겹침 — 표시용. `overlapped=true`만 담는다
 * (전체 목록 나열 금지 — 81종이 올 수 있다). `name`은 서버가 요청 lang으로
 * 번역해 준 값 그대로(클라 재번역 금지).
 * ⚠️ false-safe: riskLevel 결측·미지 = **caution 강등**(safe로 올리지 않는다 —
 * 회피 성분 확률 결측 정책 미결, 헌법 III).
 */
export interface AvoidanceHit {
  code: string;
  name: string;
  risk: RiskState;
}

function mapAvoidances(w: AvoidanceOverlapWire[] | null | undefined): AvoidanceHit[] {
  if (!Array.isArray(w)) return []; // null(온보딩 미완료) = 표시 안 함
  return w
    .filter((a) => a.overlapped === true)
    .map((a) => {
      const risk = mapRisk(a.riskLevel ?? 'UNKNOWN');
      return {
        code: a.code,
        name: a.name ?? a.code,
        // unable(미지)·safe 결측 → caution 강등. danger/caution은 그대로.
        risk: risk === 'danger' || risk === 'caution' ? risk : 'caution',
      };
    });
}

/** KB-1006: 수량 옵션 — 메뉴판 표기 label + 가격(KRW 정수). 이상값 칸은 버리고, 남은 게 2개 미만이면 옵션 없음(null) */
export interface PriceOption {
  label: string;
  priceKrw: number;
}
export function mapPriceOptions(w: PriceOptionWire[] | null | undefined): PriceOption[] | null {
  if (!Array.isArray(w)) return null;
  const out = w.flatMap((o) =>
    o && typeof o.label === 'string' && o.label.trim() && typeof o.priceKrw === 'number' && Number.isFinite(o.priceKrw)
      ? [{ label: o.label.trim(), priceKrw: o.priceKrw }]
      : [],
  );
  return out.length >= 2 ? out : null;
}

/** KB-1006(커맨드 확정 11/5): 서버 맵기 0~10 → 고추 ceil(s/2)개(1~5). 0·-1(모름)·결측 = 0 = 표시 안 함 */
export function spiceRank(s: number | null | undefined): number {
  if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0) return 0;
  return Math.min(5, Math.ceil(s / 2));
}

/** 공통 판정 매핑 — matched=false 는 wire 값 무관 unable (false-safe, 헌법 III). */
function verdict(r: ScanResultWire) {
  return {
    risk: r.matched ? mapRisk(r.riskLevel) : 'unable',
    matched: r.matched,
    foodId: r.foodId != null ? String(r.foodId) : null,
    koreanName: r.koreanName ?? null,
    // 가격은 제공값 그대로(환율·추정 금지) — 숫자가 아니면 미표기와 동일하게 null
    price: typeof r.price === 'number' && Number.isFinite(r.price) ? r.price : null,
    // P-241 v2: 행 썸네일 — 절대 URL만 통과(refToUrl 규칙과 동일·비-URL = null).
    // P-366 ⑤(KB-529): 서버 기본 이미지 URL은 null 강등 — CardPhoto가 번들 로컬
    // 에셋(1.1KB)으로 대체(KB-515 결정 승계: 927KB CDN PNG ×90 재로딩 방지).
    imageUrl:
      r.imageRef && /^https?:\/\//.test(r.imageRef) && !r.imageRef.includes('default_miss_food/food_not_found.png')
        ? r.imageRef
        : null,
    // P-219 v2: 내 회피 재료 중 겹치는 것만(빈 배열 = 표시 안 함 — 빈 컨테이너 금지)
    avoidances: mapAvoidances(r.avoidances),
    // KB-789 v3.0: 대체 항목 — 엄격 true만(2.0 부재·이상값 = false). 원문은 비어 있으면 null.
    substituted: r.substituted === true,
    originalScannedName: typeof r.originalScannedName === 'string' && r.originalScannedName.trim() ? r.originalScannedName : null,
    // KB-992: AI 추정 대기 키 — 매칭·대체 항목엔 서버가 실어 보내도 무시(DB 판정이 정본)
    pendingId: !r.matched && r.substituted !== true && typeof r.pendingId === 'string' && r.pendingId.trim() ? r.pendingId : null,
    // KB-1006(S-969 v0): 수량 옵션(2개 이상만)·맵기(고추 수)
    priceOptions: mapPriceOptions(r.priceOptions),
    spice: spiceRank(r.spiciness),
  } as const;
}

/**
 * Join BE results to scanned items by idx. Items absent from the results are
 * non-food per the server → excluded (returned array may be shorter) — 7/10
 * 결정 유지 (P-002 착수 질의 → 커맨드 센터 확정 7/16).
 */
export function mergeResults(items: ScannedItem[], results: ScanResultWire[]): ScanOverlayItem[] {
  const byIdx = new Map<number, ScanResultWire>();
  for (const r of results) if (r.idx != null) byIdx.set(r.idx, r);
  const out: ScanOverlayItem[] = [];
  for (const it of items) {
    const r = byIdx.get(it.itemId);
    if (!r) continue; // server says non-food → no marker, no list row
    out.push({ ...it, ...verdict(r), displayName: r.name ?? it.rawMenuName });
  }
  return out;
}

/** 사진에서만 추출된 항목(idx=null) — 좌표가 없어 리스트 전용. */
export interface PhotoOnlyItem {
  risk: RiskState;
  matched: boolean;
  foodId: string | null;
  displayName: string;
  koreanName: string | null;
  price: number | null;
  /** P-241 v2: 행 썸네일 URL(비매칭 = 디폴트 이미지 — 서버가 채움). */
  imageUrl: string | null;
  /** P-219 v2: 겹친 회피 성분(overlapped=true만). 빈 배열 = 미표시. */
  avoidances: AvoidanceHit[];
  /** KB-789 v3.0 — ScanOverlayItem과 동일 규칙. */
  substituted: boolean;
  originalScannedName: string | null;
  /** KB-992 — ScanOverlayItem과 동일 규칙. */
  pendingId: string | null;
  priceOptions: PriceOption[] | null; // KB-1006
  spice: number; // KB-1006
}

/**
 * idx=null 결과(서버가 사진에서 추출했지만 대응 OCR 항목이 없는 메뉴)를 리스트
 * 전용 항목으로 변환. 버리면 DANGER 메뉴가 사용자에게 안 보이는 갭 — 숨김 금지
 * (P-002 안전 게이트, 헌법 III). 오버레이 마커는 좌표 부재로 없음(정상).
 */
export function photoOnlyResults(results: ScanResultWire[]): PhotoOnlyItem[] {
  return results
    .filter((r) => r.idx == null)
    .map((r) => ({ ...verdict(r), displayName: r.name ?? r.koreanName ?? '?' }));
}

/** KB-992 AI 추정 항목 — 리스트 하단 'AI 추정' 섹션의 한 줄. */
export interface AiPendingItem {
  pendingId: string;
  kind: 'dish' | 'drink' | 'notFood';
  name: string | null;
  koreanName: string | null;
  description: string | null;
  /** caution | unable만 — AI 추정은 안전 판정을 내리지 않는다(헌법 III). */
  risk: 'caution' | 'unable';
  /** 들어 있을 수 있는 회피 재료 코드 — 표시 이름은 화면이 렌더 시점에(restrictionLabel — 언어 전환 즉시 반영) */
  avoidCodes: string[];
  /** false = 서버 15초 마감 채움(`filled: true`, #565) — 추정이 아니라 미도착과 같게 다룬다(현행 unable 행).
   *  filled 필드가 없는 서버(배포 전)만 내용(UNKNOWN·설명 null·재료 0)으로 판별. */
  estimated: boolean;
  /** KB-1006(S-969 v0): 메뉴판 가격·옵션 — 결과 줄과 같은 규칙 */
  priceKrw: number | null;
  priceOptions: PriceOption[] | null;
  /** KB-1006: 고추 수 0~5(0 = 표시 안 함) */
  spice: number;
  /** KB-1006: 추정 재료 전체 코드(avoidCodes 포함 — 화면이 겹친 것만 경고 강조) */
  estimatedCodes: string[];
  /** KB-1006: 생성 사진 상태 — generating = 점 애니메이션 자리, ready = imageUrl, none = 기본 이미지 */
  image: 'generating' | 'ready' | 'none';
  imageUrl: string | null;
  /** KB-1006: 서버가 생성한 사진 — 'AI 생성' 표시 */
  aiImage: boolean;
}

/**
 * KB-992: AI 추정 결과 매핑. ⚠️ false-safe 0 — SAFE·미지 = unable, DANGER = caution
 * (발주: 뱃지는 CAUTION/UNABLE 두 가지만, 경고는 내리지 않는 쪽). 미지 kind = 음식으로 취급(행 유지 — 숨김보다 안전).
 */
export function adaptPendingItem(w: ScanPendingItemWire): AiPendingItem {
  const lv = w.riskLevel;
  const text = (v: string | null | undefined) => (typeof v === 'string' && v.trim() ? v : null);
  const risk: AiPendingItem['risk'] = lv === 'CAUTION' || lv === 'DANGER' ? 'caution' : 'unable'; // UNKNOWN·SAFE·미지 = unable
  const description = text(w.description);
  // 확정 계약 = 코드 문자열 배열. 초안의 객체 모양(overlapped)도 받는다 — 겹친 것만
  const avoidCodes = [...new Set((w.avoidances ?? []).flatMap((a) =>
    typeof a === 'string' ? (a.trim() ? [a.trim()] : []) : a && a.overlapped === true && a.code ? [a.code] : [],
  ))];
  return {
    pendingId: w.pendingId,
    kind: w.kind === 'NOT_FOOD' ? 'notFood' : w.kind === 'DRINK' ? 'drink' : 'dish',
    name: text(w.name),
    koreanName: text(w.koreanName),
    description,
    risk,
    avoidCodes,
    estimated: typeof w.filled === 'boolean' ? !w.filled : risk === 'caution' || description != null || avoidCodes.length > 0,
    priceKrw: typeof w.priceKrw === 'number' && Number.isFinite(w.priceKrw) ? w.priceKrw : null,
    priceOptions: mapPriceOptions(w.priceOptions),
    spice: spiceRank(w.spiciness),
    // 겹친 코드가 목록에 없더라도 칩에서 빠지지 않게 합친다(경고 표면 축소 0)
    estimatedCodes: [...new Set([...avoidCodes, ...(w.estimatedCodes ?? []).filter((c): c is string => typeof c === 'string' && !!c.trim()).map((c) => c.trim())])],
    ...pendingImage(w),
  };
}

/** KB-1006: 생성 사진 상태 — READY인데 URL이 없으면 none(기본 이미지), 미지·부재 = 구 서버(사진 없음) → none */
function pendingImage(w: ScanPendingItemWire): Pick<AiPendingItem, 'image' | 'imageUrl' | 'aiImage'> {
  const url = typeof w.imageUrl === 'string' && /^https?:\/\//.test(w.imageUrl) ? w.imageUrl : null;
  if (w.imageStatus === 'GENERATING') return { image: 'generating', imageUrl: null, aiImage: false };
  if (w.imageStatus === 'READY' && url) return { image: 'ready', imageUrl: url, aiImage: w.aiGeneratedImage === true };
  return { image: 'none', imageUrl: null, aiImage: false };
}
