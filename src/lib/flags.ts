import teamtestTarget from './teamtest-target.json';

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

/** P-399: **진단 문구를 보여도 되는 채널**만 참. `!isProdChannel()`로 negate하면
 *  `preview`(production 백엔드를 쓰는 내부 배포)까지 포함돼 원시 네이티브 에러 문자열이
 *  샌다(Codex #176) — 그래서 부정이 아니라 **명시 허용**이다.
 *  채널 부재(null·빈 문자열·못 읽음 — 웹·jest·dev client)는 **__DEV__일 때만** 로컬 개발로 포함한다(KB-691).
 *  P-407: `teamtest-prod`(prod 백엔드 리허설 테플 빌드)도 **내부 테스터 전용**이라 teamtest처럼 노출한다.
 *  원칙 — 백엔드는 prod처럼(eas.json env), 진단 노출·OTA 적용 정책은 teamtest처럼. */
function isDiagnosticChannelInner(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ch = (require('expo-updates') as { channel?: string | null }).channel;
    // KB-691: 채널 부재 = null **또는 빈 문자열**(dev client는 네이티브가 ""를 준다 — expo-updates AppController.swift
    // `requestHeaders["expo-channel-name"] ?? ""`). 부재는 **개발 번들(__DEV__)일 때만** 로컬로 본다 — EAS 빌드 프로필은
    // 전부 채널을 박으므로 릴리스에서 부재 = 비정상 → 진단 끔(production·preview로 새는 방향 차단).
    if (ch == null || ch === '') return __DEV__;
    return ch === 'teamtest' || ch === 'teamtest-prod' || ch === 'development';
  } catch {
    return __DEV__; // 채널을 못 읽는 환경 — 개발 번들일 때만 로컬
  }
}
const DIAGNOSTIC_CHANNEL = isDiagnosticChannelInner();

/** KB-870/P-527: development는 dev 기능 유지. teamtest는 명시 target에 따라 제품 게이트를 선택한다.
 *  10/23 사용자 승인: 기존 teamtest 설치본 전체를 prod 리허설로 전환. 채널/진단/광고 정책은 무변.
 *  진단 채널과 다르다: teamtest-prod는 진단은 보이지만 백엔드가 prod라 dev 서버에서만 켜진 기능(서버 플래그)은 거기서 막다른 길이다.
 *  채널 부재는 진단과 같은 규칙(__DEV__일 때만 로컬). */
function isDevServerChannelInner(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ch = (require('expo-updates') as { channel?: string | null }).channel;
    if (ch == null || ch === '') return __DEV__;
    if (ch === 'teamtest') return teamtestTarget.backend === 'dev';
    return ch === 'development';
  } catch {
    return __DEV__;
  }
}
const DEV_SERVER_CHANNEL = isDevServerChannelInner();

/** 채널 판별 단일 소스(P-114) — 함수형 export로 jest 목 주입 가능. */
export function isDiagnosticChannel(): boolean {
  return DIAGNOSTIC_CHANNEL;
}

/** KB-870: 개발 기능 허용 채널 — teamtest는 공유 target 정본을 따른다. API 헤더와 표면에 같은 게이트 사용. */
export function isDevServerChannel(): boolean {
  return DEV_SERVER_CHANNEL;
}

export const FLAGS = {
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
  communityEnabled: true, // P-289(예진 9/7): prod=dev 동일 — Reviews 탭 전 채널 공개(b24)
  /**
   * 리뷰 **실 API** 연결 (P-085 구현 · P-086 봉인 · P-108 해제 8/3) — off = P-077
   * 목 경로(화면 무변). 종한 계약 확정(8/3 스냅샷)으로 봉인 해제: 목록·CRUD·
   * 좋아요·신고(리뷰만)·차단까지 이 플래그가 스위칭. 문제 시 false로 재봉인.
   */
  reviewsLiveEnabled: true,
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
   * 커뮤니티 "글" 기능(피드·작성·댓글) — P-179: 탭을 전역 리뷰 피드로 전환하며
   * 보존형 숨김(코드 무삭제 — 홈 배너·scanV2 킬스위치 문법). true 한 줄 복원.
   */
  communityPostsEnabled: false,
  /**
   * 알림함 (P-216/KB-39, 멘토링 8/15). 목록·배지 = 서버 `GET /api/notifications`
   * (KB-499, lib/data/useNotifications — 기기 단위·7일·미읽음 파생). 로컬 기록 없음.
   */
  notificationCenter: true, // P-289(예진 9/7): 알림함 전 채널(실알림 전용 — inbox 목 소멸)
  /**
   * 식이/종교 프리셋 온보딩 스텝 (P-203/KB-305) — 디자이너 시안용 러프, dev 계열만.
   * BE diet-presets API 확정 시 dietPresets.ts 상수 스왑.
   */
  dietPresetsEnabled: true, // P-289(예진 9/7): 온보딩 식단·종교 프리셋 전 채널
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
   * 푸시 알림 클라이언트 (P-192/KB-39) — P-221 dev 계열 → P-268 전 채널 개방 →
   * **KB-422(9/5 예진): v1.0.1 스토어는 prod 재숨김**. 실푸시 미구현 상태
   * (토큰 등록 no-op·서버 알림 API 없음 = 로컬 목)라 OS 권한 거부와 무관하게
   * 설정 토글이 ON으로 보이는 등 미완성 노출 = 심사 리스크. 실푸시 도입
   * (KB-423, 종한) 시 true 복원 + OS 권한 연동 토글.
   * teamtest/dev 무변. 방어선 유지: expo-notifications 접근은 전부
   * lib/push/pushAdapter의 지연 require 경유, 화면/훅 정적 import 금지
   * (pushProdGuard221 유닛 잠금).
   */
  pushEnabled: true, // P-289(예진 9/7): 권한 팝업·설정·리마인더 전 채널(KB-422 재숨김 사유 소멸)
  /**
   * KB-739(에픽 KB-737, 10/12 예진): AdMob — 전부 true, 채널 무관. 단위 ID는 lib/ads/units.ts가 production 채널만 실값,
   * 그 외 Google 데모 고정. off·미수신·초기화 전이면 자리는 **높이 0으로 접힘**(빈 칸·스켈레톤 금지). 스토어 빌드 플래그
   * 감사표에 광고 항목(발주 완료 절). 형식별 off는 해당 자리만 접힌다(enabled=false면 SDK 로드 자체를 안 한다).
   */
  ads: { enabled: true, banner: true, interstitial: true, native: true, rewarded: true },
  /**
   * 커뮤니티 상세 번역 토글 (P-142) — lang이 하드 필수(누락 400)라 "원문"
   * 조회 수단이 계약에 없음(응답도 단일 content) → off = 토글 미노출, 본문은
   * 항상 lang=리더 언어 응답. 원문 규약(sourceLang·원문 필드 등) 배포 시 재개.
   */
  communityTranslateEnabled: false,
  /**
   * 홈 카운트다운 뱃지(불꽃 — 무료 스캔 N회 남음) (P-432/KB-680) — **10/13 production 활성(KB-763, 예진 승인)**: 전제였던
   * prod 서버 보상형 API(KB-740)는 release 26.10.2로 배포됨. 이전엔 시안 D-21 확정 전이라 진단 채널만(DIAGNOSTIC_CHANNEL).
   * 채널 무관 true — 문제 시 이 한 줄을 DIAGNOSTIC_CHANNEL로 되돌리면 production·preview에서만 사라진다.
   */
  countdownBadge: true,
  /**
   * 리뷰 본문 번역 버튼 (P-431/KB-679) — 서버 KB-678(`POST /api/translations`).
   * 10/14 전 채널(예진), prod 라우트 실측: prod·dev 둘 다 빈 body에 400(없는 경로는 404 = 라우트 존재), 서버 main에 #362~#364 포함.
   * 이전엔 진단 채널만(Codex #220 P1 — 배포 전 깨진 버튼 금지). 문제 시 이 한 줄을 DIAGNOSTIC_CHANNEL로 되돌리면 production·preview에서만 사라진다.
   * off = 본문만(버튼 없음), 원문 렌더 무변.
   */
  contentTranslation: true,
  /**
   * P-508(KB-813 후속): 성분표 촬영·분석(서버 #442 `scan/label`) — 핸드오프 촬영 버튼·상세 "성분표 직접 확인"·결과 화면.
   * **채널 게이트 의도(AGENTS.md 4항, 발주 P-508)**: development·teamtest(dev 서버 — #442 배포됨)만. teamtest-prod·production·preview는
   * 운영 서버에 #442가 나간 뒤 이 줄을 true로(그 전엔 버튼이 404를 받는다). 꺼진 채널 = 핸드오프에 "곧 지원" 안내 + 비활성 버튼(기존).
   */
  packagedLabelScan: DEV_SERVER_CHANNEL,
  /**
   * KB-812 2차(P-507): 가공식품 상세 "리뷰 쓰기" 버튼. **채널 게이트 의도(AGENTS.md 4항, 커맨드 확인 10/21)**:
   * 서버 PROCESSED_FOOD_REVIEW_WRITE_ENABLED가 켜진 채널만 — 지금은 dev 서버(#437)뿐이라 development·teamtest만.
   * teamtest-prod·production·preview(운영 서버, 플래그 OFF)는 숨김 — 막다른 "곧 열려요" 버튼 방지. prod 서버 ON 뒤 이 줄을 true로 확장.
   * (그 사이 서버가 꺼져 있으면 작성 화면이 403 PFOOD-005를 "곧 열려요" 안내로 받는다 — 차단 아님.) 리뷰 **읽기**·기존 리뷰 수정은 이 플래그와 무관.
   */
  packagedReviewWrite: DEV_SERVER_CHANNEL,
  /**
   * KB-870/P-528 OTA2 채널 게이트 의도: 사용자 검수·공개 승인으로 큐레이션·K-pop·회피6만 전 채널 공개.
   * 운영 큐레이션 게시/GET·idol GET·회피 catalog/profile PATCH 왕복 확인 뒤 develop 머지/발행한다.
   * PF3종과 리뷰 버전은 DEV_SERVER_CHANNEL에 유지한다. 공용 dev 게이트를 켜지 않는다.
   */
  curationEnabled: true,
  processedFoodEnabled: DEV_SERVER_CHANNEL,
  idolPicksEnabled: true,
  avoidGroupCodesEnabled: true,
} as const;

/** P-137 변형: systemCamera on일 때 탭 진입 즉시 카메라 자동 실행(취소 시 런처).
 *  false = 런처에서 촬영 버튼 탭. 예진 실기 비교용 상수. */
export const SYSTEM_CAMERA_AUTOLAUNCH = false;
