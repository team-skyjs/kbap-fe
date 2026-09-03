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

/** P-114: 채널 판별 단일 소스 — 함수형 export(값 아님), jest 목 주입 가능하게.
 *  (spiceAdapter 송신 분기는 KB-389 2차로 소멸 — 송신 계약 소비자 없음. 잔존
 *  소비 = sentry 환경 라벨·scanV2/온보딩 1.1 등 버전 게이트.) */
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
   * 리뷰 기능 — 부활 (P-077/KB-16; 제외 이력 KB-148). P-110(KB-280) prod 숨김
   * (당시 미완 기능 비노출) → **KB-403 전 채널 공개**(8/31 예진 확정 — 기능 완성).
   * 발행은 b20/vc15 심사 승인 후 별도(전략 A — PR 선행·발행 대기).
   */
  reviewsEnabled: true,
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
   * 스캔 v2(X-API-Version 2.0 — 서버 OCR·판정, P-153 → P-155 일시 off).
   * **P-219(8/17): 재활성화** — 보류 사유였던 확인 3종이 dev 스웨거 실측으로
   * 해소(currency 필수 확정 · similarFood 스키마 정의 · SCAN-003/002 분리).
   * **KB-418: 채널 게이트 소멸** — prod 서버 신계약 통일(KB-389)로 전 채널 v2.
   * 문제 시 이 한 줄 false로 즉시 롤백(온디바이스 OCR 코드는 삭제하지 않고
   * 경로 분기로 보존 — 단 v1 서버 계약 유지 여부는 롤백 시점 재확인).
   */
  scanV2: true,
  /**
   * 홈 "You avoid n things" 칸 (P-171, 8/11 예진) — 홈에서 불필요 판정.
   * 컴포넌트·코드 보존(타 화면 재활용 대비) — true 한 줄로 복원.
   */
  homeAvoidBanner: false,
  /**
   * 커뮤니티 "글" 기능(피드·작성·댓글) — P-179: 탭을 전역 리뷰 피드로 전환하며
   * 보존형 숨김(코드 무삭제 — 홈 배너·scanV2 킬스위치 문법). true 한 줄 복원.
   */
  communityPostsEnabled: false,
  /**
   * 홈 전 콘텐츠 노출 (P-216/KB-310, 멘토 #9·12·37) — **디자이너 캡쳐용 러프**,
   * dev 계열만. 음식 탐색·리뷰 피드·인기 검색·저장 목록 섹션을 홈에 얹는다
   * (전부 기존 컴포넌트 재사용). 디자인 확정 후 채널 조건 재검토.
   */
  homeAllContent: !PROD_CHANNEL,
  /**
   * 알림함 (P-216/KB-39, 멘토링 8/15) — **러프**, dev 계열만. 목록 데이터는
   * 로컬 목(notifications/inbox.ts) — BE 알림 목록 계약 오면 그 파일 한 곳 스왑.
   */
  notificationCenter: !PROD_CHANNEL,
  /**
   * 식이/종교 프리셋 온보딩 스텝 (P-203/KB-305) — 디자이너 시안용 러프, dev 계열만.
   * BE diet-presets API 확정 시 dietPresets.ts 상수 스왑.
   */
  dietPresetsEnabled: !PROD_CHANNEL,
  /**
   * 리뷰 확장 별점 3축 (P-202/KB-32) — 디자이너 시안용 러프, dev 계열만.
   * BE 계약(3필드) 회신 시 buildReviewExtras 배선 + 채널 조건 재검토.
   */
  reviewExtrasEnabled: true, // P-236 도입 → KB-403 전 채널 공개(8/31 예진 확정 — 리뷰 본체와 동시)
  /**
   * 리뷰 장소 태그 실연결 (P-201/KB-249) — **dev 계열만**(prod 서버에 place 계약
   * 미배포). 고정 좌표(강남역) 기반 — P-200에서 expo-location 실위치 스왑 예정.
   * prod 배포 신호 오면 채널 조건 해제.
   */
  reviewPlaceEnabled: true, // P-201 dev 한정 → KB-403 전 채널 공개(prod places 라우트 존재 실측 8/31)
  /**
   * 푸시 알림 클라이언트 (P-192/KB-39) — P-221 dev 계열 → **P-268(KB-378) 전 채널
   * 개방**. 구 🔴 전역 true 금지 조건("알림 포함 prod 스토어 빌드")은 **8/25 prod
   * 빌드(iOS 19·and vc13 — expo-notifications 포함, app.json:94)로 충족**.
   * 리뷰 리마인더 = 로컬 알림(서버·APNs/FCM 인증서 불필요 — 커맨드 센터 실측).
   *
   * ⚠️ 구 스토어 배포판(iOS 1.0.0·and vc9)은 runtimeVersion=fingerprint 정책상
   * 새 fp OTA가 도달하지 않아 구조적으로 안전 — 그래도 방어선 유지:
   * expo-notifications 접근은 전부 lib/push/pushAdapter의 지연 require 경유,
   * 화면/훅 정적 import 금지(pushProdGuard221 유닛 잠금 — 이제 킬스위치 가드).
   */
  pushEnabled: true,
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
