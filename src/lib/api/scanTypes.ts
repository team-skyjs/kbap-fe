/**
 * scanTypes.ts — WIRE types for the scan endpoint (KB-72, Swagger 재배포
 * 2026-07-10). Mirror the BE swagger EXACTLY; the adapter (scanAdapter.ts)
 * translates BE → internal so screens never see BE enums/wrappers.
 *
 *   POST /api/v1/scans
 *   req: { items: [{ idx, rawMenuName }] }   — boxes stay ON-DEVICE (overlay)
 *   res: BaseResponse<{ degraded, results: [{ idx, matched, foodId,
 *        riskLevel, name, koreanName }] }>
 *     - results may be SHORTER than the request: non-food lines (원산지·가격·
 *       UI 문구) are excluded by the server
 *     - matched=false ⇒ 조사 대기: riskLevel is always UNKNOWN, and foodId may
 *       still be present — branch on `matched`, never on foodId (Swagger 명시)
 *     - degraded=true ⇒ 정제(LLM) 실패/부재: non-food may leak into results,
 *       all UNMATCHED
 */

/** BE generic envelope — canonical definition lives in the shared client (KB-66). */
export type { BaseResponse } from './client';

export type BeRiskLevel = 'SAFE' | 'CAUTION' | 'DANGER' | 'UNKNOWN';

/** Normalized 0..1 box — kept on-device for the overlay (NOT sent since 2026-07-10). */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScanReqItem {
  idx: number; // client-assigned, unique within one request
  rawMenuName: string; // OCR text, RAW (server does the cleanup + matching)
}

export interface ScanRequest {
  items: ScanReqItem[];
}

export interface ScanResultWire {
  idx: number;
  matched: boolean; // false = 조사 대기 (riskLevel UNKNOWN, no detail screen)
  foodId?: number | null; // present even for some unmatched items — do NOT branch on it
  riskLevel: BeRiskLevel;
  name?: string | null; // display name (ko for now; localizes once auth lands)
  koreanName?: string | null;
}

export interface ScanPayload {
  degraded: boolean;
  results: ScanResultWire[];
}
