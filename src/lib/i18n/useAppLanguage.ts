/**
 * useAppLanguage (KB-695) — 앱(i18next) 언어를 **구독으로** 읽는다. 쿼리 키 등 렌더 결과에 언어를 쓰는 곳은 이걸 쓴다.
 * 렌더 본문에서 모듈 싱글턴 `i18n.language`를 그냥 읽으면 React Compiler가 의존으로 못 잡아 키가 첫 렌더 언어로 굳는다
 * (세션 중 언어 전환이 생기는 날 다른 언어 데이터가 남는다). 값은 기존과 같은 `i18n.language` — 키·부트 프리페치와 일치.
 * `useLocale().lang`(OS 언어)과 다를 수 있으니(저장 언어 — bootGate.resolveInitialLang) 그것으로 대체하지 않는다.
 */
import * as React from 'react';
import i18n from '@/lib/i18n';

function subscribe(onChange: () => void): () => void {
  // 테스트 목(`{ language, t }`)엔 on/off가 없다 — 없으면 구독 생략(값만 읽음)
  i18n.on?.('languageChanged', onChange);
  return () => i18n.off?.('languageChanged', onChange);
}
const read = () => i18n.language;

export function useAppLanguage(): string {
  return React.useSyncExternalStore(subscribe, read, read);
}
