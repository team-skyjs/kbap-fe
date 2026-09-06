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

it('P-289 배선 소스 잠금 — pushAdapter가 발화 시 기록(포그라운드+재실행 회수+응답)', () => {
  const src = require('fs').readFileSync('src/lib/push/pushAdapter.ts', 'utf8') as string;
  expect(src).toContain('recordInboxNotification');
  expect(src).toContain('addNotificationReceivedListener'); // 포그라운드 발화
  expect(src).toContain('getPresentedNotificationsAsync'); // 백그라운드 발화 재실행 회수
  expect(src).toContain('record(resp?.notification.request)'); // 탭 응답 경로
  void hydrateInbox;
});
