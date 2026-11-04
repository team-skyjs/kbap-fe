/**
 * recipeAdapter — KB-990 가공식품 상세 조리법(서버 S-961 계약 초안 — 확정 시 dev Swagger 정본).
 *
 * 상세 응답 `recipe?: { source, methods: [...] }` → 표시용 Recipe | null.
 * - 방식은 MICROWAVE·BOILING_WATER만, 전자레인지 먼저(시트 기본 칩).
 * - 수치는 유한한 양수만(물 ml·W·초), 대기·남길 물은 0 이상 — 그 밖은 null(타일 미표시).
 * - steps·cautions는 서버 번역 원문 그대로(빈 줄 버림). 보여 줄 게 없는 방식은 버리고, 방식이 0이면 null = 섹션 숨김.
 */
export type RecipeMethodType = 'MICROWAVE' | 'BOILING_WATER';
export type WaterLine = 'INNER' | 'OUTER' | 'COVER_NOODLES';

export type RecipeMethodWire = {
  type?: string | null;
  water?: { ml?: number | null; line?: string | null } | null;
  power?: { watt?: number | null; seconds?: number | null }[] | null;
  waitSeconds?: number | null;
  drainKeepMl?: number | null;
  steps?: { text?: string | null }[] | null;
  cautions?: (string | null)[] | null;
};
export type RecipeWire = { source?: string | null; methods?: RecipeMethodWire[] | null };

export type RecipeMethod = {
  type: RecipeMethodType;
  waterMl: number | null;
  waterLine: WaterLine | null;
  power: { watt: number; seconds: number }[];
  waitSeconds: number | null;
  drainKeepMl: number | null;
  steps: string[];
  cautions: string[];
};
export type Recipe = { source: string | null; methods: RecipeMethod[] };

const TYPES: readonly RecipeMethodType[] = ['MICROWAVE', 'BOILING_WATER'];
const LINES: readonly WaterLine[] = ['INNER', 'OUTER', 'COVER_NOODLES'];
const pos = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
const nonNeg = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function adaptMethod(w: RecipeMethodWire): RecipeMethod | null {
  const type = TYPES.find((t) => t === w.type?.toUpperCase()); // README 예시는 소문자 — 계약 초안은 대문자, 둘 다 받는다
  if (!type) return null;
  const line = LINES.find((l) => l === w.water?.line?.toUpperCase()) ?? null;
  const power = (w.power ?? []).flatMap((p) => {
    const watt = pos(p?.watt);
    const seconds = pos(p?.seconds);
    return watt != null && seconds != null ? [{ watt, seconds }] : [];
  });
  const m: RecipeMethod = {
    type,
    waterMl: pos(w.water?.ml),
    waterLine: line,
    power,
    waitSeconds: nonNeg(w.waitSeconds),
    drainKeepMl: nonNeg(w.drainKeepMl),
    steps: (w.steps ?? []).map((s) => text(s?.text)).filter((s): s is string => s != null),
    cautions: (w.cautions ?? []).map(text).filter((c): c is string => c != null),
  };
  const shows = m.waterMl != null || m.waterLine != null || m.power.length > 0 || m.waitSeconds != null || m.steps.length > 0;
  return shows ? m : null;
}

export function adaptRecipe(w: RecipeWire | null | undefined): Recipe | null {
  const methods = (w?.methods ?? [])
    .map(adaptMethod)
    .filter((m): m is RecipeMethod => m != null)
    .sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type));
  return methods.length ? { source: text(w?.source), methods } : null;
}
