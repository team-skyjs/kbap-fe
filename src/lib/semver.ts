/**
 * semver.ts — 최소 지원 버전 게이트(P-111/KB-269)용 순수 비교.
 * 대상은 마케팅 버전 "x.y.z"만(빌드번호·prerelease 없음 — 버저닝 규칙 제안 §3).
 * 형식 불량은 null — 호출측(게이트)이 페일 오픈으로 강등한다.
 */
export function parseSemver(v: unknown): [number, number, number] | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** a<b → 음수 · a==b → 0 · a>b → 양수 · 형식 불량 → null (페일 오픈 신호). */
export function compareSemver(a: string, b: string): number | null {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}
