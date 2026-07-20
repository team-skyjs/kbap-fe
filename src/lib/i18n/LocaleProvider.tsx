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
import { queryClient } from '@/lib/queryClient';
import { resolveLang, isSupportedLang, type SupportedLang } from './languages';
import { scriptOf, type ScriptKey } from './fonts';
import { useScriptFonts } from './useScriptFonts';

const STORAGE_KEY = 'kbap.lang';

/** 언어 종속 서버 데이터 쿼리의 루트 키 (P-015) — BE가 지역화해 주는 것들만. */
const LANG_DEPENDENT_KEYS = new Set(['home', 'foods', 'food', 'me']);

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
    // P-015(KB-187) 언어 전환 잔상 수술: changeLanguage는 비동기 — 완료 전
    // 리렌더에선 쿼리 키의 i18n.language가 아직 이전 언어라 키가 안 바뀌고,
    // staleTime(60s) 동안 구언어 데이터가 fresh로 남는다. 완료 직후 lang 종속
    // 서버 쿼리만 1회 무효화 — 활성 쿼리는 즉시 재조회(새 키는 fresh 마운트 +
    // P-009 스켈레톤), 매 탭 진입 재호출 아님.
    void i18n.changeLanguage(next).then(() => {
      queryClient.invalidateQueries({ predicate: (q) => LANG_DEPENDENT_KEYS.has(String(q.queryKey[0])) });
    });
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = React.useMemo(() => ({ lang, script, scriptReady, setLang }), [lang, script, scriptReady, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return React.useContext(Ctx);
}
