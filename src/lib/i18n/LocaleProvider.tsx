/**
 * LocaleProvider — active reader language (T070 → P-060 OS 정본화).
 *
 * P-060(2026-07-23 확정): **앱 언어의 유일한 정본 = 기기/OS 언어.**
 * 인앱 선택·AsyncStorage(kbap.lang) 저장·라이브 전환(setLang) 전부 제거 —
 * 지원 10종 매핑(resolveLang), 밖이면 en. 언어 변경은 OS 앱별 언어 설정에서
 * 하며 iOS·안드 모두 앱 재시작이라 P-015 계열 캐시 무효화도 소멸.
 * 기존 설치의 kbap.lang 잔존값은 더 이상 읽지 않음(무해).
 *
 * place=ko strings are unaffected by language — they render as Korean data.
 */
import * as React from 'react';
import { getLocales } from 'expo-localization';
import i18n from './index';
import { resolveLang, type SupportedLang } from './languages';
import { scriptOf, type ScriptKey } from './fonts';
import { useScriptFonts } from './useScriptFonts';

type LocaleCtx = {
  lang: SupportedLang;
  script: ScriptKey;
  scriptReady: boolean;
};

const deviceLang = resolveLang(getLocales()[0]?.languageTag ?? getLocales()[0]?.languageCode);

/** 부팅 시점의 언어 = 기기 언어 — 프리페치 키 일치용(P-018, 시그니처 유지). */
export async function resolveInitialLang(): Promise<SupportedLang> {
  return deviceLang;
}

const Ctx = React.createContext<LocaleCtx>({
  lang: 'en',
  script: 'latin',
  scriptReady: true,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const lang = deviceLang; // OS가 정본 — 세션 중 불변(변경 = OS 설정 → 앱 재시작)
  const script = scriptOf(lang);
  const scriptReady = useScriptFonts(script);

  React.useEffect(() => {
    if (i18n.language !== deviceLang) void i18n.changeLanguage(deviceLang);
  }, []);

  const value = React.useMemo(() => ({ lang, script, scriptReady }), [lang, script, scriptReady]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return React.useContext(Ctx);
}
