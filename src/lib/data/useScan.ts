/**
 * useScan — wired LIVE to POST /api/v1/scans (KB-72 신계약 2026-07-16).
 *
 * Sends { imagePath, items: [{ idx, rawMenuName }] } — the server does the
 * cleanup + catalog matching; boxes stay on-device for the overlay (7/16
 * 예진×종한 합의 — 온디바이스 OCR 유지). imagePath 는 업로드 검증 흐름
 * (scanImage.ts)이 해석하며, presigned 발급 API 미배포 동안은 '' (텍스트-only
 * 폴백). Returns the joined overlay items, photo-only items (idx=null — 리스트
 * 전용), plus the `degraded` flag (정제 실패/부재 → 안내 배너).
 */
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ScanPayload, ScanRequest } from '@/lib/api/scanTypes';
import {
  mergeResults,
  photoOnlyResults,
  type PhotoOnlyItem,
  type ScanOverlayItem,
  type ScannedItem,
} from '@/lib/api/scanAdapter';
import { resolveScanImagePath } from '@/lib/api/scanImage';

export interface ScanPhoto {
  uri: string;
  width: number;
  height: number;
}

export interface ScanInput {
  items: ScannedItem[];
  photo: ScanPhoto | null; // null = 샘플 스캔 (사진 없음)
}

export interface ScanOutcome {
  degraded: boolean;
  items: ScanOverlayItem[];
  /** idx=null — 사진에서만 추출된 메뉴 (좌표 없음 → 리스트 전용, 숨김 금지). */
  photoOnly: PhotoOnlyItem[];
}

async function postScan({ items, photo }: ScanInput): Promise<ScanOutcome> {
  // ⑦(KB-137) 순서: 업로드 해석은 촬영 파일 삭제(사진 교체/화면 언마운트 시)보다
  // 먼저 여기서 실행된다 — 스캔 중에는 삭제 트리거가 없다(언마운트=스캔 폐기).
  const imagePath = await resolveScanImagePath(photo);
  const body: ScanRequest = {
    imagePath: imagePath ?? '', // 계약상 required — '' = 텍스트-only (TODO(KB-72) 발급 API 대기)
    items: items.map((it) => ({ idx: it.itemId, rawMenuName: it.rawMenuName })),
  };
  // Stage logs (prefix "[scan]") — watch in Metro to confirm the BE roundtrip.
  // Envelope unwrap + error normalization live in the shared client (KB-66):
  // api.post resolves `payload` or throws ApiError (incl. "NETWORK:" on fetch
  // reject, which scan.tsx branches on for its network error UI).
  console.log('[scan] POST /scans | items =', body.items.length, '| imagePath =', body.imagePath || '(none)');
  const payload = await api.post<ScanPayload>('/scans', body);
  const merged = mergeResults(items, payload.results ?? []);
  const photoOnly = photoOnlyResults(payload.results ?? []);
  console.log(
    '[scan] degraded =', payload.degraded,
    '| results =', JSON.stringify(merged.map((m) => ({ name: m.displayName, matched: m.matched, risk: m.risk, price: m.price }))),
    '| photoOnly =', photoOnly.length,
  );
  return { degraded: payload.degraded, items: merged, photoOnly };
}

export function useScan() {
  return useMutation({
    mutationKey: ['scans'],
    mutationFn: postScan,
  });
}

export type { ScannedItem, ScanOverlayItem, PhotoOnlyItem };
