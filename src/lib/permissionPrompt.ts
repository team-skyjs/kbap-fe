/**
 * KB-980 — OS 권한 팝업(알림·카메라·사진·위치·ATT) 표면 하나.
 * 떠 있는 동안 + 응답 뒤 PERMISSION_SETTLE_MS 동안 = OTA 복귀 reload 금지(Android는 팝업에서도 background 전이가 생긴다).
 * 권한 요청은 직접 부르지 말고 withPermissionPrompt로 감싼다(permissionPromptLock 테스트가 src 전수 검사).
 */
export const PERMISSION_SETTLE_MS = 5_000;

let open = 0;
let lastEndedAt = Number.NEGATIVE_INFINITY;

export async function withPermissionPrompt<T>(fn: () => Promise<T>): Promise<T> {
  open += 1;
  try {
    return await fn();
  } finally {
    open -= 1;
    lastEndedAt = Date.now();
  }
}

/** 요청 중 0건 + 마지막 응답 뒤 PERMISSION_SETTLE_MS 경과 = true(호출 시점 계산). */
export function permissionPromptSettled(now = Date.now()): boolean {
  return open === 0 && now - lastEndedAt >= PERMISSION_SETTLE_MS;
}

/** 테스트 전용 — 모듈 전역 초기화 */
export function _resetPermissionPromptForTest(): void {
  open = 0;
  lastEndedAt = Number.NEGATIVE_INFINITY;
}
