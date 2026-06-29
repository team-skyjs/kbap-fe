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

  const res = await fetch(SCAN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`menu-scans HTTP ${res.status}`);

  const json = (await res.json()) as BaseResponse<MenuScanPayload>;
  // Branch on success + null-guard payload (§13-6), never trust HTTP alone.
  if (!json.success || !json.payload) {
    throw new Error('menu-scans returned no payload');
  }
  return mergeResults(items, json.payload.results ?? []);
}

export function useScan() {
  return useMutation({
    mutationKey: ['menu-scans'],
    mutationFn: postScan,
  });
}

export type { ScannedItem, ScanOverlayItem };
