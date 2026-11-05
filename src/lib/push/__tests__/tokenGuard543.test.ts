/**
 * KB-543 → KB-1007(S-973): 토큰 등록 = 권한만 있으면 게스트도(서버가 X-Installation-Id로 받는다 — 운영진 채팅 답장 푸시) ·
 * 본문 {token, platform, lang}만 · 401 등 실패는 비치명(서버 배포 전 게스트 401 포함).
 */
// jest.mock은 babel-jest가 import 위로 올린다 — 목이 먼저 걸린다
import { promptPermissionOnFirstLogin, registerPushToken } from '../pushAdapter';
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


beforeEach(() => {
  jest.clearAllMocks();
  mockSession.hasBeSession.mockResolvedValue(true);
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockApi.put.mockResolvedValue(undefined);
});

it('(a) KB-1007: 게스트(회원 세션 없음) + granted → PUT 1회(같은 본문) · 권한 없음 = PUT 0 · 토큰 발급도 안 함', async () => {
  mockSession.hasBeSession.mockResolvedValue(false);
  await registerPushToken();
  expect(mockApi.put).toHaveBeenCalledTimes(1);
  expect(Object.keys(mockApi.put.mock.calls[0][1] as object).sort()).toEqual(['lang', 'platform', 'token']);
  jest.clearAllMocks();
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
  await registerPushToken();
  expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  expect(mockApi.put).not.toHaveBeenCalled();
});

it('(d) KB-1007: 첫 설치 로그인 화면 OS 팝업에서 허용(게스트) → 바로 토큰 등록 1회', async () => {
  mockSession.hasBeSession.mockResolvedValue(false);
  await promptPermissionOnFirstLogin();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(mockApi.put).toHaveBeenCalledTimes(1);
  expect(mockApi.put.mock.calls[0][0]).toBe('/api/notifications/tokens');
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
