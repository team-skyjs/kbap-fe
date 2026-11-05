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

export function adaptChatMessage(w: ChatMessageWire): ChatMessage {
  return {
    id: String(w.id),
    role: w.authorRole === 'USER' ? 'user' : 'operator',
    content: typeof w.content === 'string' ? w.content : '',
    imageUrls: Array.isArray(w.imageUrls) ? w.imageUrls.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)) : [],
    createdAt: typeof w.createdAt === 'string' ? w.createdAt : '',
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
  return { count: n, last: lm && typeof lm.content === 'string' && lm.content ? { content: lm.content, createdAt: lm.createdAt ?? '' } : null };
}
