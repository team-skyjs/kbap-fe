/**
 * languages.ts — the supported reader languages (Constitution I + 멘토링 ⑤ ko).
 * Endonyms are shown in each language's own script (not translated), so this is
 * a static map. fallback = en. (ko는 이제 리더 언어이기도 하다 — place=ko 데이터
 * 렌더링과는 별개 경로.)
 */
export const SUPPORTED_LANGS = ['en', 'ko', 'zh-Hans', 'zh-Hant', 'ja', 'vi', 'id', 'th', 'ru', 'es'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/** Language name in its own script (endonym), for the picker + profile row. */
export const LANG_ENDONYM: Record<string, string> = {
  en: 'English',
  ko: '한국어',
  'zh-Hans': '中文(简)',
  'zh-Hant': '中文(繁)',
  ja: '日本語',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
  ru: 'Русский',
  es: 'Español',
};

export function isSupportedLang(lang: string): lang is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(lang);
}

/** Map a device locale (e.g. "zh-Hant-TW", "en-US", "pt") to a supported lang or en. */
export function resolveLang(locale: string | undefined | null): SupportedLang {
  if (!locale) return 'en';
  if (isSupportedLang(locale)) return locale;
  const lower = locale.toLowerCase();
  // Chinese script disambiguation
  if (lower.startsWith('zh')) {
    if (/hant|tw|hk|mo/.test(lower)) return 'zh-Hant';
    return 'zh-Hans';
  }
  const base = lower.split(/[-_]/)[0];
  const byBase: Record<string, SupportedLang> = {
    en: 'en', ko: 'ko', ja: 'ja', vi: 'vi', id: 'id', th: 'th', ru: 'ru', es: 'es',
  };
  return byBase[base] ?? 'en';
}
