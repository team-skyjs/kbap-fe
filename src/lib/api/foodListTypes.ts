/**
 * foodListTypes.ts — WIRE types for GET /api/v1/foods (KB-71, list part).
 * Mirror the redeployed Swagger EXACTLY (PageMenuSummaryResponse /
 * MenuSummaryResponse). Keyset pagination, newest-first, no search term:
 *
 *   GET /api/v1/foods?cursor=<nextCursor>&lang=<bcp47>
 *   res: BaseResponse<PageMenuSummaryWire>
 *     - cursor omitted → first page; pass back `nextCursor` until hasNext=false
 *     - nextCursor is the last item's foodId (int64) — treat as opaque
 */
import type { BeRiskStatus } from './foodDetailTypes';

export interface MenuSummaryWire {
  foodId: number; // int64 — the stable id the detail endpoint keys on
  name: string; // request-language display name (falls back to Korean)
  koreanName?: string | null; // null when the localized name IS Korean
  imageRef?: string | null; // bare image filename (no host defined yet)
  spiciness: number; // 0..10
  overallRiskStatus: BeRiskStatus; // SAFE|CAUTION|DANGER|UNKNOWN
}

export interface PageMenuSummaryWire {
  items: MenuSummaryWire[];
  hasNext: boolean;
  nextCursor?: number | null; // absent/null on the last page
}
