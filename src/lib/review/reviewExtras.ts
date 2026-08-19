/**
 * reviewExtras.ts (P-202 → P-236/KB-347) — 리뷰 확장 별점 **2축**(속도·친절).
 *
 * 서버 정본(8/19 배포 실측): `servingSpeed`·`staffKindness` 0~5 정수 —
 * **0 = 평가 안 함**(누락 시 0). 작성·수정 요청 동일, 조회 응답(피드·목록·
 * 내 리뷰)에도 포함.
 *
 * P-202의 'Getting there(찾아가기)' 축은 서버 필드가 없어 제거(멘토 "식당
 * 속성 — 지금 신경 안 씀"). 로컬 임시 저장(메모리 프리뷰)도 전면 폐기 —
 * 이제 서버가 정본이라 조회 응답이 표시를 담당한다.
 */

export interface ReviewExtras {
  /** 음식 나오는 속도 1~5 (null = 미평가 → 전송 0) */
  speed: number | null;
  /** 친절도 1~5 */
  service: number | null;
}

export const EMPTY_EXTRAS: ReviewExtras = { speed: null, service: null };

export function hasAnyExtras(e: ReviewExtras): boolean {
  return e.speed != null || e.service != null;
}

/** 전송 페이로드 — 미평가 = 0(서버 규약: 0 = 평가 안 함). */
export function buildReviewExtras(e: ReviewExtras): { servingSpeed: number; staffKindness: number } {
  return { servingSpeed: e.speed ?? 0, staffKindness: e.service ?? 0 };
}

/** 조회 응답 → UI 상태(수정 프리필용). 0 = 미평가 = null. */
export function extrasFromReview(r: { servingSpeed?: number; staffKindness?: number }): ReviewExtras {
  return {
    speed: r.servingSpeed && r.servingSpeed > 0 ? r.servingSpeed : null,
    service: r.staffKindness && r.staffKindness > 0 ? r.staffKindness : null,
  };
}
