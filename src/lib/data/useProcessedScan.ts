/**
 * 가공식품 이름 스캔(KB-813, 서버 S4 — dev 3.2, 회원 전용). 계약 = spec processed-food-s4-name-scan-contract.md.
 * - `POST /api/processed-foods/scan/name` {ocrText ≤2000, lang} → analysisId + 후보 ≤5(차감 0)
 * - `POST /api/processed-foods/scan/confirm` {analysisId, reportNo|null} → 상세 + charged(성공 1회) / null = 해당 없음(REJECTED, 차감 0)
 * 같은 analysisId 재확정 = 같은 결과·charged false(서버 멱등) — 재시도는 같은 ID로.
 * 차감 표시는 서버 charged와 프로필 쿼터 재조회만 — 앱이 횟수를 추정하지 않는다.
 */
import { api, ApiError } from '../api/client';
import { adaptScanConfirm, adaptScanName, type ScanConfirmResult, type ScanConfirmWire, type ScanNameResult, type ScanNameWire } from '../api/processedFoodAdapter';
import { PROCESSED_FOOD_API_VERSION } from './useProcessedFoods';

export const OCR_TEXT_MAX = 2000;
const headers = { headers: { 'X-API-Version': PROCESSED_FOOD_API_VERSION } };

export async function scanProcessedName(ocrText: string, lang: string): Promise<ScanNameResult> {
  const text = Array.from(ocrText).slice(0, OCR_TEXT_MAX).join(''); // 서버 상한 2000자(코드포인트로 자름 — 서로게이트 깨짐 방지)
  return adaptScanName(await api.post<ScanNameWire>('/api/processed-foods/scan/name', { ocrText: text, lang }, headers));
}
export async function confirmProcessedScan(analysisId: string, reportNo: string | null): Promise<ScanConfirmResult> {
  return adaptScanConfirm(await api.post<ScanConfirmWire>('/api/processed-foods/scan/confirm', { analysisId, reportNo }, headers));
}

/** 오류 분류 — 어느 것도 차감 0(서버가 차감은 성공 응답의 charged로만 알린다). */
export type ScanFailure = 'expired' | 'conflict' | 'quota' | 'gone' | 'discontinued' | 'network';
export function scanFailureOf(e: unknown): ScanFailure {
  if (!(e instanceof ApiError)) return 'network';
  if (e.code === 'PFOOD-003') return 'expired'; // 만료·없음 — 다시 촬영
  if (e.code === 'PFOOD-004') return 'conflict'; // 이미 다른 결과로 확정된 분석
  if (e.code === 'SCAN-004' || e.status === 403) return 'quota';
  if (e.code === 'PFOOD-002' || e.status === 410) return 'discontinued';
  if (e.code === 'PFOOD-001' || e.status === 404) return 'gone';
  return 'network';
}
