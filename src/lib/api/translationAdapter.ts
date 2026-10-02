/**
 * translationAdapter (KB-679·KB-688·KB-689) — `POST /api/translations` 와이어 → 도메인.
 *
 * 계약(서버 KB-688 — 커맨드 센터 전달, 배포 후 Swagger가 정본): `{ targetType, targetId, language, text, sourceLanguage }`.
 * - `sourceLanguage: string | null` — 앱 10개 언어면 앱이 `lang`으로 보내는 코드와 **글자까지 같게** 서버가 정규화,
 *   그 밖은 BCP 47 언어 부분 소문자(fr·de…), 판별 못 하면 null. 구서버는 키 없음.
 * - 이 어댑터가 **원시 코드 판정을 전부** 맡는다(Codex #223 P1 · AGENTS.md 어댑터 경계): 앱 10개 코드 정확 일치 → known,
 *   그 밖(대소문자 다른 값·빈 문자열·null·키 없음 포함) → unknown. 같은 언어 = `sourceLanguage === language`(문자열 일치만).
 * - 화면은 도메인 값만 본다 — 문구 고르기만(버튼), 표시 여부(훅).
 */
import { SUPPORTED_LANGS, type SupportedLang } from '@/lib/i18n/languages';

export interface TranslationWire {
  targetType: string;
  targetId: number | string;
  language: string;
  text: string;
  sourceLanguage?: string | null;
}

export type TranslationSource = { kind: 'known'; code: SupportedLang } | { kind: 'unknown' };

export interface Translation {
  text: string;
  source: TranslationSource;
  /** 원문 언어 == 요청 언어 → text는 원문 그대로. 화면은 번역 표시로 전환하지 않고 라벨을 숨긴다. */
  sameLanguage: boolean;
}

export function adaptTranslationSource(code: string | null | undefined): TranslationSource {
  return typeof code === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(code)
    ? { kind: 'known', code: code as SupportedLang }
    : { kind: 'unknown' };
}

export function adaptTranslation(wire: TranslationWire): Translation {
  const src = wire.sourceLanguage;
  return {
    text: wire.text,
    source: adaptTranslationSource(src),
    sameLanguage: typeof src === 'string' && src !== '' && src === wire.language,
  };
}
