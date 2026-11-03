/**
 * otaPolicy (KB-420/P-204) — OTA 자동 적용의 **순수 판정** 한 곳.
 *
 * KB-978: 채널 무관 한 정책(아래 OTA_LAUNCH_TIMEOUT_MS 주석).
 * - 제외 화면(BLOCKED) = 진행 중 작업이 끊기면 유실이 생기는 화면 — 복귀 reload 보류(deferred).
 */
export const OTA_CHECK_THROTTLE_MS = 120_000; // 포그라운드 복귀 체크 스로틀 ≥2분


/** 진행 중 작업 화면(명시 제외) — 스캔 전 과정(+주문 카드 /scan-order 포함)·
 *  온보딩·프로필 하위 전체·리뷰 작성/수정.
 *  Codex #18: /profile 하위는 **탭 루트만 허용**(SAFE_ROUTES '/profile' — 접두
 *  불일치), 그 외 /profile/*(edit·diet·restrictions 등)는 전부 편집/작업 화면
 *  간주 — 회피 재료 입력 등 안전 데이터 유실 방지(비저장 화면도 막히지만 무해). */
const BLOCKED_ROUTE_RE: readonly RegExp[] = [
  /^\/scan/, // /scan(카메라·결과) + /scan-order(주문 카드) 접두 일치
  /^\/onboarding/,
  /^\/profile\//, // 하위 전체 — 탭 루트 '/profile'은 슬래시 없음 = 비차단
  /\/review$/, // food/[id]/review 작성/수정 — /reviews(목록)는 제외 아님
  // #109 5R: 네이티브 프라미스(소셜 로그인·촬영·위치)가 뜨는 화면 — 화면 단위 봉쇄
  /^\/login/,
  /^\/auth/,
  /^\/community\/compose/,
  // #109 6R: 루트 레벨 작업 화면 전수(src/app/*.tsx 1회 스윕) — 정책: 작업(입력·
  // 진행 유실) 화면 = 차단 / 목록·상세 = 허용. scan-order는 /^\/scan/ 접두로 기포함.
  // notifications(멱등 토글·입력 상태 없음)·states(데모)는 허용 유지.
  /^\/delete-account/, // 탈퇴 확정·Apple 재인증(루트 라우트 — /profile/ 접두 불일치)
  /^\/search/, // 검색 입력 중 유실 방지
];

export function isBlockedRoute(pathname: string): boolean {
  return BLOCKED_ROUTE_RE.some((re) => re.test(pathname));
}

/** KB-978(P-593, 예진 11/04 — P-316 변경): 운영·비운영 같은 로직.
 *  - 시작: 앱 트리 마운트 **전**(스플래시 유지) 체크→fetch, 상한 3초. 받으면 바로 reload —
 *    트리가 없어 진행 중 요청 0(P-347 창 없음). 넘거나 에러 = 현재 번들로 진행(받은 건 다음 복귀/콜드 스타트).
 *  - 복귀: active 전환 순간부터 3초 창 안에서만 reload(작업 화면 차단·네트워크 정적 게이트 통과 시).
 *    창이 닫히면 deferred — 사용 중 화면에서 갑자기 reload 금지.
 *  옛 부팅 8초 가드(P-304: expo-modules-core 56 AppContext 레이스)는 57.0.0 수정 + 시작 판정 대체로 소멸. */
export const OTA_LAUNCH_TIMEOUT_MS = 3_000;
export const OTA_RESUME_WINDOW_MS = 3_000;

/** P-347(KB-509, Sentry REACT-NATIVE-8): **네트워크 정적 창** — reloadAsync로 런타임이
 *  해제되는 중 진행 중 fetch의 reject가 죽은 런타임에 스케줄되며 EXC_BAD_ACCESS
 *  (9/9 iOS b29 부팅 +8.0s — 부팅 가드는 나이만 보고 네트워크 진행을 안 봄).
 *  useIsFetching·useIsMutating 둘 다 0이 이 시간 연속 유지될 때만 networkIdle. */
export const OTA_NETWORK_IDLE_MS = 500;

export function canReloadNow(opts: { appState: string; networkIdle: boolean }): boolean {
  return opts.appState === 'active' && opts.networkIdle;
}
