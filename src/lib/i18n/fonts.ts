/**
 * fonts.ts — multi-script font resolution (T071 → ⑦ 용량 2차 재설계, KB-137).
 *
 * 종전: 스크립트→Noto 패밀리 매핑 + 패밀리별 ttf 번들. @expo-google-fonts
 * 루트 import가 패밀리당 9웨이트 전부를 require해 CJK 4패밀리만 254MB를
 * 차지했다(7/10 prod .ipa 실측). Metro는 asset require를 tree-shake 못 한다.
 *
 * 현재: CJK/Thai/KR은 **시스템 폰트 + fontWeight**로 렌더 — iOS는 SF 폴백이
 * PingFang SC/TC·Hiragino Sans·Apple SD Gothic Neo·Thonburi를 자동 해석하고
 * Android 시스템 폰트가 Noto Sans CJK다. 번들 폰트는 라틴 브랜드(Baloo 2·
 * Nunito Sans, ~5MB)만 유지. 디자인 토큰(크기·굵기 위계 400/600/700/800)은
 * 그대로 — 패밀리 대신 weight로 위계를 표현한다.
 *
 * theme.font의 문자열 토큰(외부 표면)은 유지: 'NotoSansKR_*'는 이제 등록되지
 * 않는 **가상 패밀리명**이고, Txt가 resolveFont()로 시스템 폰트+weight로
 * 치환한다. place=ko 데이터(요리명·사장님 카드)도 같은 경로.
 */
import type { TextStyle } from 'react-native';
import { font as latin } from '@/lib/theme';

export type ScriptKey = 'latin' | 'kr' | 'sc' | 'tc' | 'jp' | 'thai' | 'cyrillic';

/** reader language → script. fallback latin. */
export const LANG_SCRIPT: Record<string, ScriptKey> = {
  en: 'latin',
  ko: 'kr',
  vi: 'latin',
  id: 'latin',
  es: 'latin',
  'zh-Hans': 'sc',
  'zh-Hant': 'tc',
  ja: 'jp',
  th: 'thai',
  ru: 'cyrillic',
};

export function scriptOf(lang: string): ScriptKey {
  return LANG_SCRIPT[lang] ?? 'latin';
}

/** the 7 script-sensitive semantic roles. */
export type FontRole =
  | 'display'
  | 'displaySemi'
  | 'displayBlack'
  | 'body'
  | 'bodySemi'
  | 'bodyBold'
  | 'bodyBlack';

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

/** role → 시스템 폰트 weight (디자인 토큰의 굵기 위계 그대로). */
const ROLE_WEIGHT: Record<FontRole, TextStyle['fontWeight']> = {
  display: '700',
  displaySemi: '600',
  displayBlack: '800',
  body: '400',
  bodySemi: '600',
  bodyBold: '700',
  bodyBlack: '800',
};

/** place=ko 가상 패밀리(theme.font.ko*) → 시스템 폰트 weight. */
const KO_WEIGHT: Record<string, TextStyle['fontWeight']> = {
  [latin.ko]: '400',
  [latin.koMed]: '500',
  [latin.koBold]: '700',
};

/** Txt가 style에 덧씌울 폰트 치환. null = 그대로 둠. */
export type FontOverride = { fontFamily?: string; fontWeight?: TextStyle['fontWeight'] };

export function resolveFont(family: string | undefined, _script: ScriptKey): FontOverride | null {
  if (!family) return null;
  // place=ko 가상 패밀리 — 항상 시스템 폰트 + weight
  if (KO_WEIGHT[family]) return { fontWeight: KO_WEIGHT[family] };
  const role = ROLE_OF_LATIN[family];
  if (!role) return null; // 알 수 없는 패밀리(로고 Baloo 등) — 손대지 않음
  // P-135(멘토 #1·25): 로고 외 전면 시스템 — 라틴 포함 전 스크립트가 시스템 폰트
  // + weight (iOS SF/Apple SD Gothic Neo · 안드 Roboto/Noto 자동). 키릴 강등
  // 분기 소멸(시스템이 키릴 네이티브 커버 — Nunito 번들 제거).
  return { fontWeight: ROLE_WEIGHT[role] };
}
