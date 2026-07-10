/**
 * useScan — wired LIVE to POST /api/v1/scans (KB-72 신계약 2026-07-10).
 *
 * Sends { idx, rawMenuName } only — the server does the cleanup + catalog
 * matching; boxes stay on-device for the overlay. Returns the joined overlay
 * items plus the `degraded` flag (정제 실패/부재 → 안내 배너).
 */
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ScanPayload, ScanRequest } from '@/lib/api/scanTypes';
import { mergeResults, type ScanOverlayItem, type ScannedItem } from '@/lib/api/scanAdapter';

export interface ScanOutcome {
  degraded: boolean;
  items: ScanOverlayItem[];
}

async function postScan(items: ScannedItem[]): Promise<ScanOutcome> {
  const body: ScanRequest = {
    items: items.map((it) => ({ idx: it.itemId, rawMenuName: it.rawMenuName })),
  };
  // Stage logs (prefix "[scan]") — watch in Metro to confirm the BE roundtrip.
  // Envelope unwrap + error normalization live in the shared client (KB-66):
  // api.post resolves `payload` or throws ApiError (incl. "NETWORK:" on fetch
  // reject, which scan.tsx branches on for its network error UI).
  console.log('[scan] POST /scans | items =', body.items.length);
  const payload = await api.post<ScanPayload>('/scans', body);
  const merged = mergeResults(items, payload.results ?? []);
  console.log(
    '[scan] degraded =', payload.degraded,
    '| results =', JSON.stringify(merged.map((m) => ({ name: m.displayName, matched: m.matched, risk: m.risk }))),
  );
  return { degraded: payload.degraded, items: merged };
}

export function useScan() {
  return useMutation({
    mutationKey: ['scans'],
    mutationFn: postScan,
  });
}

export type { ScannedItem, ScanOverlayItem };
