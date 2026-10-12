/** KB-689 translationAdapter — 와이어(sourceLanguage·language) → 도메인(source·sameLanguage) 표. 원시 코드 판정은 여기서만. */
import { adaptTranslation, adaptTranslationSource } from '../translationAdapter';
import { SUPPORTED_LANGS } from '@/lib/i18n/languages';

const W = (sourceLanguage: unknown, language = 'ko') => {
  const w: Record<string, unknown> = { targetType: 'REVIEW', targetId: 53, language, text: '번역문' };
  if (sourceLanguage !== '__absent__') w.sourceLanguage = sourceLanguage;
  return w as never;
};

it.each(SUPPORTED_LANGS.map((c) => [c]))('앱 언어 %s = known(같은 코드)', (c) => {
  expect(adaptTranslationSource(c)).toEqual({ kind: 'known', code: c });
});

it.each([
  ['fr'], // 앱 10개 밖(서버는 언어 부분 소문자)
  ['EN'], // 대소문자 다름 — 서버 정규화 계약 밖 값은 모르는 코드
  ['zh-hans'],
  ['en-US'],
  [''],
  [null],
  [undefined], // 키 없음(구서버)
])('%j = unknown', (c) => {
  expect(adaptTranslationSource(c as string | null | undefined)).toEqual({ kind: 'unknown' });
});

it.each([
  ['ko', 'ko', true],
  ['zh-Hant', 'zh-Hant', true],
  ['fr', 'fr', true], // 문자열 일치만 — 앱 밖 코드여도 같으면 같은 언어
  ['en', 'ko', false],
  ['KO', 'ko', false], // 문자열 일치만(대소문자 다르면 다름)
  [null, 'ko', false],
  ['__absent__', 'ko', false],
  ['', '', false], // 빈 값은 판별 못 함
])('sameLanguage(source %j, language %j) = %s', (src, lang, want) => {
  expect(adaptTranslation(W(src, lang as string)).sameLanguage).toBe(want);
});

it('text는 그대로 · source는 같은 판정', () => {
  expect(adaptTranslation(W('en'))).toEqual({ text: '번역문', source: { kind: 'known', code: 'en' }, sameLanguage: false });
  expect(adaptTranslation(W('__absent__'))).toEqual({ text: '번역문', source: { kind: 'unknown' }, sameLanguage: false });
});
