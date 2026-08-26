/**
 * P-192: pushAdapter 로직 — 플래그 on 가정(모듈 목)에서 설정 저장·동의 스탬프·
 * 프라이머 기록·로컬 예약/취소·딥링크 매핑·탭 구독. 플래그 off 무동작은
 * pushSurfaces192 스위트(실 플래그)가 잠근다.
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addNotificationTapListener,
  cancelReviewReminder,
  getPrimerResult,
  getPushSettings,
  markPrimerResult,
  registerPushToken,
  REVIEW_REMINDER_SECONDS,
  routeForNotificationData,
  savePushSettings,
  scheduleReviewReminder,
} from '../pushAdapter';

beforeEach(async () => {
  jest.clearAllMocks();
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  await AsyncStorage.clear();
});

it('설정 기본값 — helpful·리마인더 on, 넛지 off(광고성 옵트인)', async () => {
  const s = await getPushSettings();
  expect(s).toMatchObject({ helpful: true, reviewReminder: true, nudge: false, nudgeOptInAt: null });
});

it('넛지 off→on 전환 시 동의 일시 스탬프(정보통신망법 기록) — off 복귀에도 보존', async () => {
  const on = await savePushSettings({ helpful: true, reviewReminder: true, nudge: true });
  expect(typeof on.nudgeOptInAt).toBe('string'); // ISO 스탬프
  const off = await savePushSettings({ helpful: true, reviewReminder: true, nudge: false });
  expect(off.nudgeOptInAt).toBe(on.nudgeOptInAt); // 기록 보존
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

it('수신 설정 off = 예약 안 함 · OS 권한 없음 = 예약 안 함', async () => {
  await savePushSettings({ helpful: true, reviewReminder: false, nudge: false });
  await scheduleReviewReminder({ foodId: '7', name: 'Kimbap' });
  expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  await savePushSettings({ helpful: true, reviewReminder: true, nudge: false });
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
  await scheduleReviewReminder({ foodId: '7', name: 'Kimbap' });
  expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('토큰 upsert — 권한 granted면 발급, 아니면 조용히 스킵(게스트 포함)', async () => {
  await registerPushToken();
  expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalled();
  mockNotifications.getExpoPushTokenAsync.mockClear();
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
  await registerPushToken();
  expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
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
