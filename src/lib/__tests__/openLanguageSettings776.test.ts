/* eslint-disable import/first -- jest.mock 선언 뒤에 대상 모듈을 import(레포 테스트 관례) */
/**
 * KB-776(QA B2-5) — 프로필 Language 행: Android 13(API 33)+ = 시스템 앱 언어 화면(APP_LOCALE_SETTINGS) 인텐트,
 * 그 미만·iOS·인텐트 실패 = 기존 OS 앱 설정(openAppSettings). 실패는 조용히 삼키지 않는다(P-381 토스트 그대로).
 */
const mockToast = jest.fn();
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  __esModule: true,
  default: { openURL: jest.fn(), openSettings: jest.fn(), sendIntent: jest.fn() },
}));
jest.mock('@/components/topToastStore', () => ({ showTopToast: (text: string, opts?: unknown) => mockToast(text, opts) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));

import { Linking, Platform } from 'react-native';
import { openLanguageSettings } from '../openExternal';

const sendIntent = Linking.sendIntent as jest.Mock;
const openSettings = Linking.openSettings as jest.Mock;
const setPlatform = (os: 'ios' | 'android', version: number) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
};
const read = (p: string) => (jest.requireActual('fs') as typeof import('fs')).readFileSync(p, 'utf8');

beforeEach(() => {
  jest.clearAllMocks();
  sendIntent.mockResolvedValue(undefined);
  openSettings.mockResolvedValue(undefined);
});

it('Android 33+ = 앱 언어 화면 인텐트(앱 정보로 가지 않음)', async () => {
  setPlatform('android', 33);
  await expect(openLanguageSettings()).resolves.toBe(true);
  expect(sendIntent).toHaveBeenCalledWith('android.settings.APP_LOCALE_SETTINGS');
  expect(openSettings).not.toHaveBeenCalled();
});

it('Android 33+ 인텐트 실패(제조사 설정에 화면 없음) = 앱 설정 폴백 · 토스트 없음', async () => {
  setPlatform('android', 34);
  sendIntent.mockRejectedValue(new Error('Could not launch Intent'));
  await expect(openLanguageSettings()).resolves.toBe(true);
  expect(openSettings).toHaveBeenCalledTimes(1);
  expect(mockToast).not.toHaveBeenCalled();
});

it('Android 32 이하·iOS = 기존 앱 설정(인텐트 0)', async () => {
  for (const [os, v] of [['android', 32], ['ios', 17]] as const) {
    jest.clearAllMocks();
    setPlatform(os, v);
    await openLanguageSettings();
    expect(sendIntent).not.toHaveBeenCalled();
    expect(openSettings).toHaveBeenCalledTimes(1);
  }
});

it('둘 다 실패 = 설정 전용 토스트 + false(무반응 금지)', async () => {
  setPlatform('android', 33);
  sendIntent.mockRejectedValue(new Error('x'));
  openSettings.mockRejectedValue(new Error('y'));
  await expect(openLanguageSettings()).resolves.toBe(false);
  expect(mockToast).toHaveBeenCalledWith('states.settingsFailed', { error: true });
});

it('프로필·프로필 편집의 Language 행 = openLanguageSettings 경유(게스트·회원 두 분기 + 편집 1)', () => {
  const profile = read('src/app/(tabs)/profile.tsx');
  expect((profile.match(/openLanguageSettings\(\)/g) ?? []).length).toBe(2);
  expect(profile).not.toMatch(/openAppSettings\(/);
  expect(read('src/app/profile/edit.tsx')).toContain('openLanguageSettings()');
});
