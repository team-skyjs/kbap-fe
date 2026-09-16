/**
 * notificationAdapter (KB-499) — 알림함 와이어 → 도메인.
 *
 * 계약 정본 = dev Swagger `NotificationResponse`(2026-09-16 반영): { id, type, foodId?, title, body, receivedAt(epoch ms), read }.
 * title/body는 발송 시점 기기 언어로 저장된 문자열 — 앱 가공 0(P-147 서버 정본).
 * `type`(필수)·`foodId`(REVIEW_REMINDER만, 그 외 null)는 푸시 data와 같은 어휘 — 와이어 타입은 구 응답·구 행도 깨지지 않게
 * 옵션으로 두고, 모르는 유형은 routeForNotificationData가 null을 돌려 이동하지 않는다.
 */
export interface NotificationWire {
  id: number;
  title: string;
  body: string;
  receivedAt: number;
  read: boolean;
  type?: string;
  foodId?: number | string | null;
}

export interface InboxItem {
  id: number;
  title: string;
  body: string;
  /** ISO 8601 — 화면은 community/parts.timeAgo(iso)로 상대 표기 */
  at: string;
  read: boolean;
  type?: string;
  foodId?: string;
}

export function toInboxItem(w: NotificationWire): InboxItem {
  // ponytail: receivedAt이 유한수가 아니면 현재 시각("방금 전") — 한 행 때문에 목록 전체가 RangeError로 깨지지 않게
  const at = Number.isFinite(w.receivedAt) ? new Date(w.receivedAt).toISOString() : new Date().toISOString();
  return {
    id: w.id,
    title: w.title,
    body: w.body,
    at,
    read: w.read,
    type: w.type,
    foodId: w.foodId != null ? String(w.foodId) : undefined,
  };
}
