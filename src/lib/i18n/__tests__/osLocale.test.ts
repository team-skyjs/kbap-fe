/**
 * P-060: 언어 OS 정본화 잠금 — 기기 언어 추종·미지원 en 폴백,
 * resolveInitialLang = 기기 언어(저장 선택 소멸 — kbap.lang 미참조).
 */
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'th-TH', languageCode: 'th' }] }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', changeLanguage: jest.fn() } }));
jest.mock('@/lib/i18n/useScriptFonts', () => ({ useScriptFonts: () => true }));

import { resolveLang } from '../languages';
import { resolveInitialLang } from '../LocaleProvider';

it('resolveLang: 지원 매핑·지역 변형·미지원 en 폴백', () => {
  expect(resolveLang('th-TH')).toBe('th');
  expect(resolveLang('zh-Hant-TW')).toBe('zh-Hant');
  expect(resolveLang('zh-CN')).toBe('zh-Hans');
  expect(resolveLang('pt-BR')).toBe('en'); // 미지원 → en
  expect(resolveLang(undefined)).toBe('en');
});

it('resolveInitialLang = 기기 언어 (AsyncStorage 미참조 — OS 정본)', async () => {
  await expect(resolveInitialLang()).resolves.toBe('th');
});
