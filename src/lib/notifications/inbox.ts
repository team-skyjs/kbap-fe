/**
 * 알림함 데이터 소스 (P-216/KB-39) — **로컬 목**.
 *
 * ⚠️ BE 알림 목록 계약이 없어 화면 성립용 목 4건을 여기서 만든다. 계약이 오면
 * **이 파일 한 곳만** 서버 페처로 스왑한다(화면·스토어 코드 무변): fetchInbox()가
 * 유일한 데이터 진입점, 나머지는 읽음 상태 관리.
 *
 * 개념 구분(멘토 8/15): push(앱 밖) / **notification(놓친 히스토리 = 이 화면)** /
 * toast(앱 안 실시간). 이번 범위는 notification만.
 *
 * 읽음 상태는 세션 메모리(러프) — 재시작하면 초기화된다. 서버 계약에 read 필드가
 * 오면 여기서 서버값으로 대체.
 */
import { useSyncExternalStore } from 'react';

/** 딥링크 payload는 푸시와 같은 스키마 — routeForNotificationData가 그대로 소비. */
export type InboxItem = {
  id: string;
  /** i18n 키(목 데이터라 문구도 키로 — 서버 스왑 시 서버 문자열로 교체) */
  titleKey: string;
  bodyKey: string;
  /** ISO — 목록 정렬·상대 시각 표시 */
  at: string;
  read: boolean;
  data: { type: 'HELPFUL' | 'REVIEW_REMINDER' | 'NUDGE' | 'NOTICE'; foodId?: string };
};

/** 목 기준 시각 — 고정 오프셋(테스트 결정성). 서버 스왑 시 소멸. */
const H = 3600_000;
function mockInbox(now: number): InboxItem[] {
  return [
    {
      id: 'n1',
      titleKey: 'inbox.helpfulTitle',
      bodyKey: 'inbox.helpfulBody',
      at: new Date(now - 2 * H).toISOString(),
      read: false,
      data: { type: 'HELPFUL' },
    },
    {
      id: 'n2',
      titleKey: 'inbox.reminderTitle',
      bodyKey: 'inbox.reminderBody',
      at: new Date(now - 26 * H).toISOString(),
      read: false,
      data: { type: 'REVIEW_REMINDER', foodId: '1' },
    },
    {
      id: 'n3',
      titleKey: 'inbox.noticeTitle',
      bodyKey: 'inbox.noticeBody',
      at: new Date(now - 72 * H).toISOString(),
      read: true,
      data: { type: 'NOTICE' },
    },
    {
      id: 'n4',
      titleKey: 'inbox.nudgeTitle',
      bodyKey: 'inbox.nudgeBody',
      at: new Date(now - 120 * H).toISOString(),
      read: true,
      data: { type: 'NUDGE' },
    },
  ];
}

/* ---- 스토어 (P-205 문법: 모듈 동기 상태 + useSyncExternalStore) ---- */

let items: InboxItem[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** 유일한 데이터 진입점 — 서버 계약 오면 여기만 fetch로 교체. */
export function fetchInbox(now = Date.now()): InboxItem[] {
  if (items == null) items = mockInbox(now);
  return items;
}

export function markInboxRead(id: string): void {
  const cur = fetchInbox();
  if (!cur.some((n) => n.id === id && !n.read)) return;
  items = cur.map((n) => (n.id === id ? { ...n, read: true } : n));
  emit();
}

export function markAllInboxRead(): void {
  const cur = fetchInbox();
  if (cur.every((n) => n.read)) return;
  items = cur.map((n) => (n.read ? n : { ...n, read: true }));
  emit();
}

export function unreadCount(list: readonly InboxItem[]): number {
  return list.filter((n) => !n.read).length;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** 목록 — 최신순. */
export function useInbox(): InboxItem[] {
  return useSyncExternalStore(
    subscribe,
    () => fetchInbox(),
    () => fetchInbox(),
  );
}

/** 헤더 뱃지용 안 읽은 수. */
export function useUnreadCount(): number {
  return unreadCount(useInbox());
}

export function _resetInboxForTest(): void {
  items = null;
  emit();
}
