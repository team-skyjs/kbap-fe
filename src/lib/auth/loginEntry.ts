/**
 * loginEntry (P-389/KB-576) — 가입 유입 경로 값. **순수 모듈**로 떼어 둔 이유는
 * useSocialAuth가 네이티브(Google Signin·Firebase)를 끌고 오기 때문이다 —
 * 계측 스키마 대조 유닛이 네이티브 없이 이 값을 검증할 수 있어야 한다.
 *
 * 값은 amplitude-taxonomy.csv의 auth_login_success.entry 열과 1:1.
 * 게이트 발 경로는 `gate_<trigger>`로, auth_gate_view.trigger와 **같은 축**을 쓴다.
 */
export type LoginEntry =
  | 'intro'
  | 'gate_bookmark'
  | 'gate_review'
  | 'gate_scan'
  | 'gate_community'
  | 'gate_risk'
  | 'gate_profile'
  | 'profile'
  | 'other';

export const LOGIN_ENTRIES: readonly LoginEntry[] = [
  'intro',
  'gate_bookmark',
  'gate_review',
  'gate_scan',
  'gate_community',
  'gate_risk',
  'gate_profile',
  'profile',
  'other',
];

/**
 * 쿼리 문자열 → entry. 스키마 밖 값·**부재 모두 'other'**.
 *
 * ⚠️ 부재를 'intro'로 접지 않는다(Codex #165): `/login`은 첫 진입 말고도 세션 만료·홈
 * 게스트 CTA·알림함 리다이렉트·탈퇴 후 복귀에서 열린다. 부재를 intro로 세면 그 전부가
 * 인트로 가입으로 잡혀 유입 경로가 통째로 오염된다. **intro는 호출측이 명시할 때만.**
 */
export function parseLoginEntry(raw: string | string[] | undefined): LoginEntry {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return 'other';
  return (LOGIN_ENTRIES as readonly string[]).includes(v) ? (v as LoginEntry) : 'other';
}
