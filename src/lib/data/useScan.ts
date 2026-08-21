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
  /** P-255: 화면 선발급 티켓(진입 시 소진 선제 안내용) — 있으면 재사용(발급 1회 절감),
   *  없으면 자체 발급 폴백. 만료는 SCAN-007 조용한 재발급이 처리(P-250 무변). */
  ticket?: string | null;
}

export interface ScanOutcome {
  degraded: boolean;
  items: ScanOverlayItem[];
  /** idx=null — 사진에서만 추출된 메뉴 (좌표 없음 → 리스트 전용, 숨김 금지). */
  photoOnly: PhotoOnlyItem[];
  /** P-242: v2 서버 실환율 — null = 조회 실패(배지 생략)·undefined = v1(테이블 폴백). */
  fx?: { code: string; krwPerUnit: number } | null;
  /** P-252: 이 스캔의 검증된 이미지 경로 — 주문 이력(POST /api/orders) 식별자 재사용.
   *  '' = 업로드 실패(텍스트-only) — 이력에선 생략 처리. */
  imagePath?: string;
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

/** P-250(KB-345): 스캔 티켓 발급 — v2 필수 선행(가이드 PR #181). body 없음.
 *  티켓은 **스캔 시도 스코프**에서만 산다(전역·영구 저장 금지 — 시도마다 신규 발급,
 *  만료 클라 판정 금지: expiresInSeconds는 판정에 안 쓴다·SCAN-007 응답이 기준). */
export async function issueScanTicket(): Promise<string> {
  const p = await api.post<{ ticket: string; expiresInSeconds: number }>('/api/scans/tickets', undefined, {
    headers: { 'X-API-Version': SCAN_API_VERSION },
  });
  return p.ticket;
}

export async function postScan({ items, photo, currency, ticket: preTicket }: ScanInput): Promise<ScanOutcome> {
  const v2 = scanV2Enabled();
  // P-250: 티켓 발급이 업로드보다 먼저 — SCAN-004(무료 소진)면 업로드 비용 자체가
  // 발생하지 않아야 한다(가이드 명시·시나리오 B). v1 = 티켓 로직 0(가이드 비대상).
  // P-255: 화면 선발급분이 있으면 재사용(진입 시 소진 선제 확인의 부산물).
  let ticket = v2 ? (preTicket ?? (await issueScanTicket())) : null;
  // ⑦(KB-137) 순서: 업로드 해석은 촬영 파일 삭제(사진 교체/화면 언마운트 시)보다
  // 먼저 여기서 실행된다 — 스캔 중에는 삭제 트리거가 없다(언마운트=스캔 폐기).
  const imagePath = await resolveScanImagePath(photo);
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
  const doPost = () =>
    api.post<ScanPayload>(`/scans${query}`, body, {
      // P-234 확정: P-232 실측 — v2 vision 정상 완료 ~58초(행 아님·추론 모델 지연).
      // 58초 × 여유 2배 = 120초. 종한 모델/비동기 개선 시 재조정.
      timeoutMs: 120_000,
      // P-250: X-Scan-Ticket — v2 필수(누락 400). 티켓은 이 시도의 값만.
      ...(v2 ? { headers: { 'X-API-Version': SCAN_API_VERSION, 'X-Scan-Ticket': ticket! } } : {}),
    });
  let payload: ScanPayload;
  try {
    try {
      payload = await doPost();
    } catch (e) {
      // P-250: SCAN-007(티켓 무효·만료 — 시나리오 F) = 조용히 새 티켓 1회 재발급 후
      // 재시도(이미지 재업로드 없음 — path 재사용). 반복 실패는 아래로 던져 안내.
      // SCAN-005(처리 중)는 자동 재발급 금지(가이드) — 그대로 던진다.
      if (v2 && (e as { code?: string })?.code === 'SCAN-007') {
        console.log('[scan] SCAN-007 — 티켓 재발급 후 1회 재시도');
        ticket = await issueScanTicket();
        payload = await doPost();
      } else {
        throw e;
      }
    }
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
  // P-242: v2 = 서버 환율 관통(null = 실패 규약 — 배지 생략), v1 = undefined(테이블)
  return { degraded: payload.degraded, items: merged, photoOnly, imagePath: imagePath ?? '', ...(v2 ? { fx: payload.currency ?? null } : {}) };
}

export function useScan() {
  return useMutation({
    mutationKey: ['scans'],
    mutationFn: postScan,
  });
}

export type { ScannedItem, ScanOverlayItem, PhotoOnlyItem };
