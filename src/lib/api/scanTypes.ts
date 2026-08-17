/**
 * scanTypes.ts — WIRE types for the scan endpoint (KB-72, Swagger 재배포
 * 2026-07-10). Mirror the BE swagger EXACTLY; the adapter (scanAdapter.ts)
 * translates BE → internal so screens never see BE enums/wrappers.
 *
 *   POST /api/v1/scans   (imagePath 추가 — Swagger 재배포 2026-07-16)
 *   req: { imagePath, items: [{ idx, rawMenuName }] } — boxes stay ON-DEVICE
 *     - imagePath: required. upload-url→PUT→complete 가 검증한 오브젝트 경로
 *       (P-003 실연동). 업로드 실패 시 '' = 텍스트-only (BE 허용 확정 7/16)
 *   res: BaseResponse<{ degraded, results: [{ idx, matched, foodId,
 *        riskLevel, name, koreanName, price }] }>
 *     - results may be SHORTER than the request: non-food lines (원산지·가격·
 *       UI 문구) are excluded by the server
 *     - idx is nullable now: 사진에서 추출됐지만 대응 OCR 항목이 없으면 null
 *     - price: 메뉴판 표기 가격(원 단위 정수, 서버가 축약 복원). 미표기 = null.
 *       응답 전용 — 표시할 때 포맷팅만, 환율·추정 금지
 *     - matched=false ⇒ 조사 대기: riskLevel is always UNKNOWN, and foodId may
 *       still be present — branch on `matched`, never on foodId (Swagger 명시)
 *     - degraded=true ⇒ 정제(LLM) 실패/부재: non-food may leak into results,
 *       all UNMATCHED
 *
 *   POST /api/v1/images/complete — 업로드 완료 신고(멱등). 서버가 실제 이미지
 *   검증 후 { path } 반환 — 이 path 를 ScanRequest.imagePath 로 쓴다.
 */

/** BE generic envelope — canonical definition lives in the shared client (KB-66). */
export type { BaseResponse } from './client';

export type BeRiskLevel = 'SAFE' | 'CAUTION' | 'DANGER' | 'UNKNOWN';

/** Normalized 0..1 box — kept on-device for the overlay (NOT sent since 2026-07-10). */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScanReqItem {
  idx: number; // client-assigned, unique within one request
  rawMenuName: string; // OCR text, RAW (server does the cleanup + matching)
}

export interface ScanRequest {
  /** 검증된 오브젝트 경로 (required). '' = 텍스트-only 폴백 (BE 허용 확정 7/16). */
  imagePath: string;
  items: ScanReqItem[];
}

/** P-153(스캔 v2): 미등록 메뉴의 유사 등록 음식 제안 — X-API-Version 2026.08.07 응답 한정. */
export interface SimilarFoodWire {
  foodId: number;
  name?: string | null;
  koreanName?: string | null;
  description?: string | null;
  imageRef?: string | null;
}

/** P-219 v2: 메뉴별 회피 성분 겹침. `overlapped=true`만 표시(전체 81종 나열 금지). */
export interface AvoidanceOverlapWire {
  code: string;
  /** 요청 lang으로 서버가 번역해 준다 — **클라 재번역 금지**. */
  name?: string | null;
  overlapped: boolean;
  riskLevel?: BeRiskLevel | null;
}

export interface ScanResultWire {
  idx?: number | null; // null = 사진에서만 추출(대응 OCR 항목 없음 — 그릴 박스 없음)
  matched: boolean; // false = 조사 대기 (riskLevel UNKNOWN, no detail screen)
  foodId?: number | null; // present even for some unmatched items — do NOT branch on it
  riskLevel: BeRiskLevel;
  name?: string | null; // display name (ko for now; localizes once auth lands)
  koreanName?: string | null;
  price?: number | null; // 메뉴판 표기 가격(KRW 정수), 미표기 = null — 응답 전용
  /** P-153 v2: matched=false 항목의 유사 음식 폴백(v1 응답엔 부재). */
  similarFood?: SimilarFoodWire | null;
  /** P-219 v2: null = 온보딩 미완료 회원 · [] = 기피 미등록 or matched=false. */
  avoidances?: AvoidanceOverlapWire[] | null;
}

/** POST /images/upload-url — presigned 발급 (req/res, 2026-07-16 배포). */
export interface UploadUrlRequest {
  purpose: string; // 업로드 용도 (예: "MENU_SCAN")
  contentType: string;
  contentLength: number; // 정확한 바이트 수 — 불일치 시 스토리지 거절
}

export interface UploadUrlPayload {
  uploadUrl: string;
  method: string; // PUT
  requiredHeaders: Record<string, string>; // 그대로 실어야 함
  publicUrl: string; // 만료 없는 표시용
  objectKey: string; // → complete 의 path
  expiresAt: string;
}

/** POST /images/complete — 업로드 완료 신고 (req/res). */
export interface ImageCompleteRequest {
  path: string; // 발급 시 받은 객체 키 그대로
  contentType: string;
  size: number; // bytes
}

export interface ImageCompletePayload {
  path: string; // 검증된 경로 — ScanRequest.imagePath 로 그대로 사용
}

export interface ScanPayload {
  degraded: boolean;
  results: ScanResultWire[];
  /** P-219 v2: 서버 환율 스냅샷 — 채택은 v2 전면 전환 후 별도(P-218 주석 참조). */
  currency?: { code: string; krwPerUnit: number } | null;
}
