/**
 * i18n bootstrap (Constitution I) — all reader-facing strings come from here,
 * never hardcoded. Ships 9 languages; the device locale picks the best match at
 * first launch, falling back to English. A saved choice is applied by
 * LocaleProvider. (place=ko strings are DATA, not i18n — they arrive from the
 * API e.g. OwnerConfirmation, and always render in Noto Sans KR.)
 *
 * The 8 non-en bundles are machine-translation quality (each carries a
 * `_meta.status` marker) pending native review.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { resolveLang } from './languages';

import en from './en.json';
import zhHans from './zh-Hans.json';
import zhHant from './zh-Hant.json';
import ja from './ja.json';
import vi from './vi.json';
import id from './id.json';
import th from './th.json';
import ru from './ru.json';
import es from './es.json';

export const resources = {
  en: { translation: en },
  'zh-Hans': { translation: zhHans },
  'zh-Hant': { translation: zhHant },
  ja: { translation: ja },
  vi: { translation: vi },
  id: { translation: id },
  th: { translation: th },
  ru: { translation: ru },
  es: { translation: es },
} as const;

const initialLang = resolveLang(getLocales()[0]?.languageTag ?? getLocales()[0]?.languageCode);

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export default i18n;
