/**
 * scanTypes.ts — WIRE types for the real BE scan endpoint (handoff §13-2).
 * These mirror the BE swagger EXACTLY (provisional contract). They are kept
 * separate from our internal contract types; the adapter (scanAdapter.ts)
 * translates BE → internal so screens never see BE enums/wrappers.
 *
 *   POST /api/v1/menu-scans
 *   req: { items: [{ itemId, rawMenuName, boundingBox:{x,y,width,height} }] }
 *   res: BaseResponse<{ scanId, results:[{ id, itemId, riskLevel, reason }] }>
 *        riskLevel: SAFE | CAUTION | DANGER | UNKNOWN
 */

/** BE generic envelope. Branch on `success` (NOT HTTP status) — §13-6. */
export interface BaseResponse<T> {
  success: boolean;
  payload: T | null;
  message: string | null;
}

export type BeRiskLevel = 'SAFE' | 'CAUTION' | 'DANGER' | 'UNKNOWN';

/** Normalized 0..1 box (kept on-device for overlay; sent for BE bookkeeping). */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MenuScanReqItem {
  itemId: number; // client-assigned 0..n
  rawMenuName: string; // OCR text (ko)
  boundingBox: BoundingBox;
}

export interface MenuScanRequest {
  items: MenuScanReqItem[];
}

export interface MenuScanResultWire {
  id: number;
  itemId: number;
  riskLevel: BeRiskLevel;
  reason: string | null;
}

export interface MenuScanPayload {
  scanId: number;
  results: MenuScanResultWire[];
}
