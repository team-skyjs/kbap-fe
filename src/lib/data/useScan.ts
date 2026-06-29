/**
 * useScan — the ONE hook wired LIVE to the real BE for the scan spike (§13-1).
 * Other hooks stay on MOCK_MODE; this one always hits meogo.handev.site.
 *
 * Takes client-scanned items (OCR text + on-device box), POSTs the text +
 * boxes, then returns items enriched with the BE risk verdict for the overlay.
 */
import { useMutation } from '@tanstack/react-query';
import { BE_BASE } from './config';
import type { BaseResponse, MenuScanPayload, MenuScanRequest } from '@/lib/api/scanTypes';
import {
  mergeResults,
  type ScanOverlayItem,
  type ScannedItem,
} from '@/lib/api/scanAdapter';

const SCAN_URL = `${BE_BASE}/api/v1/menu-scans`;

async function postScan(items: ScannedItem[]): Promise<ScanOverlayItem[]> {
  const body: MenuScanRequest = {
    items: items.map((it) => ({
      itemId: it.itemId,
      rawMenuName: it.rawMenuName,
      boundingBox: it.box,
    })),
  };
  // Stage logs (prefix "[scan]") — watch in Metro to confirm the BE roundtrip.
  console.log('[scan] POST', SCAN_URL, '| items =', body.items.length);
  console.log('[scan] request body =', JSON.stringify(body));

  let res: Response;
  try {
    res = await fetch(SCAN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // fetch rejects → no connectivity / DNS / TLS → distinctly a NETWORK failure
    console.log('[scan] NETWORK error =', String((e as Error)?.message ?? e));
    throw new Error(`NETWORK: ${(e as Error)?.message ?? e}`);
  }

  const raw = await res.text();
  console.log('[scan] response status =', res.status, '| body =', raw.slice(0, 400));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 160)}`);

  let json: BaseResponse<MenuScanPayload>;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`BAD_JSON: ${raw.slice(0, 160)}`);
  }
  // Branch on success + null-guard payload (§13-6), never trust HTTP alone.
  if (!json.success || !json.payload) {
    throw new Error(`NO_PAYLOAD: success=${json.success} message=${json.message ?? 'null'}`);
  }
  const merged = mergeResults(items, json.payload.results ?? []);
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
