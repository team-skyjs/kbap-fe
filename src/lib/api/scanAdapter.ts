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
import type { BeRiskLevel, BoundingBox, ScanResultWire } from './scanTypes';

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
}

/**
 * Join BE results to scanned items by idx. Items absent from the results are
 * non-food per the server → excluded (returned array may be shorter).
 */
export function mergeResults(items: ScannedItem[], results: ScanResultWire[]): ScanOverlayItem[] {
  const byIdx = new Map<number, ScanResultWire>();
  for (const r of results) byIdx.set(r.idx, r);
  const out: ScanOverlayItem[] = [];
  for (const it of items) {
    const r = byIdx.get(it.itemId);
    if (!r) continue; // server says non-food → no marker, no list row
    out.push({
      ...it,
      risk: r.matched ? mapRisk(r.riskLevel) : 'unable',
      matched: r.matched,
      foodId: r.foodId != null ? String(r.foodId) : null,
      displayName: r.name ?? it.rawMenuName,
      koreanName: r.koreanName ?? null,
    });
  }
  return out;
}
