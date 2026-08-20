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
import type { AvoidanceOverlapWire, BeRiskLevel, BoundingBox, ScanResultWire } from './scanTypes';

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

/** 공통 판정 매핑 — matched=false 는 wire 값 무관 unable (false-safe, 헌법 III). */
function verdict(r: ScanResultWire) {
  return {
    risk: r.matched ? mapRisk(r.riskLevel) : 'unable',
    matched: r.matched,
    foodId: r.foodId != null ? String(r.foodId) : null,
    koreanName: r.koreanName ?? null,
    // 가격은 제공값 그대로(환율·추정 금지) — 숫자가 아니면 미표기와 동일하게 null
    price: typeof r.price === 'number' && Number.isFinite(r.price) ? r.price : null,
    // P-241 v2: 행 썸네일 — 절대 URL만 통과(refToUrl 규칙과 동일·비-URL = null)
    imageUrl: r.imageRef && /^https?:\/\//.test(r.imageRef) ? r.imageRef : null,
    // P-219 v2: 내 회피 재료 중 겹치는 것만(빈 배열 = 표시 안 함 — 빈 컨테이너 금지)
    avoidances: mapAvoidances(r.avoidances),
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
