/**
 * LocaleProvider — owns the active reader language (T070). On first launch it
 * detects the device locale (expo-localization) and falls back to en; a saved
 * choice (AsyncStorage) wins. setLang() switches i18next live (all screens
 * re-render via useTranslation) and persists. Also exposes the active `script`
 * (for the Txt font remap) and loads that script's fonts on demand.
 *
 * place=ko strings are unaffected by language — they render as Korean data.
 */
import * as React from 'react';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from './index';
import { resolveLang, isSupportedLang, type SupportedLang } from './languages';
import { scriptOf, type ScriptKey } from './fonts';
import { useScriptFonts } from './useScriptFonts';

const STORAGE_KEY = 'kbap.lang';

type LocaleCtx = {
  lang: SupportedLang;
  script: ScriptKey;
  scriptReady: boolean;
  setLang: (lang: SupportedLang) => void;
};

const deviceLang = resolveLang(getLocales()[0]?.languageTag ?? getLocales()[0]?.languageCode);

const Ctx = React.createContext<LocaleCtx>({
  lang: 'en',
  script: 'latin',
  scriptReady: true,
  setLang: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<SupportedLang>(deviceLang);
  const script = scriptOf(lang);
  const scriptReady = useScriptFonts(script);

  // Reconcile with a persisted choice on mount (device locale is the default).
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const next = saved && isSupportedLang(saved) ? saved : deviceLang;
        if (!alive) return;
        if (i18n.language !== next) await i18n.changeLanguage(next);
        setLangState(next);
      } catch {
        // storage unavailable → keep device default
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setLang = React.useCallback((next: SupportedLang) => {
    setLangState(next);
    i18n.changeLanguage(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = React.useMemo(() => ({ lang, script, scriptReady, setLang }), [lang, script, scriptReady, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return React.useContext(Ctx);
}
