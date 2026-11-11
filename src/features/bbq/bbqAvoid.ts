/**
 * KB-1019 장면 1: 이름표 ↔ 회원 회피 재료 연결(기획안 4절, P-631).
 * - 고정 표에 있는 것만 표시한다: 쌈장 = 대두·밀(주의), 고기 = 육류 계열 회피 시 판정 불가(종류를 못 가림).
 * - 표에 없는 것·게스트·회피 미설정 = 표시 없음. **safe는 이 화면에서 절대 내지 않는다**(거짓 안전 0).
 * - 코드는 BE 정본(src/lib/mocks/ingredients.ts INGREDIENTS)에서 확인한 값.
 */
import { ApiError } from '@/lib/api/client';
import type { RiskState } from '@/lib/theme';
import { COOKED_MEAT, RAW_MEAT } from './bbqModel';

const SSAMJANG = 4;
/** 쌈장 = 대두·밀 */
export const SOY_WHEAT_CODES: ReadonlySet<string> = new Set(['SOY', 'WHEAT']);
/** 육류 계열: 묶음 MEAT + 말단 고기 + 고기 기름(고기에 붙어 있음). 육수(BROTH·MEAT_BROTH)는 고기 자체가 아니라 제외 */
export const MEAT_CODES: ReadonlySet<string> = new Set(['MEAT', 'BEEF', 'PORK', 'CHICKEN', 'POULTRY', 'LAMB', 'LARD', 'TALLOW']);

export type AvoidState = { kind: 'none' } | { kind: 'unknown' } | { kind: 'known'; codes: ReadonlySet<string> };
/** 이 화면이 낼 수 있는 표시는 둘뿐 — 타입으로 safe·danger 차단 */
export type TagRisk = { state: Extract<RiskState, 'caution' | 'unable'>; reasonKey: string };

export function tagRisk(cls: number, avoid: AvoidState): TagRisk | null {
  const isMeat = cls === RAW_MEAT || cls === COOKED_MEAT;
  if (cls !== SSAMJANG && !isMeat) return null;
  if (avoid.kind === 'none') return null;
  if (avoid.kind === 'unknown') return { state: 'unable', reasonKey: 'bbqGuide.risk.unknown' };
  const hit = (set: ReadonlySet<string>) => [...avoid.codes].some((c) => set.has(c));
  if (cls === SSAMJANG) return hit(SOY_WHEAT_CODES) ? { state: 'caution', reasonKey: 'bbqGuide.risk.ssamjang' } : null;
  return hit(MEAT_CODES) ? { state: 'unable', reasonKey: 'bbqGuide.risk.meat' } : null;
}

/** 서버가 지금 거부(4xx)한 프로필은 캐시보다 우선 — 캐시 데이터를 쓰지 않는다. 네트워크·5xx는 캐시 유지(비행기 모드). */
export function isRefused(error: unknown): boolean {
  return error instanceof ApiError && error.status != null && error.status >= 400 && error.status < 500;
}

/**
 * @param session useSession() — true만 회원(null = 부팅 미확정, false = 게스트). 게스트의 useMe는 목업이라 안 본다.
 */
export function avoidFrom(session: boolean | null, data: { restrictions: { code: string }[] } | undefined, error: unknown): AvoidState {
  if (session !== true) return { kind: 'none' };
  const usable = isRefused(error) ? undefined : data;
  if (!usable) return error ? { kind: 'unknown' } : { kind: 'none' };
  if (usable.restrictions.length === 0) return { kind: 'none' };
  return { kind: 'known', codes: new Set(usable.restrictions.map((r) => r.code)) };
}
