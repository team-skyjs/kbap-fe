/**
 * useScan — the ONE hook wired LIVE to the real BE for the scan spike (§13-1).
 * Other hooks stay on MOCK_MODE; this one always hits meogo.handev.site.
 *
 * Takes client-scanned items (OCR text + on-device box), POSTs the text +
 * boxes, then returns items enriched with the BE risk verdict for the overlay.
 */
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { MenuScanPayload, MenuScanRequest } from '@/lib/api/scanTypes';
import {
  mergeResults,
  type ScanOverlayItem,
  type ScannedItem,
} from '@/lib/api/scanAdapter';

async function postScan(items: ScannedItem[]): Promise<ScanOverlayItem[]> {
  const body: MenuScanRequest = {
    items: items.map((it) => ({
      itemId: it.itemId,
      rawMenuName: it.rawMenuName,
      boundingBox: it.box,
    })),
  };
  // Stage logs (prefix "[scan]") — watch in Metro to confirm the BE roundtrip.
  // Envelope unwrap + error normalization now live in the shared client (KB-66):
  // api.post resolves `payload` or throws ApiError (incl. "NETWORK:" on fetch
  // reject, which scan.tsx branches on for its network error UI).
  console.log('[scan] POST /menu-scans | items =', body.items.length);
  const payload = await api.post<MenuScanPayload>('/menu-scans', body);
  const merged = mergeResults(items, payload.results ?? []);
  console.log('[scan] merged results =', JSON.stringify(merged.map((m) => ({ name: m.rawMenuName, risk: m.risk }))));
  return merged;
}

export function useScan() {
  return useMutation({
    mutationKey: ['menu-scans'],
    mutationFn: postScan,
  });
}

export type { ScannedItem, ScanOverlayItem };
