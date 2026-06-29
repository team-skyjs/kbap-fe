/**
 * i18n bootstrap (Constitution I/II) — all reader-facing strings come from here,
 * never hardcoded. MVP ships English; device locale picks the best match,
 * falling back to English. (place=ko strings are DATA, not i18n — they arrive
 * from the API e.g. OwnerConfirmation, and are rendered in Noto Sans KR.)
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './en.json';

const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';

export const resources = {
  en: { translation: en },
} as const;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: deviceLanguage in resources ? deviceLanguage : 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export default i18n;
