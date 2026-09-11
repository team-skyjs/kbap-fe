/**
 * P-192: pushAdapter 로직 — 플래그 on 가정(모듈 목)에서 프라이머 기록·로컬 예약/취소·
 * 딥링크 매핑·탭 구독·토큰 upsert. 플래그 off 무동작은 pushSurfaces192 스위트(실 플래그)가
 * 잠근다. KB-497: 로컬 설정 저장소 제거 — 리마인더 게이트는 서버 설정 캐시(activity).
 */
jest.mock('@/lib/flags', () => ({ FLAGS: { pushEnabled: true }, isProdChannel: () => false, SYSTEM_CAMERA_AUTOLAUNCH: false }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string, o?: Record<string, unknown>) => (o?.name ? `${k}:${o.name}` : k) } }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockNotifications = {
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('nid-1'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
};
jest.mock('expo-notifications', () => mockNotifications);
const mockApi = { put: jest.fn().mockResolvedValue(undefined) };
jest.mock('@/lib/api/client', () => ({ get api() { return mockApi; }, apiLang: () => 'en' }));
const mockSession = { hasBeSession: jest.fn().mockResolvedValue(true) };
jest.mock('@/lib/auth/beAuth', () => ({ get hasBeSession() { return mockSession.hasBeSession; } })); // 지연 접근(호이스팅)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '@/lib/queryClient';
import { NOTIF_SETTINGS_KEY } from '@/lib/data/useNotificationSettings';
import {
  addNotificationTapListener,
  cancelReviewReminder,
  getPrimerResult,
  markPrimerResult,
  registerPushToken,
  REVIEW_REMINDER_SECONDS,
  routeForNotificationData,
  scheduleReviewReminder,
} from '../pushAdapter';

const SETTINGS_ON = { activity: true, news: { enabled: false, mealTime: false, privacyConsent: null, receiveConsent: null } };

beforeEach(async () => {
  jest.clearAllMocks();
  mockApi.put.mockResolvedValue(undefined);
  mockSession.hasBeSession.mockResolvedValue(true);
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  queryClient.clear();
  queryClient.setQueryData(NOTIF_SETTINGS_KEY, SETTINGS_ON);
  await AsyncStorage.clear();
});

it('프라이머 기록 — 거절 저장 = 재노출 판정 소스(getPrimerResult)', async () => {
  expect(await getPrimerResult()).toBeNull();
  await markPrimerResult('declined');
  expect(await getPrimerResult()).toBe('declined');
});

it('리뷰 유도 예약 — 1시간 트리거 + REVIEW_REMINDER data, 취소 시 그 id로 cancel', async () => {
  await scheduleReviewReminder({ foodId: '7', name: 'Kimbap' });
  expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  const arg = mockNotifications.scheduleNotificationAsync.mock.calls[0][0] as {
    content: { data: unknown };
    trigger: { seconds: number };
  };
  expect(arg.content.data).toEqual({ type: 'REVIEW_REMINDER', foodId: '7' });
  expect(arg.trigger.seconds).toBe(REVIEW_REMINDER_SECONDS);
  await cancelReviewReminder('7');
  expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('nid-1');
});

it('KB-497: 서버 activity 캐시 false·없음 = 예약 안 함 · OS 권한 없음 = 예약 안 함', async () => {
  queryClient.setQueryData(NOTIF_SETTINGS_KEY, { ...SETTINGS_ON, activity: false });
  await scheduleReviewReminder({ foodId: '7', name: 'Kimbap' });
  expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  queryClient.clear(); // 캐시 없음(미조회) = 보수적으로 예약 안 함
  await scheduleReviewReminder({ foodId: '7', name: 'Kimbap' });
  expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  queryClient.setQueryData(NOTIF_SETTINGS_KEY, SETTINGS_ON);
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
  await scheduleReviewReminder({ foodId: '7', name: 'Kimbap' });
  expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('토큰 upsert — 권한 granted면 발급, 아니면 조용히 스킵(게스트 포함)', async () => {
  await registerPushToken();
  expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalled();
  mockNotifications.getExpoPushTokenAsync.mockClear();
  mockApi.put.mockClear();
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
  await registerPushToken();
  expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  expect(mockApi.put).not.toHaveBeenCalled();
});

it('KB-496: upsert = PUT /api/notifications/tokens { token, platform, lang } — settings 미전송', async () => {
  await registerPushToken();
  expect(mockApi.put).toHaveBeenCalledTimes(1);
  const [path, body, opts] = mockApi.put.mock.calls[0] as [string, Record<string, unknown>, unknown];
  expect(path).toBe('/api/notifications/tokens');
  expect(opts).toBeUndefined(); // X-API-Version 1.1 = 전역 기본(client.ts) — 개별 지정 없음
  expect(body).toEqual({ token: 'ExponentPushToken[test]', platform: 'ios', lang: 'en' });
  expect(body).not.toHaveProperty('settings');
});

it('KB-496: 서버 upsert 실패(4xx/네트워크) = 비치명 — reject 미전파', async () => {
  mockApi.put.mockRejectedValueOnce(new Error('NETWORK: offline'));
  await expect(registerPushToken()).resolves.toBeUndefined();
});

it('P-268: 원격 토큰 발급 실패 = 비치명(reject 미전파 — 리마인더는 로컬이라 무관)', async () => {
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockNotifications.getExpoPushTokenAsync.mockRejectedValueOnce(new Error('APNs unavailable'));
  await expect(registerPushToken()).resolves.toBeUndefined(); // throw 없이 종료
  mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test]' });
});

it('딥링크 매핑 — HELPFUL=내 리뷰 · NUDGE=스캔 · REVIEW_REMINDER=작성 · 미지=무동작', () => {
  expect(routeForNotificationData({ type: 'HELPFUL' })).toBe('/profile/reviews');
  expect(routeForNotificationData({ type: 'NUDGE' })).toBe('/scan');
  expect(routeForNotificationData({ type: 'REVIEW_REMINDER', foodId: '7' })).toBe('/food/7/review');
  expect(routeForNotificationData({ type: 'UNKNOWN_FUTURE' })).toBeNull();
  expect(routeForNotificationData(undefined)).toBeNull();
});

it('알림 탭 구독 — 응답 data로 라우팅 콜백 + 포그라운드 핸들러 설정', () => {
  const onRoute = jest.fn();
  addNotificationTapListener(onRoute);
  expect(mockNotifications.setNotificationHandler).toHaveBeenCalled();
  const handler = mockNotifications.addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
  handler({ notification: { request: { content: { data: { type: 'HELPFUL' } } } } });
  expect(onRoute).toHaveBeenCalledWith('/profile/reviews');
});

it('KB-496(Codex #104 P1-1): 앱 시작 토큰 upsert = cleanup 직렬(소스 잠금) — 재설치 잔존 토큰으로 이전 회원에 기기 연결 금지', () => {
  const fs = require('fs') as typeof import('fs');
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
  // 첫 upsert는 cleanupDone 체인 안에서만
  expect(layout).toContain('cleanupDone.then(() => push.registerPushToken())');
  // 부트 effect 밖(푸시 effect 마운트 직후)의 즉시 호출 0 — 언어 변경 핸들러(onLang)만 허용
  expect(layout.match(/registerPushToken\(\)/g)).toHaveLength(2);
  expect(layout).not.toMatch(/^\s*void push\.registerPushToken\(\);/m);
});

it('Codex #109 10R: registerPushToken 진행 중 inflight = 1 — 콜드 스타트 OTA 정적 창 포함(KB-509)', async () => {
  const { inflightCount } = require('@/lib/net/inflight') as typeof import('@/lib/net/inflight');
  let resolvePerm!: (v: { status: string }) => void;
  mockNotifications.getPermissionsAsync.mockImplementation(() => new Promise((r) => { resolvePerm = r; }));
  expect(inflightCount()).toBe(0);
  const p = registerPushToken();
  expect(inflightCount()).toBe(1); // 세션 확인~권한 조회~토큰 upsert 왕복 = 정적 창에 보인다
  while (!resolvePerm) await Promise.resolve(); // KB-543: hasBeSession await 뒤에 권한 조회
  resolvePerm({ status: 'denied' }); // 조기 반환 경로도 dec 보장
  await p;
  expect(inflightCount()).toBe(0);
});
