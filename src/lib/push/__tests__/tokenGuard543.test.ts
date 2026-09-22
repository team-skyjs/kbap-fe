/**
 * KB-543 — 토큰 등록은 회원 전용: 세션 없음 = PUT 0회 · 본문 {token, platform, lang}만 ·
 * 401 등 실패는 비치명. (BE kbap-server#260 계약 변경)
 */
jest.mock('@/lib/flags', () => ({ FLAGS: { pushEnabled: true }, isProdChannel: () => false, SYSTEM_CAMERA_AUTOLAUNCH: false }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'ko', t: (k: string) => k } }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockNotifications = {
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[t]' }),
};
jest.mock('expo-notifications', () => mockNotifications);
const mockApi = { put: jest.fn().mockResolvedValue(undefined) };
const mockLang = { lang: 'ko' };
jest.mock('@/lib/api/client', () => ({ get api() { return mockApi; }, apiLang: () => mockLang.lang }));
const mockSession = { hasBeSession: jest.fn().mockResolvedValue(true) };
jest.mock('@/lib/auth/beAuth', () => ({ get hasBeSession() { return mockSession.hasBeSession; } })); // 지연 접근(호이스팅)

import { registerPushToken } from '../pushAdapter';

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.hasBeSession.mockResolvedValue(true);
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockApi.put.mockResolvedValue(undefined);
});

it('(a) 회원 세션 없음 → 권한이 있어도 PUT 0회, 토큰 발급도 안 함 (SC-011)', async () => {
  mockSession.hasBeSession.mockResolvedValue(false);
  await registerPushToken();
  expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  expect(mockApi.put).not.toHaveBeenCalled();
});

it('(b) 세션 + granted → PUT 1회, 본문 키는 정확히 token·platform·lang, lang = apiLang() (FR-019/020, SC-010)', async () => {
  mockLang.lang = 'ja';
  await registerPushToken();
  expect(mockApi.put).toHaveBeenCalledTimes(1);
  const [path, body] = mockApi.put.mock.calls[0] as [string, Record<string, unknown>];
  expect(path).toBe('/api/notifications/tokens');
  expect(Object.keys(body).sort()).toEqual(['lang', 'platform', 'token']);
  expect(body.lang).toBe('ja');
  expect(body).not.toHaveProperty('settings');
  mockLang.lang = 'ko';
});

it('(c) PUT 401(위조·만료) reject 도 registerPushToken 은 resolve — 앱 동작을 막지 않는다', async () => {
  mockApi.put.mockRejectedValueOnce(Object.assign(new Error('unauthorized'), { status: 401 }));
  await expect(registerPushToken()).resolves.toBeUndefined();
});
