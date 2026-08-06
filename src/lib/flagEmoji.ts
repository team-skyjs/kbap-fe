/**
 * flagEmoji (P-130, 헌법 v2.3.0) — ISO 3166-1 alpha-2 → 국기 이모지.
 * regional indicator 변환(A→🇦 …). 비2글자/비알파벳 방어 = '' (호출측 폴백).
 * circle-flags SVG 벤더(구 Flag.tsx) 대체 — 이모지는 전 국가 커버, 폴백 불요.
 */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  const base = 0x1f1e6; // 🇦
  const up = code.toUpperCase();
  return String.fromCodePoint(base + up.charCodeAt(0) - 65, base + up.charCodeAt(1) - 65);
}
