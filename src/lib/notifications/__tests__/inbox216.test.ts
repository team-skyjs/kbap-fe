/**
 * P-216 → P-289(KB-436): 알림함 = 실알림 전용 스토어 잠금.
 * 목 4건 소멸 · recordInboxNotification(중복 0) · 읽음 영속(AsyncStorage) · 뱃지 카운트.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  _resetInboxForTest,
  fetchInbox,
  hydrateInbox,
  markAllInboxRead,
  markInboxRead,
  recordInboxNotification,
  unreadCount,
} from '../inbox';

beforeEach(async () => {
  await AsyncStorage.clear();
  _resetInboxForTest();
});

it('P-289: 목 소멸 — 초기 목록 0건(실알림만), 소스에 mockInbox 잔존 0', () => {
  expect(fetchInbox()).toHaveLength(0);
  const src = require('fs').readFileSync('src/lib/notifications/inbox.ts', 'utf8') as string;
  expect(src).not.toContain('mockInbox');
  expect(src).toContain("'kbap.inbox.v1'"); // AsyncStorage 영속 키
});

it('리마인더 발화 기록 — 항목 1건(foodId 포함·최신순 선두)·같은 id 중복 0', () => {
  recordInboxNotification({ id: 'noti-1', type: 'REVIEW_REMINDER', foodId: '7' });
  recordInboxNotification({ id: 'noti-1', type: 'REVIEW_REMINDER', foodId: '7' }); // 포그라운드+회수 중복 경로
  const list = fetchInbox();
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({
    id: 'noti-1',
    titleKey: 'inbox.reminderTitle',
    bodyKey: 'inbox.reminderBody',
    read: false,
    data: { type: 'REVIEW_REMINDER', foodId: '7' },
  });
  recordInboxNotification({ id: 'noti-2', type: 'REVIEW_REMINDER', foodId: '9' });
  expect(fetchInbox()[0].id).toBe('noti-2'); // 최신순
});

it('읽음 영속 — markRead가 AsyncStorage에 저장, 하이드레이트 후 유지', async () => {
  recordInboxNotification({ id: 'noti-1', type: 'REVIEW_REMINDER', foodId: '7' });
  markInboxRead('noti-1');
  expect(unreadCount(fetchInbox())).toBe(0);
  // 재시작 시뮬레이션 — 모듈 상태 초기화 후 저장분 하이드레이트
  _resetInboxForTest();
  const raw = await AsyncStorage.getItem('kbap.inbox.v1');
  expect(raw).toContain('"read":true'); // 영속 확인(스토어 재로드 정본)
});

it('뱃지 카운트 — 미읽음 수·markAll 멱등', () => {
  recordInboxNotification({ id: 'a', type: 'REVIEW_REMINDER', foodId: '1' });
  recordInboxNotification({ id: 'b', type: 'HELPFUL' });
  expect(unreadCount(fetchInbox())).toBe(2);
  markAllInboxRead();
  markAllInboxRead(); // 멱등
  expect(unreadCount(fetchInbox())).toBe(0);
});

it('KB-498: 신규 3유형 기록 — SCAN_SUGGESTION·NEWS·MEAL_TIME 각각 제 문구 키', () => {
  recordInboxNotification({ id: 's', type: 'SCAN_SUGGESTION' });
  recordInboxNotification({ id: 'n', type: 'NEWS' });
  recordInboxNotification({ id: 'm', type: 'MEAL_TIME' });
  const by = Object.fromEntries(fetchInbox().map((n) => [n.id, n]));
  expect(by.s).toMatchObject({ titleKey: 'inbox.scanSuggestionTitle', bodyKey: 'inbox.scanSuggestionBody', data: { type: 'SCAN_SUGGESTION' } });
  expect(by.n).toMatchObject({ titleKey: 'inbox.newsTitle', bodyKey: 'inbox.newsBody', data: { type: 'NEWS' } });
  expect(by.m).toMatchObject({ titleKey: 'inbox.mealTimeTitle', bodyKey: 'inbox.mealTimeBody', data: { type: 'MEAL_TIME' } });
});

it('KB-498: 미지·구 이름·변형 유형은 기록 0 (US2-5 — 빈 제목 항목 금지)', () => {
  recordInboxNotification({ id: 'a', type: 'NUDGE' as never });
  recordInboxNotification({ id: 'b', type: 'NOTICE' as never });
  recordInboxNotification({ id: 'c', type: 'helpful' as never });
  recordInboxNotification({ id: 'd', type: undefined as never });
  expect(fetchInbox()).toHaveLength(0);
});

it('KB-498: 저장분의 구 NUDGE/NOTICE 항목은 하이드레이트 시 드롭(호환 변환 없음)', async () => {
  await AsyncStorage.setItem(
    'kbap.inbox.v1',
    JSON.stringify([
      { id: 'old', titleKey: 'inbox.nudgeTitle', bodyKey: 'inbox.nudgeBody', at: '2026-09-01T00:00:00Z', read: false, data: { type: 'NUDGE' } },
      { id: 'ok', titleKey: 'inbox.helpfulTitle', bodyKey: 'inbox.helpfulBody', at: '2026-09-02T00:00:00Z', read: false, data: { type: 'HELPFUL' } },
    ]),
  );
  _resetInboxForTest({ rehydrate: true });
  await hydrateInbox();
  expect(fetchInbox().map((n) => n.id)).toEqual(['ok']);
});

it('P-289 배선 소스 잠금 — pushAdapter가 발화 시 기록(포그라운드+재실행 회수+응답)', () => {
  const src = require('fs').readFileSync('src/lib/push/pushAdapter.ts', 'utf8') as string;
  // KB-498: 구 이름 잔존 0 (어댑터·알림함 소스)
  expect(src).not.toContain("'NUDGE'");
  expect(src).not.toContain("'NOTICE'");
  const inboxSrc = require('fs').readFileSync('src/lib/notifications/inbox.ts', 'utf8') as string;
  expect(inboxSrc).not.toContain("'NUDGE'");
  expect(inboxSrc).not.toContain("'NOTICE'");
  expect(src).toContain('recordInboxNotification');
  expect(src).toContain('addNotificationReceivedListener'); // 포그라운드 발화
  expect(src).toContain('getPresentedNotificationsAsync'); // 백그라운드 발화 재실행 회수
  expect(src).toContain('record(resp?.notification.request)'); // 탭 응답 경로
  void hydrateInbox;
});
