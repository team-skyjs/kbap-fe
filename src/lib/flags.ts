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
   * 리뷰 기능 — MVP 제외 (KB-148, 2026-07-16 회의). 커뮤니티류로 보이지
   * 않도록 UI 전면 숨김: 홈 리뷰 버튼·카드 별점, 상세 평점 카드, 프로필
   * My reviews, 인트로 3번 슬라이드, 랭킹 리뷰 팩터 행, 알림 리뷰 리마인더,
   * 탈퇴 안내 리뷰 문구 + 리뷰 라우트 4종은 홈 redirect. 코드·i18n·훅은
   * 유지 — true로 되돌리면 전부 복원.
   */
  reviewsEnabled: false,
} as const;
