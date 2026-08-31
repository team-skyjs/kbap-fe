/**
 * P-221(KB-39) prod 차단 → **P-268(KB-378) 전 채널 개방 후 = 킬스위치 가드**.
 *
 * 개방 후에도 안전장치는 유지된다: ① 플래그가 꺼지면(킬스위치) 어댑터의 모든
 * 표면이 no-op이어야 하고(= require 자체에 도달하지 않아야) ② expo-notifications
 * 정적 import가 어디에도 없어야 한다(구 런타임 방어선 — fp 정책상 도달 0이지만
 * 이중 방어). 이 스위트는 **플래그 off를 강제**해 그 계약을 실측한다.
 */
jest.mock('@/lib/flags', () => ({ FLAGS: { pushEnabled: false }, isProdChannel: () => true })); // = 킬스위치 off 강제
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));

// 네이티브 모듈이 "존재하더라도" 게이트가 닫혔으면 손대지 않아야 한다 —
// 호출되면 즉시 실패하도록 폭탄을 깔아둔다(구 런타임에선 이 require가 크래시).
const boom = () => {
  throw new Error('expo-notifications must NOT be touched on the prod channel');
};
jest.mock(
  'expo-notifications',
  () => ({
    get getPermissionsAsync() { return boom(); },
    get requestPermissionsAsync() { return boom(); },
    get scheduleNotificationAsync() { return boom(); },
    get cancelScheduledNotificationAsync() { return boom(); },
    get getExpoPushTokenAsync() { return boom(); },
    get addNotificationResponseReceivedListener() { return boom(); },
  }),
  { virtual: true },
);

import {
  addNotificationTapListener,
  cancelReviewReminder,
  getPermissionStatus,
  pushAvailable,
  registerPushToken,
  requestPermission,
  scheduleReviewReminder,
  unregisterPushToken,
} from '../pushAdapter';

it('플래그 off(킬스위치) = pushAvailable false', () => {
  expect(pushAvailable()).toBe(false);
});

it('권한 API = 요청 0 — 상태는 unavailable, 요청은 false', async () => {
  await expect(getPermissionStatus()).resolves.toBe('unavailable');
  await expect(requestPermission()).resolves.toBe(false);
});

it('리마인더 예약·취소 = no-op(모듈 미접근 — 크래시 0)', async () => {
  await expect(scheduleReviewReminder({ foodId: '7', name: 'Kimchi Stew' })).resolves.toBeUndefined();
  await expect(cancelReviewReminder('7')).resolves.toBeUndefined();
});

it('토큰 등록·해제 = no-op', async () => {
  await expect(registerPushToken()).resolves.toBeUndefined();
  await expect(unregisterPushToken()).resolves.toBeUndefined();
});

it('알림 탭 리스너 = 구독 0(해제 함수만 반환 — 호출해도 안전)', () => {
  const off = addNotificationTapListener(() => {});
  expect(typeof off).toBe('function');
  expect(() => off()).not.toThrow();
});

it('소스 잠금 — P-268 전 채널 개방 + expo-notifications 접근은 어댑터 지연 require 1곳뿐', () => {
  const fs = require('fs');
  const path = require('path') as typeof import('path');
  // P-268(KB-378): prod 개방 — 다른 채널 게이트(reviews·community 등)는 무변
  const flags = fs.readFileSync('src/lib/flags.ts', 'utf8') as string;
  expect(flags).toContain('pushEnabled: true');
  expect(flags).not.toContain('pushEnabled: !PROD_CHANNEL');
  // KB-403: reviews·reviewExtras·reviewPlace는 전 채널 공개로 전환(불변식 목록에서 제외)
  for (const gate of ['communityEnabled', 'dietPresetsEnabled']) {
    expect(flags).toContain(`${gate}: !PROD_CHANNEL`); // 타 게이트 무변(P-268 불변식)
  }
  expect(flags).toContain('reviewsEnabled: true'); // KB-403 공개(8/31 예진 확정)
  const adapter = fs.readFileSync('src/lib/push/pushAdapter.ts', 'utf8') as string;
  expect(adapter).toContain("require('expo-notifications')");
  expect(adapter).toContain('if (!FLAGS.pushEnabled) return null;'); // 게이트가 require보다 앞
  // 화면·훅의 정적 import 0 (구 런타임 OTA 크래시 방어선)
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }) as { name: string; isDirectory(): boolean }[]) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__') walk(p);
      } else if (/\.tsx?$/.test(e.name) && (fs.readFileSync(p, 'utf8') as string).includes("from 'expo-notifications'")) {
        offenders.push(p);
      }
    }
  };
  walk('src');
  expect(offenders).toEqual([]);
  // ⚠️ 대기 시간 상수는 QA 편의로 줄이지 않는다(발주 고정)
  expect(adapter).toContain('export const REVIEW_REMINDER_SECONDS = 3600;');
});
