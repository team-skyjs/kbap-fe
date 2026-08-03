/**
 * flags.ts — feature flags for MVP scope switches. Flip a flag to restore the
 * UI; the code behind each flag is intentionally NOT deleted.
 */
/** P-110(KB-280): 빌드 채널 감지 — production 채널 = 스토어 유저. 웹/jest/dev
 *  런처는 채널 부재 → 노출(개발 편의). OTA에도 채널은 불변이라 안전. */
function isProductionChannel(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-updates') as { channel?: string | null }).channel === 'production';
  } catch {
    return false;
  }
}
const PROD_CHANNEL = isProductionChannel();

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
   * 리뷰 기능 — 부활 (P-077/KB-16; 제외 이력 KB-148). P-110(KB-280): **production
   * 채널에선 숨김**(1.0.1 스토어 배포 — 미완 기능 비노출, teamtest·dev는 노출).
   */
  reviewsEnabled: !PROD_CHANNEL,
  /**
   * 커뮤니티 탭/화면 (P-087 목 선작업) — P-110: production 채널 숨김(탭바·설정
   * 차단 목록 행·화면 가드). teamtest·dev만 노출.
   */
  communityEnabled: !PROD_CHANNEL,
  /**
   * 리뷰 **실 API** 연결 (P-085 구현 · P-086 봉인 · P-108 해제 8/3) — off = P-077
   * 목 경로(화면 무변). 종한 계약 확정(8/3 스냅샷)으로 봉인 해제: 목록·CRUD·
   * 좋아요·신고(리뷰만)·차단까지 이 플래그가 스위칭. 문제 시 false로 재봉인.
   */
  reviewsLiveEnabled: true,
  /**
   * 리뷰 번역 버튼 — 리뷰 번역이 BE 계약에 아직 없음 (P-085 지시 7, 종한 질의 중).
   * 기제작 코드(useReviewTranslation)는 보존 — 계약 배포 시 true로 복원.
   */
  reviewTranslationEnabled: false,
} as const;
