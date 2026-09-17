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

/** 쿼리 문자열 → entry. 모르는 값 = 'other'(스키마 밖 값이 대시보드에 새는 것 방지), 부재 = 'intro'(직접 진입). */
export function parseLoginEntry(raw: string | string[] | undefined): LoginEntry {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return 'intro';
  return (LOGIN_ENTRIES as readonly string[]).includes(v) ? (v as LoginEntry) : 'other';
}
