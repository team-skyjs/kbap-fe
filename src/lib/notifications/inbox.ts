/**
 * 알림함 데이터 소스 (P-216/KB-39 → P-289/KB-436 실알림 전용).
 *
 * P-289(예진 9/7): 목 4건 소멸 — **실제 발화된 로컬 알림만** 기록한다.
 * 저장 = AsyncStorage(`kbap.inbox.v1`) 영속(읽음 포함). 기록 시점 = 리마인더가
 * **발화될 때**(pushAdapter의 포그라운드 수신 리스너 + 재실행 회수 + 탭 응답) —
 * 예약 시점 아님. 중복 방지 = notification id 키.
 *
 * 서버 알림 계약이 오면 **fetchInbox() 한 곳만** 서버 페처로 스왑한다(화면·스토어
 * 코드 무변). 개념 구분(멘토 8/15): push(앱 밖) / notification(놓친 히스토리 =
 * 이 화면) / toast(앱 안 실시간).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/** 딥링크 payload는 푸시와 같은 스키마 — routeForNotificationData가 그대로 소비. */
export type InboxItem = {
  id: string;
  /** i18n 키(로컬 생성 항목 — 서버 스왑 시 서버 문자열로 교체) */
  titleKey: string;
  bodyKey: string;
  /** ISO — 목록 정렬·상대 시각 표시 */
  at: string;
  read: boolean;
  data: { type: 'HELPFUL' | 'REVIEW_REMINDER' | 'NUDGE' | 'NOTICE'; foodId?: string };
};

const STORE_KEY = 'kbap.inbox.v1';
const MAX_ITEMS = 100; // 로컬 상한 — 초과분은 오래된 것부터 드롭

/* ---- 스토어 (P-205 문법: 모듈 동기 상태 + useSyncExternalStore, AsyncStorage 영속) ---- */

let items: InboxItem[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist(): void {
  AsyncStorage.setItem(STORE_KEY, JSON.stringify(items)).catch(() => {});
}

/** 첫 구독/조회 시 1회 하이드레이트 — 실패 = 빈 목록(비치명). */
export function hydrateInbox(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (!hydrating) {
    hydrating = AsyncStorage.getItem(STORE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as InboxItem[];
          if (Array.isArray(parsed)) items = parsed;
        }
      })
      .catch(() => {})
      .then(() => {
        hydrated = true;
        emit();
      });
  }
  return hydrating;
}

/** 유일한 데이터 진입점 — 서버 계약 오면 여기만 fetch로 교체. */
export function fetchInbox(): InboxItem[] {
  if (!hydrated) void hydrateInbox();
  return items;
}

/** P-289: 발화된 알림 기록 — id 중복 = no-op(포그라운드/회수/응답 경로 중복 방지). */
export function recordInboxNotification(entry: {
  id: string;
  type: InboxItem['data']['type'];
  foodId?: string;
  at?: string;
}): void {
  if (!entry.id || items.some((n) => n.id === entry.id)) return;
  const KEYS: Record<InboxItem['data']['type'], { titleKey: string; bodyKey: string }> = {
    REVIEW_REMINDER: { titleKey: 'inbox.reminderTitle', bodyKey: 'inbox.reminderBody' },
    HELPFUL: { titleKey: 'inbox.helpfulTitle', bodyKey: 'inbox.helpfulBody' },
    NUDGE: { titleKey: 'inbox.nudgeTitle', bodyKey: 'inbox.nudgeBody' },
    NOTICE: { titleKey: 'inbox.noticeTitle', bodyKey: 'inbox.noticeBody' },
  };
  items = [
    {
      id: entry.id,
      ...KEYS[entry.type],
      at: entry.at ?? new Date().toISOString(),
      read: false,
      data: { type: entry.type, ...(entry.foodId != null ? { foodId: entry.foodId } : {}) },
    },
    ...items,
  ].slice(0, MAX_ITEMS);
  persist();
  emit();
}

export function markInboxRead(id: string): void {
  if (!items.some((n) => n.id === id && !n.read)) return;
  items = items.map((n) => (n.id === id ? { ...n, read: true } : n));
  persist();
  emit();
}

export function markAllInboxRead(): void {
  if (items.every((n) => n.read)) return;
  items = items.map((n) => (n.read ? n : { ...n, read: true }));
  persist();
  emit();
}

export function unreadCount(list: readonly InboxItem[]): number {
  return list.filter((n) => !n.read).length;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  void hydrateInbox();
  return () => listeners.delete(l);
}

/** 목록 — 최신순(기록이 unshift라 저장 순서 = 최신순). */
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
  items = [];
  hydrated = true;
  hydrating = null;
  emit();
}
