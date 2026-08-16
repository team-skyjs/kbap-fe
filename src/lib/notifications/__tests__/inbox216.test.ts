/**
 * P-216(KB-39): 알림함 목 데이터 소스 — 목록·읽음 처리·뱃지 카운트,
 * 딥링크는 P-192 routeForNotificationData 재사용(신규 라우팅 로직 0) 잠금.
 */
jest.mock('@/lib/flags', () => ({ FLAGS: { notificationCenter: true }, isProdChannel: () => false }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
); // pushAdapter(라우팅 재사용) 로드 경유

import {
  _resetInboxForTest,
  fetchInbox,
  markAllInboxRead,
  markInboxRead,
  unreadCount,
} from '../inbox';
import { routeForNotificationData } from '@/lib/push/pushAdapter';

beforeEach(() => _resetInboxForTest());

it('목 4건 — 최신순·타입 3종 이상(도움됨·리마인더·공지) 포함', () => {
  const items = fetchInbox(1_000_000_000_000);
  expect(items).toHaveLength(4);
  const types = items.map((n) => n.data.type);
  expect(types).toEqual(expect.arrayContaining(['HELPFUL', 'REVIEW_REMINDER', 'NOTICE']));
  // 최신순(내림차순) — 화면이 정렬을 안 하므로 소스가 보장해야 한다
  const times = items.map((n) => new Date(n.at).getTime());
  expect([...times].sort((a, b) => b - a)).toEqual(times);
});

it('뱃지 카운트 = 안 읽은 수, 개별 읽음 처리 시 감소(멱등)', () => {
  const before = unreadCount(fetchInbox());
  expect(before).toBe(2);
  const first = fetchInbox().find((n) => !n.read)!;
  markInboxRead(first.id);
  expect(unreadCount(fetchInbox())).toBe(before - 1);
  markInboxRead(first.id); // 재호출 = 변화 없음
  expect(unreadCount(fetchInbox())).toBe(before - 1);
});

it('모두 읽음 = 0', () => {
  markAllInboxRead();
  expect(unreadCount(fetchInbox())).toBe(0);
});

it('딥링크 = P-192 라우팅 재사용 — 타입별 목적지(미지 타입은 무동작)', () => {
  const byType = Object.fromEntries(fetchInbox().map((n) => [n.data.type, routeForNotificationData(n.data)]));
  expect(byType.HELPFUL).toBe('/profile/reviews');
  expect(byType.REVIEW_REMINDER).toBe('/food/1/review');
  expect(byType.NUDGE).toBe('/scan');
  expect(byType.NOTICE).toBeNull(); // 공지 = 목적지 없음(화면 유지)
});

it('소스 잠금 — BE 스왑 지점 1곳·러프 명기·화면은 목 직접 생성 금지', () => {
  const fs = require('fs');
  const src = fs.readFileSync('src/lib/notifications/inbox.ts', 'utf8') as string;
  expect(src).toContain('로컬 목');
  expect(src).toContain('fetchInbox'); // 유일한 데이터 진입점
  const screen = fs.readFileSync('src/app/notifications.tsx', 'utf8') as string;
  expect(screen).toContain("from '@/lib/notifications/inbox'");
  expect(screen).not.toContain('mockInbox'); // 화면이 목을 직접 만들지 않는다
  expect(screen).toContain('routeForNotificationData');
  // prod 무노출(플래그 게이트)
  expect(screen).toContain('if (!FLAGS.notificationCenter) return <Redirect href="/" />;');
  expect(fs.readFileSync('src/lib/flags.ts', 'utf8')).toContain('notificationCenter: !PROD_CHANNEL');
});
