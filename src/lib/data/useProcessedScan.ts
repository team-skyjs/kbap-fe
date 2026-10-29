/**
 * 가공식품 이름 스캔(KB-813, 서버 S4 — dev 3.2, 회원 전용). 계약 = spec processed-food-s4-name-scan-contract.md.
 * - `POST /api/processed-foods/scan/name` {ocrText ≤2000, lang} → analysisId + 후보 ≤5(차감 0)
 * - `POST /api/processed-foods/scan/confirm` {analysisId, reportNo|null} → 상세 + charged(성공 1회) / null = 해당 없음(REJECTED, 차감 0)
 * 같은 analysisId 재확정 = 같은 결과·charged false(서버 멱등) — 재시도는 같은 ID로.
 * 차감 표시는 서버 charged와 프로필 쿼터 재조회만 — 앱이 횟수를 추정하지 않는다.
 */
import { api, ApiError } from '../api/client';
import { adaptLabelScan, adaptScanConfirm, adaptScanName, type LabelScanResult, type LabelScanWire, type ScanConfirmResult, type ScanConfirmWire, type ScanNameResult, type ScanNameWire } from '../api/processedFoodAdapter';
import { PROCESSED_FOOD_API_VERSION } from './processedFoodApiVersion';

export const OCR_TEXT_MAX = 2000;
const headers = { headers: { 'X-API-Version': PROCESSED_FOOD_API_VERSION } };

/** KB-892: imagePath = 앞면 사진 업로드 경로(서버 그림자 모드용) — 없으면 키 자체를 안 보낸다(현행 body와 바이트 동일) */
export async function scanProcessedName(ocrText: string, lang: string, imagePath: string | null = null): Promise<ScanNameResult> {
  const text = Array.from(ocrText).slice(0, OCR_TEXT_MAX).join(''); // 서버 상한 2000자(코드포인트로 자름 — 서로게이트 깨짐 방지)
  const body = imagePath ? { ocrText: text, lang, imagePath } : { ocrText: text, lang };
  return adaptScanName(await api.post<ScanNameWire>('/api/processed-foods/scan/name', body, headers));
}
export async function confirmProcessedScan(analysisId: string, reportNo: string | null): Promise<ScanConfirmResult> {
  return adaptScanConfirm(await api.post<ScanConfirmWire>('/api/processed-foods/scan/confirm', { analysisId, reportNo }, headers));
}

/** P-508(서버 #442): 성분표 분석 — 앱 OCR 원문 1~4면(각 4000자). analysisId = 이름 스캔 NO_CANDIDATE·REJECTED 또는 이전 성분표 결과를
 *  이어 붙임(같은 분석 — 첫 성공 뒤 30분·3회까지 재호출 차감 0), null = 새 분석(성공 1회). 실패 400 PFOOD-006 = 차감 0. */
export const LABEL_PAGES_MAX = 4;
export const LABEL_PAGE_TEXT_MAX = 4000;
/** clientRequestId(서버 #444) = 새 분석(analysisId null)일 때 필수 멱등 키(UUID) — 이어 붙이기는 서버가 무시하므로 보내지 않는다 */
export async function scanProcessedLabel(analysisId: string | null, pages: string[], lang: string, clientRequestId?: string): Promise<LabelScanResult> {
  const body = {
    analysisId,
    ...(analysisId == null && clientRequestId ? { clientRequestId } : {}),
    pages: pages.slice(0, LABEL_PAGES_MAX).map((p) => ({ ocrText: Array.from(p).slice(0, LABEL_PAGE_TEXT_MAX).join('') })),
    lang,
  };
  return adaptLabelScan(await api.post<LabelScanWire>('/api/processed-foods/scan/label', body, headers));
}

/** 오류 분류 — 어느 것도 차감 0(서버가 차감은 성공 응답의 charged로만 알린다).
 *  P-508: unreadable = 성분표를 못 읽음(400 PFOOD-006 — 다시 찍기) · newAnalysis = 이 분석엔 더 못 붙임(409 PFOOD-007 — 무료 재분석
 *  30분·3회 초과 등, 새 분석 = 1회). */
export type ScanFailure = 'expired' | 'conflict' | 'quota' | 'gone' | 'discontinued' | 'network' | 'unreadable' | 'newAnalysis';
export function scanFailureOf(e: unknown): ScanFailure {
  if (!(e instanceof ApiError)) return 'network';
  if (e.code === 'PFOOD-006') return 'unreadable';
  if (e.code === 'PFOOD-007') return 'newAnalysis';
  if (e.code === 'SCAN-005') return 'newAnalysis'; // #444: 같은 멱등 키에 다른 원문 — 새 키로 새 분석(재시도 금지: 같은 키면 계속 409)
  if (e.code === 'PFOOD-003') return 'expired'; // 만료·없음 — 다시 촬영
  if (e.code === 'PFOOD-004') return 'conflict'; // 이미 다른 결과로 확정된 분석
  if (e.code === 'SCAN-004' || e.status === 403) return 'quota';
  if (e.code === 'PFOOD-002' || e.status === 410) return 'discontinued';
  if (e.code === 'PFOOD-001' || e.status === 404) return 'gone';
  return 'network';
}
