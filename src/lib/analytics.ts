/**
 * analytics.ts — Amplitude 계측 어댑터 (P-083/KB-265). 화면 코드는 `track()`
 * 하나만 호출한다 — SDK 교체·키 주입·스키마 변경 전부 이 파일에서.
 *
 * ── 네이밍 규칙 (P-215/KB-316 — 태소노미 CSV와 1:1) ────────────────
 * 이벤트 = `<도메인>_<행동>`. 도메인 =
 *   app · auth · onboarding · scan · order · owner · food · search ·
 *   review · community · profile · push · error
 * user property = `user_info_` 접두 (예: user_info_country).
 * 신규 추가 시 이 규칙을 먼저 적용할 것 — CSV 대조 유닛이 구 이름을 막는다.
 *
 * ── 1차 이벤트 스키마 (이 표가 정본 — 커뮤니티 등 이벤트 추가는 여기만) ──
 * | event                    | props (허용 키 — 그 외는 어댑터가 드롭)        |
 * |--------------------------|--------------------------------------------|
 * | onboarding_step_view     | step (consent…summary 스텝 키)              |
 * | onboarding_step_complete | step                                       |
 * | onboarding_step_skip     | step                                       |
 * | onboarding_submit        | avoid_count(개수만 — 재료 내용 금지),        |
 * |                          | avoid_skipped, spice_skipped               |
 * | scan_complete            | degraded, item_count, success,              |
 * |                          | fail_reason (P-220 5종: not_menu·ocr·      |
 * |                          | upload·network·server)                     |
 * | food_detail_view         | source (scan|list|search|home|other)       |
 * | review_submit            | (props 없음)                                |
 * | auth_login_success            | provider (APPLE|GOOGLE)                    |
 * | auth_guest_enter              | (props 없음)                                |
 * | app_tab_view                 | tab (home|food|community|profile)          |
 * | auth_gate_view           | trigger (게스트 게이트 노출 계기)             |
 *
 * PII 금지: 닉네임·이메일·국적·회피 재료 내용 미전송 — **익명 device id만**
 * (setUserId·Identify 호출 없음). 허용 키 밖 prop은 드롭(유닛 잠금).
 *
 * 키: `EXPO_PUBLIC_AMPLITUDE_API_KEY` — 없으면 **no-op**(콘솔 debug만),
 * 키 주입 시 코드 변경 0. ⚠️ Amplitude 웹 위저드 지시 무시(발주 명시):
 * `@amplitude/unified` 설치 금지(브라우저 SDK), autocapture·sessionReplay
 * 금지(웹 DOM 전제 + 알러지 앱 프라이버시) — 이 명시적 이벤트가 정본.
 *
 * ── 운영 노트 (P-094, 7/31 예진 확정 — A안) ──────────────────────
 * Amplitude 프로젝트는 1개 = **실유저 전용**. 키는 eas.json의
 * production·preview 프로필에만 존재 — dev/Metro(.env)·팀(teamtest)은
 * 키 없음 = no-op으로 트래픽이 섞이지 않는다. 새 이벤트 검증이 필요할
 * 때만 로컬 .env에 키를 **일시 주입**해 확인 후 **반드시 제거**(커밋 금지).
 */

export const EVENTS = {
  onboarding_step_view: 'onboarding_step_view',
  onboarding_step_complete: 'onboarding_step_complete',
  onboarding_step_skip: 'onboarding_step_skip',
  onboarding_submit: 'onboarding_submit',
  scan_complete: 'scan_complete',
  food_detail_view: 'food_detail_view',
  review_submit: 'review_submit',
  auth_login_success: 'auth_login_success',
  auth_guest_enter: 'auth_guest_enter',
  // P-144(KB-316, 멘토 #39) — amplitude-taxonomy.csv 전사 (임의 개명 금지)
  app_opened: 'app_opened',
  scan_start: 'scan_start',
  scan_result_item_tap: 'scan_result_item_tap',
  order_card_open: 'order_card_open',
  search_query: 'search_query',
  review_write_tap: 'review_write_tap',
  food_bookmark_toggle: 'food_bookmark_toggle',
  // P-213(KB-316, 태소노미 공백 보완 8/15) — CSV 등재 예정
  app_tab_view: 'app_tab_view',
  auth_gate_view: 'auth_gate_view',
  // P-214(KB-316, 전수 조사 8/15) — 스캔 퍼널·공용 지점·푸시·공급측. CSV 등재 예정
  scan_item_add: 'scan_item_add',
  scan_item_remove: 'scan_item_remove',
  order_done: 'order_done',
  owner_ask_open: 'owner_ask_open',
  scan_permission: 'scan_permission',
  error_state_view: 'error_state_view',
  review_helpful_toggle: 'review_helpful_toggle',
  review_translate_toggle: 'review_translate_toggle',
  push_primer_response: 'push_primer_response',
  push_pref_toggle: 'push_pref_toggle',
  profile_avoid_update: 'profile_avoid_update',
  community_post_submit: 'community_post_submit',
  community_comment_submit: 'community_comment_submit',
  auth_account_delete: 'auth_account_delete',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** 이벤트별 허용 prop 키 — CSV와 1:1. 밖의 키는 전송 전 드롭(PII 방어선). */
const ALLOWED: Record<EventName, readonly string[]> = {
  onboarding_step_view: ['step'],
  onboarding_step_complete: ['step'],
  onboarding_step_skip: ['step'],
  onboarding_submit: ['avoid_count', 'avoid_skipped', 'spice_skipped'],
  // P-220: fail_reason 값 = not_menu|ocr|upload|network|server (매핑은 scanErrors.ts).
  // ⚠️ not_menu(사용자 촬영 문제)와 ocr(우리 인식 실패)은 개선 투자처가 반대라 분리.
  scan_complete: ['degraded', 'item_count', 'success', 'fail_reason'], // P-144 확장
  food_detail_view: ['source', 'food_id'], // P-144: food_id 추가(카탈로그 id — PII 아님)
  review_submit: ['has_photos', 'photo_count', 'rating'], // P-144 확장
  auth_login_success: ['provider'],
  auth_guest_enter: [],
  app_opened: [],
  scan_start: ['source'],
  scan_result_item_tap: ['risk'],
  order_card_open: ['item_count', 'has_avoids'],
  // P-214 🔒: keyword = **카탈로그 매칭 시에만**(호출처 searchKeywordProps가 판정) —
  // 자유 텍스트는 matched:false + len_bucket만(알레르기·신념 추론 차단)
  search_query: ['keyword', 'result_count', 'matched', 'len_bucket'],
  review_write_tap: ['source'],
  food_bookmark_toggle: ['on'],
  app_tab_view: ['tab'], // home|food|community|profile
  auth_gate_view: ['trigger'], // bookmark|review|scan|community|risk|profile
  // P-214 — ⛔ 전송 금지(발주 고정): 장소명·주소·좌표 / 신고 note / 대상 memberId·닉네임 /
  // 본문·사진 URI / 프리셋 항목명. 아래 키 밖은 어댑터가 드롭(화이트리스트가 방어선).
  scan_item_add: ['risk'],
  scan_item_remove: ['risk'],
  order_done: ['item_count'],
  owner_ask_open: ['source', 'food_id'], // cta|ingredient|unregistered
  scan_permission: ['state'], // view|grant|deny|settings_open
  error_state_view: ['screen', 'kind', 'action'], // kind: error|offline|empty · action: view|retry
  review_helpful_toggle: ['on', 'surface'],
  review_translate_toggle: ['action', 'target'], // action: translate|original · target: review|post
  push_primer_response: ['action', 'surface'], // accept|later · onboarding|scan
  push_pref_toggle: ['key', 'on'],
  profile_avoid_update: ['count', 'delta', 'via'], // via: manual|preset (항목명 금지 — 개수만)
  community_post_submit: ['photo_count', 'food_tag_count', 'has_place'], // 장소명 금지 — boolean만
  community_comment_submit: ['is_reply'],
  auth_account_delete: [],
};

/** P-144 user property 허용 키 — CSV와 1:1. country는 alpha-2 코드(멘토 확정
 *  정본 — KB-265 통과 기준 = 닉네임·이메일·재료명 미전송, 개수·enum·코드는 허용).
 *  currency는 ⑪ 도입 후(이번 범위 아님). ip_country는 SDK 자동. */
const ALLOWED_USER_PROPS = ['user_info_country', 'user_info_lang', 'user_info_os', 'user_info_os_version', 'user_info_spice_level', 'user_info_avoid_count', 'user_info_is_registered', 'user_info_currency'] as const;
export type UserPropKey = (typeof ALLOWED_USER_PROPS)[number];

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

/** 허용 user property만 통과 — 밖의 키(실수 PII 포함) 드롭. 유닛 잠금용 분리. */
export function sanitizeUserProps(props: Partial<Record<UserPropKey, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).filter(([k, v]) => (ALLOWED_USER_PROPS as readonly string[]).includes(k) && v !== undefined),
  );
}

/** P-144: user property 세팅 — Identify(익명 device id 유지, setUserId 없음). */
export function setUserProps(props: Partial<Record<UserPropKey, string | number | boolean>>): void {
  const clean = sanitizeUserProps(props);
  if (!Object.keys(clean).length) return;
  if (!ensureInit()) {
    if (__DEV__) console.log('[analytics:noop] identify', clean);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const amp = require('@amplitude/analytics-react-native') as typeof import('@amplitude/analytics-react-native');
  const id = new amp.Identify();
  for (const [k, v] of Object.entries(clean)) id.set(k, v as string | number | boolean);
  amp.identify(id);
}
