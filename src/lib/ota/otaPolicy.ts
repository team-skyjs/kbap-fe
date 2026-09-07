/**
 * otaPolicy (KB-420/P-204) — OTA 자동 적용의 **순수 판정** 한 곳.
 *
 * 채널별 정책(예진 확정 9/4):
 * - 비-prod(teamtest·dev 계열) = **immediate**: 받자마자 reload(도그푸딩 우선).
 * - production = **safe**: 안전 순간(탭 루트 3종 + 진행 중 뮤테이션 0)에만 자동
 *   reload. 아니면 비차단 배너로 수동 적용 + 라우트/뮤테이션 변화 시 재평가.
 * - 제외 화면(BLOCKED) = 진행 중 작업이 끊기면 유실이 생기는 화면 — 자동 reload는
 *   물론 **배너도 띄우지 않는다**(스캔 카메라 위 오버레이 금지).
 */
export const OTA_CHECK_THROTTLE_MS = 120_000; // 포그라운드 복귀 체크 스로틀 ≥2분

// P-316: SAFE_ROUTES 소멸 — prod = 항상 defer(안전 순간 판정 자체 불요).

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
];

export function isBlockedRoute(pathname: string): boolean {
  return BLOCKED_ROUTE_RE.some((re) => re.test(pathname));
}

/** P-304(KB-458, Sentry REACT-NATIVE-6): **부팅 가드** — 콜드 스타트 직후(b28 실측
 *  3초 시점) reloadAsync가 expo-modules-core 56의 AppContext 해제 레이스로 네이티브
 *  크래시(57.0.0에서 수정 — 미백포트). reload는 ① 부팅 8s 경과 ② 스플래시 종료
 *  ③ 포그라운드(active) 전부 충족 시에만. prod 정책(항상 defer 여부)은 예진 결정 대기. */
export const OTA_BOOT_GUARD_MS = 8_000;

export function canReloadNow(opts: { bootedAt: number; now: number; splashDone: boolean; appState: string }): boolean {
  return opts.now - opts.bootedAt >= OTA_BOOT_GUARD_MS && opts.splashDone && opts.appState === 'active';
}

export type OtaDecision = 'reload' | 'defer';

/** P-316(KB-458 후속, 9/7 예진 a안): prod = **항상 defer** — reload 호출 0·배너 0,
 *  fetch만 해두면 다음 콜드 스타트에 expo-updates가 자동 적용. 비-prod = 즉시(부팅 가드 뒤). */
export function otaApplyDecision(opts: { prod: boolean; pathname: string; mutating: number }): OtaDecision {
  return opts.prod ? 'defer' : 'reload';
}
