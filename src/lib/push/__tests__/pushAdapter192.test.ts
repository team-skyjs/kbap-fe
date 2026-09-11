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
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { MAX: 7, HIGH: 6 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
};
jest.mock('expo-notifications', () => mockNotifications);
const mockApi = { put: jest.fn().mockResolvedValue(undefined) };
jest.mock('@/lib/api/client', () => ({ get api() { return mockApi; }, apiLang: () => 'en' }));
const mockSession = { hasBeSession: jest.fn().mockResolvedValue(true) };
jest.mock('@/lib/auth/beAuth', () => ({ get hasBeSession() { return mockSession.hasBeSession; } })); // 지연 접근(호이스팅)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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
    trigger: { seconds: number; channelId?: string };
  };
  expect(arg.content.data).toEqual({ type: 'REVIEW_REMINDER', foodId: '7' });
  expect(arg.trigger.seconds).toBe(REVIEW_REMINDER_SECONDS);
  expect(arg.trigger.channelId).toBe('activity'); // KB-498: 로컬 리마인더도 활동 채널(Android MAX)
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

it('KB-498 딥링크 매핑(9/12 결정) — 리마인더=음식 상세 · NEWS·MEAL_TIME=무동작 · HELPFUL·SCAN_SUGGESTION=임시 착지 · 구 이름·변형·미지=무동작', () => {
  expect(routeForNotificationData({ type: 'HELPFUL' })).toBe('/push-landing?type=HELPFUL'); // 착지 미정 — 임시 화면
  expect(routeForNotificationData({ type: 'SCAN_SUGGESTION' })).toBe('/push-landing?type=SCAN_SUGGESTION');
  expect(routeForNotificationData({ type: 'MEAL_TIME' })).toBeNull(); // 앱만 켜짐
  expect(routeForNotificationData({ type: 'REVIEW_REMINDER', foodId: '7' })).toBe('/food/7'); // 음식 상세
  expect(routeForNotificationData({ type: 'REVIEW_REMINDER', foodId: 7 })).toBe('/food/7'); // 숫자도 같은 경로
  expect(routeForNotificationData({ type: 'REVIEW_REMINDER' })).toBeNull(); // foodId 없음 = 이동 없음
  expect(routeForNotificationData({ type: 'NEWS' })).toBeNull(); // 알림함 열람용
  expect(routeForNotificationData({ type: 'NUDGE' })).toBeNull(); // 구 이름 — 호환 없음
  expect(routeForNotificationData({ type: 'NOTICE' })).toBeNull();
  expect(routeForNotificationData({ type: 'helpful' })).toBeNull(); // 대소문자
  expect(routeForNotificationData({ type: 'HELPFUL ' })).toBeNull(); // 공백
  expect(routeForNotificationData({ type: 'UNKNOWN_FUTURE' })).toBeNull();
  expect(routeForNotificationData(undefined)).toBeNull();
});

it('알림 탭 구독 — 응답 data로 라우팅 콜백 + 포그라운드 핸들러 설정', () => {
  const onRoute = jest.fn();
  addNotificationTapListener(onRoute);
  expect(mockNotifications.setNotificationHandler).toHaveBeenCalled();
  const handler = mockNotifications.addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
  handler({ notification: { request: { content: { data: { type: 'HELPFUL' } } } } });
  expect(onRoute).toHaveBeenCalledWith('/push-landing?type=HELPFUL', undefined); // KB-498: notificationId 없음 = undefined
});

it('KB-498: 탭 콜백 2번째 인자 = 서버 notificationId 그대로(형 변환 0) · 없으면 undefined · 경로 없는 유형도 (null, id)로 호출', () => {
  const onRoute = jest.fn();
  addNotificationTapListener(onRoute);
  const handler = mockNotifications.addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
  handler({ notification: { request: { identifier: 'r1', content: { data: { type: 'REVIEW_REMINDER', foodId: 7, notificationId: 456 } } } } });
  expect(onRoute).toHaveBeenLastCalledWith('/food/7', 456);
  handler({ notification: { request: { identifier: 'r2', content: { data: { type: 'REVIEW_REMINDER', foodId: 7, notificationId: '9' } } } } });
  expect(onRoute).toHaveBeenLastCalledWith('/food/7', '9'); // 문자열도 그대로 — 후속 작업이 판단
  handler({ notification: { request: { identifier: 'r3', content: { data: { type: 'REVIEW_REMINDER', foodId: 7 } } } } });
  expect(onRoute).toHaveBeenLastCalledWith('/food/7', undefined); // 구 서버·로컬 알림
  handler({ notification: { request: { identifier: 'r4', content: { data: { type: 'NEWS', notificationId: 3 } } } } });
  expect(onRoute).toHaveBeenLastCalledWith(null, 3); // Codex #149: 이동 없어도 id 전달(읽음 처리)
  handler({ notification: { request: { identifier: 'r5', content: { data: { type: 'MEAL_TIME', notificationId: 4 } } } } });
  expect(onRoute).toHaveBeenLastCalledWith(null, 4);
  handler({ notification: { request: { identifier: 'r6', content: { data: { type: 'UNKNOWN_FUTURE', notificationId: 5 } } } } });
  expect(onRoute).toHaveBeenLastCalledWith(null, 5); // 미지 유형도 탭 사실은 전달
  expect(onRoute).toHaveBeenCalledTimes(6);
});

it('KB-498: 콜드 스타트 = 마지막 응답 1회 전달 — 리스너로 같은 identifier가 또 와도 이중 전달 0 · identifier 없는 응답은 차단 없음', async () => {
  const cold = { notification: { request: { identifier: 'cold', content: { data: { type: 'REVIEW_REMINDER', foodId: 3, notificationId: 7 } } } } };
  mockNotifications.getLastNotificationResponseAsync.mockResolvedValueOnce(cold);
  const onRoute = jest.fn();
  addNotificationTapListener(onRoute);
  await new Promise((r) => setTimeout(r, 0)); // track(getLast…).then(emit)
  expect(onRoute).toHaveBeenCalledTimes(1);
  expect(onRoute).toHaveBeenCalledWith('/food/3', 7);
  const handler = mockNotifications.addNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
  handler(cold); // 일부 플랫폼: 부팅 탭이 리스너로도 전달
  expect(onRoute).toHaveBeenCalledTimes(1);
  handler({ notification: { request: { content: { data: { type: 'HELPFUL' } } } } });
  handler({ notification: { request: { content: { data: { type: 'HELPFUL' } } } } });
  expect(onRoute).toHaveBeenCalledTimes(3); // identifier 없음 = 매번 전달
});

it('KB-498: Android = activity(MAX)·news(HIGH) 채널 각 1회, 이름은 i18n 키 · default 채널 0 · 설정 실패해도 구독 진행 · iOS = 0회', () => {
  const os = jest.replaceProperty(Platform, 'OS', 'android');
  try {
    addNotificationTapListener(() => {});
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'activity',
      expect.objectContaining({ name: 'notif.activityGroup', importance: 7, sound: 'default' }),
    );
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'news',
      expect.objectContaining({ name: 'notif.newsGroup', importance: 6, sound: 'default' }),
    );
    const ids = mockNotifications.setNotificationChannelAsync.mock.calls.map((c: unknown[]) => c[0]);
    expect(ids).not.toContain('default'); // 중요도는 생성 후 불변 — default는 만들지 않는다
    const src = require('fs').readFileSync('src/lib/push/pushAdapter.ts', 'utf8') as string;
    expect(src).not.toMatch(/name:\s*'[A-Za-z ]+'/); // 채널 이름 하드코딩 0(10로케일 규약)
    mockNotifications.setNotificationChannelAsync.mockClear();
    mockNotifications.addNotificationResponseReceivedListener.mockClear();
    mockNotifications.setNotificationChannelAsync.mockRejectedValueOnce(new Error('channel boom'));
    const off = addNotificationTapListener(() => {});
    expect(typeof off).toBe('function');
    expect(mockNotifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1); // 부팅 무영향
  } finally {
    os.restore();
  }
  mockNotifications.setNotificationChannelAsync.mockClear();
  addNotificationTapListener(() => {});
  expect(mockNotifications.setNotificationChannelAsync).not.toHaveBeenCalled(); // iOS
});

it('KB-496(Codex #104 P1-1): 앱 시작 토큰 upsert = cleanup 직렬(소스 잠금) — 재설치 잔존 토큰으로 이전 회원에 기기 연결 금지', () => {
  const fs = require('fs') as typeof import('fs');
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
  // 첫 upsert는 cleanupDone 체인 안에서만
  expect(layout).toContain('cleanupDone.then(() => push.registerPushToken())');
  // 부트 effect 밖(푸시 effect 마운트 직후)의 즉시 호출 0 — 언어 변경 핸들러(onLang)만 허용
  expect(layout.match(/registerPushToken\(\)/g)).toHaveLength(2);
  expect(layout).not.toMatch(/^\s*void push\.registerPushToken\(\);/m);
  // KB-498: 콜백 href null(이동 없는 유형) 가드 — router.push(null) 금지
  expect(layout).toContain('if (href) router.push(href as Href)');
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
