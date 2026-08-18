/**
 * useScan — wired LIVE to POST /api/v1/scans (KB-72 신계약 2026-07-16).
 *
 * Sends { imagePath, items: [{ idx, rawMenuName }] } — the server does the
 * cleanup + catalog matching; boxes stay on-device for the overlay (7/16
 * 예진×종한 합의 — 온디바이스 OCR 유지). imagePath 는 업로드 검증 흐름
 * (scanImage.ts: 발급→PUT→complete, P-003 실연동)이 해석하며, 업로드 실패
 * 시 '' (텍스트-only 폴백 — BE 허용 확정 7/16). Returns the joined overlay
 * items, photo-only items (idx=null — 리스트
 * 전용), plus the `degraded` flag (정제 실패/부재 → 안내 배너).
 */
import { useMutation } from '@tanstack/react-query';
import { api, apiLang } from '@/lib/api/client';
import type { ScanPayload, ScanRequest } from '@/lib/api/scanTypes';
import {
  mergeResults,
  photoOnlyResults,
  type PhotoOnlyItem,
  type ScanOverlayItem,
  type ScannedItem,
} from '@/lib/api/scanAdapter';
import { resolveScanImagePath } from '@/lib/api/scanImage';
import { FLAGS, isProdChannel } from '@/lib/flags';

export interface ScanPhoto {
  uri: string;
  width: number;
  height: number;
}

export interface ScanInput {
  items: ScannedItem[];
  photo: ScanPhoto | null; // null = 샘플 스캔 (사진 없음)
  /** P-219 v2 필수 — 화면이 resolveCurrency()로 해석해 넘긴다(누락 = 400). */
  currency?: string | null;
}

export interface ScanOutcome {
  degraded: boolean;
  items: ScanOverlayItem[];
  /** idx=null — 사진에서만 추출된 메뉴 (좌표 없음 → 리스트 전용, 숨김 금지). */
  photoOnly: PhotoOnlyItem[];
}

/** P-153: 스캔 v2(서버 비전 OCR) — dev 계열 채널만(prod 서버 미배포, P-114 관례).
 *  P-155: FLAGS.scanV2 킬스위치 경유(되돌리면 v1 즉시 복귀 — OCR 코드 보존).
 *  P-219(8/17 dev 스웨거 실측): 버전 헤더 = **'2.0'**(구 날짜판 폐기),
 *  쿼리 `lang`·**`currency` 둘 다 필수**(누락 시 400 — 스캔 전면 사망), 본문 =
 *  `{ imagePath }`만. ⚠️ prod 채널은 1.0 계약이라 절대 v2로 가지 않는다. */
export const SCAN_API_VERSION = '2.0';
export function scanV2Enabled(): boolean {
  return FLAGS.scanV2 && !isProdChannel();
}

export async function postScan({ items, photo, currency }: ScanInput): Promise<ScanOutcome> {
  // ⑦(KB-137) 순서: 업로드 해석은 촬영 파일 삭제(사진 교체/화면 언마운트 시)보다
  // 먼저 여기서 실행된다 — 스캔 중에는 삭제 트리거가 없다(언마운트=스캔 폐기).
  const imagePath = await resolveScanImagePath(photo);
  const v2 = scanV2Enabled();
  // v2: imagePath만으로 성립(items 무시 — 서버 OCR). v1(prod): items 필수(누락 400).
  const body: ScanRequest = v2
    ? { imagePath: imagePath ?? '', items: [] }
    : {
        imagePath: imagePath ?? '', // '' = 텍스트-only 폴백 (BE 허용 확정 7/16 — 업로드 실패해도 스캔 지속)
        items: items.map((it) => ({ idx: it.itemId, rawMenuName: it.rawMenuName })),
      };
  // Stage logs (prefix "[scan]") — watch in Metro to confirm the BE roundtrip.
  // Envelope unwrap + error normalization live in the shared client (KB-66):
  // api.post resolves `payload` or throws ApiError (incl. "NETWORK:" on fetch
  // reject, which scan.tsx branches on for its network error UI).
  console.log(`[scan] POST /scans ${v2 ? `(v2 ${SCAN_API_VERSION} — 서버 OCR)` : '(v1)'} | items =`, body.items.length, '| imagePath =', body.imagePath || '(none)');
  // P-060③: 지역화 응답 — 타 엔드포인트와 동일하게 lang 필수 (스웨거 반영 확인)
  // P-115: 스캔 ML 처리는 15s 기본을 정당하게 넘을 수 있음 — 60s 오버라이드
  // P-219: currency는 v2 필수 — 해석 실패(빈 값)여도 요청을 죽이지 말고 USD 강제
  // (400보다 근사 환산이 낫다 — 발주 명시). v1 경로는 쿼리를 붙이지 않는다.
  const cur = v2 ? (currency && currency.trim() ? currency : 'USD') : null;
  const query = `?lang=${apiLang()}${cur ? `&currency=${encodeURIComponent(cur)}` : ''}`;
  const startedAt = Date.now();
  let payload: ScanPayload;
  try {
    payload = await api.post<ScanPayload>(`/scans${query}`, body, {
      // P-234 확정: P-232 실측 — v2 vision 정상 완료 ~58초(행 아님·추론 모델 지연).
      // 58초 × 여유 2배 = 120초. 종한 모델/비동기 개선 시 재조정.
      timeoutMs: 120_000,
      ...(v2 ? { headers: { 'X-API-Version': SCAN_API_VERSION } } : {}),
    });
  } catch (e) {
    // 실패도 소요 초가 진단 데이터 — 몇 초에 무슨 에러인지
    console.log(`[scan] v2 응답 ${Math.round((Date.now() - startedAt) / 1000)}초 — 실패:`, (e as Error)?.message ?? e);
    throw e;
  }
  console.log(`[scan] v2 응답 ${Math.round((Date.now() - startedAt) / 1000)}초`);
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
