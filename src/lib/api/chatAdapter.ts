/**
 * KB-1008 운영진 1:1 채팅 — 와이어 ↔ 앱 모델(S-971 계약 v0, 서버 dev 배포 뒤 Swagger 정본).
 * 와이어 변환은 이 어댑터 층에만(AGENTS.md 어댑터 격리).
 */

export interface ChatMessageWire {
  id: number | string;
  authorRole?: string | null; // USER | OPERATOR
  content?: string | null;
  imageUrls?: string[] | null;
  createdAt?: string | null;
  legacyFeedbackId?: number | string | null; // 지난 문의에서 온 메시지
}

export interface ChatPageWire {
  conversationId?: number | string | null;
  items?: ChatMessageWire[] | null; // 최신 → 과거
  nextCursor?: number | string | null;
  hasMore?: boolean;
}

export interface ChatUnreadWire {
  unreadCount?: number | null;
  lastOperatorMessage?: { content?: string | null; createdAt?: string | null } | null;
}

export interface ChatMessage {
  id: string;
  /** 운영진(K-Bap 팀) = 왼쪽, 나 = 오른쪽. 미지 역할 = 운영진(내가 쓰지 않은 글을 내 말풍선으로 그리지 않는다) */
  role: 'user' | 'operator';
  content: string;
  imageUrls: string[];
  createdAt: string;
  /** 지난 문의 이력 — 화면이 가볍게 구분 */
  legacy: boolean;
}

export interface ChatPage {
  conversationId: string | null;
  items: ChatMessage[]; // 최신 → 과거(inverted 목록이 그대로 그린다)
  nextCursor: string | null;
}

export interface ChatUnread {
  count: number;
  last: { content: string; createdAt: string } | null;
}

/** QA #441(9시간 어긋남): 서버 채팅 시각이 오프셋 없는 ISO(UTC)로 와서 new Date()가 기기 로컬로 읽었다.
 *  채팅 시각 필드에 한해 **오프셋 없는 날짜시각 = UTC**로 읽는다(Z를 붙인다). 오프셋·Z가 있으면 그대로 — 서버가 오프셋 포함으로 바뀌어도 맞다 */
export function chatTimeIso(v: string | null | undefined): string {
  if (typeof v !== 'string' || !v) return '';
  return /T\d{2}:\d{2}/.test(v) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(v) ? `${v}Z` : v;
}

export function adaptChatMessage(w: ChatMessageWire): ChatMessage {
  return {
    id: String(w.id),
    role: w.authorRole === 'USER' ? 'user' : 'operator',
    content: typeof w.content === 'string' ? w.content : '',
    imageUrls: Array.isArray(w.imageUrls) ? w.imageUrls.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)) : [],
    createdAt: chatTimeIso(w.createdAt),
    legacy: w.legacyFeedbackId != null,
  };
}

export function adaptChatPage(w: ChatPageWire | null | undefined): ChatPage {
  const items = (w?.items ?? []).filter((m) => m && m.id != null).map(adaptChatMessage);
  return {
    conversationId: w?.conversationId != null ? String(w.conversationId) : null,
    items,
    // hasMore=false면 커서가 와도 더 부르지 않는다
    nextCursor: w?.hasMore && w.nextCursor != null ? String(w.nextCursor) : null,
  };
}

export function adaptChatUnread(w: ChatUnreadWire | null | undefined): ChatUnread {
  const n = typeof w?.unreadCount === 'number' && Number.isFinite(w.unreadCount) ? Math.max(0, Math.floor(w.unreadCount)) : 0;
  const lm = w?.lastOperatorMessage;
  return { count: n, last: lm && typeof lm.content === 'string' && lm.content ? { content: lm.content, createdAt: chatTimeIso(lm.createdAt) } : null };
}
