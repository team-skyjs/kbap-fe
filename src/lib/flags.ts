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

/** P-114: 채널 판별 단일 소스 — 플래그 외 소비자(spiceAdapter 송신 분기)용.
 *  함수형 export(값 아님) — jest에서 목 주입 가능하게. */
export function isProdChannel(): boolean {
  return PROD_CHANNEL;
}

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
   * 리뷰 장소 태그 (P-116, 8/4 회의) — 장소 검색 BE(KB-274)가 카카오 월렛
   * 블록으로 미배포 → 이번 릴리스 전면 숨김(전 채널). 배포 시 true 한 줄 복원.
   * 커뮤니티 작성의 장소 행은 이 플래그 무관(coming-soon으로 미출시 — 별도).
   */
  placeTagsEnabled: false,
  /**
   * 리뷰 번역 버튼 — 리뷰 번역이 BE 계약에 아직 없음 (P-085 지시 7, 종한 질의 중).
   * 기제작 코드(useReviewTranslation)는 보존 — 계약 배포 시 true로 복원.
   */
  reviewTranslationEnabled: false,
  /**
   * 시스템 카메라 경로 (P-137, 8/6 예진 A/B) — true면 스캔 탭 = 런처 화면 +
   * launchCameraAsync(네이티브 줌·가로·플래시). false = 현행 커스텀 인앱 카메라.
   * 비교 확정 전 — 커스텀 코드 삭제 금지.
   */
  systemCamera: false,
  /**
   * 커뮤니티 글/댓글 리액션 토글 (P-142) — 계약에 토글 API 부재(응답에
   * likeCount·dislikeCount만, 댓글은 카운트도 없음) → off = 카운트 표시만.
   * BE 리액션 API 배포 시 true + adapter 배선.
   */
  communityReactionsEnabled: false,
  /**
   * 커뮤니티 글/댓글 신고 (P-142) — /reports targetType enum이 REVIEW뿐
   * (스웨거 8/10 실확인) → off = 신고 메뉴 미노출(리뷰 신고는 무관·유지).
   * BE enum 확장 시 true + adapter 배선.
   */
  communityReportEnabled: false,
  /**
   * 스캔 v2(X-API-Version 서버 OCR, P-153) — **P-155 일시 off**: BE v2 내부
   * 로직 미완성(종한 8/11 확인, dev가 반쪽 파이프라인). 완성 신호 오면 true
   * 한 줄 복귀 — 채널 분기(prod 제외)는 scanV2Enabled()에 보존.
   */
  scanV2: false,
  /**
   * 커뮤니티 상세 번역 토글 (P-142) — lang이 하드 필수(누락 400)라 "원문"
   * 조회 수단이 계약에 없음(응답도 단일 content) → off = 토글 미노출, 본문은
   * 항상 lang=리더 언어 응답. 원문 규약(sourceLang·원문 필드 등) 배포 시 재개.
   */
  communityTranslateEnabled: false,
} as const;

/** P-137 변형: systemCamera on일 때 탭 진입 즉시 카메라 자동 실행(취소 시 런처).
 *  false = 런처에서 촬영 버튼 탭. 예진 실기 비교용 상수. */
export const SYSTEM_CAMERA_AUTOLAUNCH = false;
