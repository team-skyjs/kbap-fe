/**
 * analytics.ts — Amplitude 계측 어댑터 (P-083/KB-265). 화면 코드는 `track()`
 * 하나만 호출한다 — SDK 교체·키 주입·스키마 변경 전부 이 파일에서.
 *
 * ── 1차 이벤트 스키마 (이 표가 정본 — 커뮤니티 등 이벤트 추가는 여기만) ──
 * | event                    | props (허용 키 — 그 외는 어댑터가 드롭)        |
 * |--------------------------|--------------------------------------------|
 * | onboarding_step_view     | step (consent…summary 스텝 키)              |
 * | onboarding_step_complete | step                                       |
 * | onboarding_step_skip     | step                                       |
 * | onboarding_submit        | avoid_count(개수만 — 재료 내용 금지),        |
 * |                          | avoid_skipped, spice_skipped               |
 * | scan_complete            | degraded(성공/정제실패 구분), item_count     |
 * | food_detail_view         | source (scan|list|search|home|other)       |
 * | review_submit            | (props 없음)                                |
 * | login_success            | provider (APPLE|GOOGLE)                    |
 * | guest_enter              | (props 없음)                                |
 *
 * PII 금지: 닉네임·이메일·국적·회피 재료 내용 미전송 — **익명 device id만**
 * (setUserId·Identify 호출 없음). 허용 키 밖 prop은 드롭(유닛 잠금).
 *
 * 키: `EXPO_PUBLIC_AMPLITUDE_API_KEY`(.env) — 없으면 **no-op**(콘솔 debug만),
 * 키 주입 시 코드 변경 0. ⚠️ Amplitude 웹 위저드 지시 무시(발주 명시):
 * `@amplitude/unified` 설치 금지(브라우저 SDK), autocapture·sessionReplay
 * 금지(웹 DOM 전제 + 알러지 앱 프라이버시) — 이 명시적 이벤트가 정본.
 */

export const EVENTS = {
  onboarding_step_view: 'onboarding_step_view',
  onboarding_step_complete: 'onboarding_step_complete',
  onboarding_step_skip: 'onboarding_step_skip',
  onboarding_submit: 'onboarding_submit',
  scan_complete: 'scan_complete',
  food_detail_view: 'food_detail_view',
  review_submit: 'review_submit',
  login_success: 'login_success',
  guest_enter: 'guest_enter',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** 이벤트별 허용 prop 키 — 표와 1:1. 밖의 키는 전송 전 드롭(PII 방어선). */
const ALLOWED: Record<EventName, readonly string[]> = {
  onboarding_step_view: ['step'],
  onboarding_step_complete: ['step'],
  onboarding_step_skip: ['step'],
  onboarding_submit: ['avoid_count', 'avoid_skipped', 'spice_skipped'],
  scan_complete: ['degraded', 'item_count'],
  food_detail_view: ['source'],
  review_submit: [],
  login_success: ['provider'],
  guest_enter: [],
};

const KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;

let initialized = false;

function ensureInit(): boolean {
  if (!KEY) return false;
  if (!initialized) {
    // lazy require — 키 없는 환경(웹 개발·유닛)에서 SDK 로드 자체를 회피
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const amp = require('@amplitude/analytics-react-native') as typeof import('@amplitude/analytics-react-native');
    amp.init(KEY); // userId 미전달 — 익명 device id만
    initialized = true;
  }
  return true;
}

/** 허용 키만 통과 — 스키마 밖 prop(실수로 섞인 PII 포함)은 여기서 소멸. */
export function sanitize(event: EventName, props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const allowed = ALLOWED[event];
  return Object.fromEntries(Object.entries(props).filter(([k]) => allowed.includes(k)));
}

export function track(event: EventName, props?: Record<string, unknown>): void {
  const clean = sanitize(event, props);
  if (!ensureInit()) {
    if (__DEV__) console.log('[analytics:noop]', event, clean ?? {});
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const amp = require('@amplitude/analytics-react-native') as typeof import('@amplitude/analytics-react-native');
  amp.track(event, clean);
}
