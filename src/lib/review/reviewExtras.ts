/**
 * reviewExtras.ts (P-202/KB-32) — 리뷰 확장 별점 3축(속도·친절·찾아가기) 어댑터.
 *
 * BE 계약(3필드) 요청 중 — **전송은 buildReviewExtras 한 곳에서 격리된 no-op**:
 * 계약 회신(예정 필드명 speedRating·serviceRating·accessRating) 시 이 함수만
 * 배선하면 화면 무변. 그전까지는 **로컬 프리뷰 보관**(메모리 — 본인 작성 직후
 * 셀 축약 표시용, 앱 재시작 시 소실 = 디자이너 시안용 알려진 한계).
 */

export interface ReviewExtras {
  /** 음식 나오는 속도 1~5 (null = 미선택) */
  speed: number | null;
  /** 친절도 1~5 */
  service: number | null;
  /** 찾아가기 1~5 — 장소 태그 있을 때만 노출·태그 해제 시 소거 */
  access: number | null;
}

export const EMPTY_EXTRAS: ReviewExtras = { speed: null, service: null, access: null };

export function hasAnyExtras(e: ReviewExtras): boolean {
  return e.speed != null || e.service != null || e.access != null;
}

/**
 * 전송 페이로드 — **현재 no-op(null 반환 = 전송 필드 0)**. BE 계약 확정 발주에서
 * `{ ...(e.speed != null ? { speedRating: e.speed } : {}), … }` 형태로 이 함수만 배선.
 */
export function buildReviewExtras(_extras: ReviewExtras): Record<string, number> | null {
  return null; // 계약 전 — 전송 0
}

/* ---- 로컬 프리뷰 보관 (메모리 — 내 리뷰는 음식당 1개라 foodId 키로 충분) ---- */
const localExtras = new Map<string, ReviewExtras>();

export function saveLocalExtras(foodId: string, extras: ReviewExtras): void {
  if (hasAnyExtras(extras)) localExtras.set(foodId, extras);
  else localExtras.delete(foodId);
}

export function getLocalExtras(foodId: string): ReviewExtras | null {
  return localExtras.get(foodId) ?? null;
}

/** 유닛용 리셋. */
export function _clearLocalExtrasForTest(): void {
  localExtras.clear();
}
