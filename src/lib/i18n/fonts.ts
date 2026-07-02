/**
 * fonts.ts — multi-script font resolution (T071, Constitution I: 9 languages,
 * zero tofu). Baloo 2 (display) covers Latin only; non-Latin reader languages
 * need a script-appropriate family. The active reader language maps to ONE
 * script, so this is a global switch (not per-glyph) — except place=ko strings
 * (menu names, owner questions) which ALWAYS stay Noto Sans KR.
 *
 * `remapFamily()` rewrites a Latin theme.font family to the active script's
 * equivalent at render time (see components/Txt), which is why the frozen
 * StyleSheet font values still end up script-correct.
 */
import { font as latin } from '@/lib/theme';

export type ScriptKey = 'latin' | 'sc' | 'tc' | 'jp' | 'thai' | 'cyrillic';

/** reader language → script. place=ko is data, never routed here. fallback latin. */
export const LANG_SCRIPT: Record<string, ScriptKey> = {
  en: 'latin',
  vi: 'latin',
  id: 'latin',
  es: 'latin',
  'zh-Hans': 'sc',
  'zh-Hant': 'tc',
  ja: 'jp',
  th: 'thai',
  ru: 'cyrillic',
};

/** the 7 script-sensitive semantic roles (ko roles are script-fixed, excluded). */
export type FontRole =
  | 'display'
  | 'displaySemi'
  | 'displayBlack'
  | 'body'
  | 'bodySemi'
  | 'bodyBold'
  | 'bodyBlack';

export type FontSet = Record<FontRole, string>;

/** Noto family for a script + weight bucket. */
function noto(prefix: string): FontSet {
  return {
    display: `${prefix}_700Bold`,
    displaySemi: `${prefix}_600SemiBold`,
    displayBlack: `${prefix}_800ExtraBold`,
    body: `${prefix}_400Regular`,
    bodySemi: `${prefix}_600SemiBold`,
    bodyBold: `${prefix}_700Bold`,
    bodyBlack: `${prefix}_800ExtraBold`,
  };
}

const LATIN_SET: FontSet = {
  display: latin.display,
  displaySemi: latin.displaySemi,
  displayBlack: latin.displayBlack,
  body: latin.body,
  bodySemi: latin.bodySemi,
  bodyBold: latin.bodyBold,
  bodyBlack: latin.bodyBlack,
};

// Cyrillic (ru): Baloo 2 has no Cyrillic → display falls back to Nunito Sans,
// which ships a Cyrillic subset. Body is already Nunito Sans.
const CYRILLIC_SET: FontSet = {
  display: latin.bodyBold,
  displaySemi: latin.bodySemi,
  displayBlack: latin.bodyBlack,
  body: latin.body,
  bodySemi: latin.bodySemi,
  bodyBold: latin.bodyBold,
  bodyBlack: latin.bodyBlack,
};

export const FONT_SETS: Record<ScriptKey, FontSet> = {
  latin: LATIN_SET,
  cyrillic: CYRILLIC_SET,
  sc: noto('NotoSansSC'),
  tc: noto('NotoSansTC'),
  jp: noto('NotoSansJP'),
  thai: noto('NotoSansThai'),
};

export function scriptOf(lang: string): ScriptKey {
  return LANG_SCRIPT[lang] ?? 'latin';
}

/** Reverse lookup: a Latin theme.font family string → its semantic role. */
const ROLE_OF_LATIN: Record<string, FontRole> = {
  [latin.display]: 'display',
  [latin.displaySemi]: 'displaySemi',
  [latin.displayBlack]: 'displayBlack',
  [latin.body]: 'body',
  [latin.bodySemi]: 'bodySemi',
  [latin.bodyBold]: 'bodyBold',
  [latin.bodyBlack]: 'bodyBlack',
};

/**
 * Rewrite a fontFamily for the active script. Latin display/body families map to
 * the script equivalent; Korean families (place=ko) and anything unknown pass
 * through unchanged. Latin script is an identity no-op.
 */
export function remapFamily(family: string | undefined, script: ScriptKey): string | undefined {
  if (!family || script === 'latin') return family;
  const role = ROLE_OF_LATIN[family];
  return role ? FONT_SETS[script][role] : family;
}
