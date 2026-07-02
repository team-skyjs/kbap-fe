/**
 * classifyLine.ts — OCR line classifier for scan segmentation (T072, handoff §14-2).
 *
 * Pure, layout-independent: maps one OCR line (text + normalized box) to a type.
 * SAFETY: filtering downstream uses ONLY the structural type — never the BE match
 * result. A plausible short Korean line is a `dishName` (matchable, always shown);
 * only structurally non-food lines become `junk` (handoff §14-3, Constitution III).
 */
import type { BoundingBox } from '@/lib/api/scanTypes';

export type LineType =
  | 'price'
  | 'origin'
  | 'section'
  | 'latin'
  | 'description'
  | 'dishName'
  | 'junk';

/** §14-2 rules. */
const PRICE = /[Ww₩]\s?\d[\d,]*/; // W12,000 / w8,000 / ₩5000
const ORIGIN = /(원산지|국산|수입산|산\))/;
const FUNC_KEY = /^F\d{1,2}$/; // F4–F8 on-screen function keys
const FILE_EXT = /\.(jpe?g|png|gif|heic|webp|pdf)$/i;
const HANGUL = /[가-힣]/;
const LATIN = /[A-Za-z]/;

/** Known section headers that don't end in 류 (handoff §14-2 "알려진 카테고리"). */
const KNOWN_SECTIONS = ['음료', '음료수', '주류', '디저트', '사이드', '안주', '세트'];

/** Tunable thresholds — edge fractions are from §14-2; the rest are provisional (see PROGRESS ❓). */
export const THRESHOLDS = {
  edgeTop: 0.17, // §14-2: y < 0.17 = top screen edge
  edgeBottom: 0.81, // §14-2: y > 0.81 = bottom screen edge
  descriptionMinLen: 12, // §14-2: "대략 ≥12자"
  descriptionMinBreaks: 3, // spaces/commas/·: many → sentence
  sectionMaxLen: 6, // §14-2: "짧고 ~류" — length cap chosen here
} as const;

export function classifyLine(text: string, box: BoundingBox): LineType {
  const t = text.trim();

  // 1) structural junk (content-based)
  const core = t.replace(/[^가-힣A-Za-z0-9]/g, '');
  if (core.length <= 1) return 'junk'; // single char / pure symbols e.g. "Q &"
  if (FILE_EXT.test(t)) return 'junk'; // ".jpg"
  if (FUNC_KEY.test(t)) return 'junk'; // "F4".."F8"

  // 2) price / origin (before dishName so a price line never looks like a name)
  if (PRICE.test(t)) return 'price';
  if (ORIGIN.test(t)) return 'origin';

  const hasHangul = HANGUL.test(t);
  const hasLatin = LATIN.test(t);

  // 3) section header: short 류-suffixed or a known category word
  if (hasHangul && ((t.length <= THRESHOLDS.sectionMaxLen && /류$/.test(t)) || KNOWN_SECTIONS.includes(t))) {
    return 'section';
  }

  // 4) latin-dominant (no Hangul): a romanized display-name candidate,
  //    UNLESS it sits at the top/bottom screen edge → UI noise (e.g. "MacBook Air")
  if (!hasHangul && hasLatin) {
    if (box.y < THRESHOLDS.edgeTop || box.y > THRESHOLDS.edgeBottom) return 'junk';
    return 'latin';
  }

  // 5) description: long / sentence-like Korean (OCR-noisy, never used for matching)
  const breaks = (t.match(/[\s,·]/g) ?? []).length;
  if (hasHangul && (t.length >= THRESHOLDS.descriptionMinLen || breaks >= THRESHOLDS.descriptionMinBreaks)) {
    return 'description';
  }

  // 6) dish name: any remaining short Korean line → the matchable unit
  if (hasHangul) return 'dishName';

  // 7) leftover (numbers-only, stray latin at center without hangul handled above)
  return 'junk';
}
