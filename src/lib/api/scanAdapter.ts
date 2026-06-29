/**
 * scanAdapter.ts — the boundary translation BE → internal (handoff §13-2/§13-6).
 *
 * - Maps BE riskLevel → internal RiskState. ANY unrecognized value falls back to
 *   'unable' — NEVER 'safe' (Constitution III, false-safe = 0).
 * - Merges BE results back onto the client's scanned items by itemId, so we
 *   never assume itemId order == risk (BE scan is currently a mock that cycles
 *   risk by itemId — §13-6; we render the returned riskLevel as-is).
 */
import type { RiskState } from '@/lib/theme';
import type {
  BeRiskLevel,
  BoundingBox,
  MenuScanResultWire,
} from './scanTypes';

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
  itemId: number;
  rawMenuName: string;
  box: BoundingBox;
}

/** Item enriched with the BE verdict — what the overlay renders. */
export interface ScanOverlayItem extends ScannedItem {
  risk: RiskState;
  reason: string | null;
}

/**
 * Join BE results to scanned items by itemId. Items the BE didn't return are
 * rendered 'unable' (we never silently drop or assume safe).
 */
export function mergeResults(
  items: ScannedItem[],
  results: MenuScanResultWire[],
): ScanOverlayItem[] {
  const byItemId = new Map<number, MenuScanResultWire>();
  for (const r of results) byItemId.set(r.itemId, r);
  return items.map((it) => {
    const r = byItemId.get(it.itemId);
    return {
      ...it,
      risk: r ? mapRisk(r.riskLevel) : 'unable',
      reason: r?.reason ?? null,
    };
  });
}
