/**
 * flags.ts — feature flags for MVP scope switches. Flip a flag to restore the
 * UI; the code behind each flag is intentionally NOT deleted.
 */
export const FLAGS = {
  /**
   * Category browsing UI: home "Browse by category" section + food-tab
   * category chips. Excluded from MVP (KB-108, 2026-07-08 회의) — the list
   * contract has no category param yet. Set true to bring both back.
   */
  categoryUI: false,
  /**
   * Onboarding "dishes you've tried" (recommendation seed) step. Excluded
   * from MVP (KB-110 / FR-005) — set true to restore the step in v2.
   */
  onboardingTriedDishes: false,
  /**
   * 게스트(비회원) 조회 모드 — 2026-07-13 회의 확정, MVP 기본 ON.
   * OFF = 로그인 필수 동작(QA용 안전장치). KB-77/78/84.
   */
  guestMode: true,
  /**
   * 리뷰 기능 — 부활 (P-077/KB-16, 2026-07-28 주간 계획; 제외 이력 KB-148).
   * P-085(KB-73): 실 API 연결 완료 → P-086: 실연결은 아래 reviewsLiveEnabled로 봉인.
   */
  reviewsEnabled: true,
  /**
   * 리뷰 **실 API** 연결 (P-085 구현 · P-086 봉인) — off = P-077 목 경로(화면 무변).
   * 봉인 이유(7/30 종한): ① BE 리뷰 엔드포인트 변경 예고 ② prod 미배포 — 실연결이
   * OTA로 나가면 라이브 리뷰 화면이 깨짐. BE 확정 후 계약 diff → 어댑터 보정 →
   * true 복원 (별도 발주).
   */
  reviewsLiveEnabled: false,
  /**
   * 리뷰 번역 버튼 — 리뷰 번역이 BE 계약에 아직 없음 (P-085 지시 7, 종한 질의 중).
   * 기제작 코드(useReviewTranslation)는 보존 — 계약 배포 시 true로 복원.
   */
  reviewTranslationEnabled: false,
} as const;
