/**
 * feedbackAdapter — 문의(피드백) 와이어 → 앱 모델 (P-394/KB-586).
 *
 * 계약: `specs/admin-rebuild/feedback-contract.md` §2. 와이어 형식 변환은 이 층에만 둔다
 * (AGENTS.md 어댑터 격리 — 쿼리 오케스트레이션과 계약 강제를 섞지 않는다).
 */

export type FeedbackStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

export interface FeedbackReply {
  id: string;
  content: string;
  createdAt: string;
}

export interface FeedbackItem {
  id: string;
  content: string;
  imageUrls: string[];
  status: FeedbackStatus;
  createdAt: string;
  replies: FeedbackReply[];
}

export interface ReplyWire {
  id?: number | string;
  content?: string | null;
  createdAt?: string | null;
}

export interface FeedbackWire {
  id?: number | string;
  content?: string | null;
  imageUrls?: (string | null)[] | null;
  status?: string | null;
  createdAt?: string | null;
  replies?: ReplyWire[] | null;
}

export interface FeedbackPageWire {
  items?: FeedbackWire[] | null;
  nextCursor?: string | null;
}

const STATUSES: FeedbackStatus[] = ['OPEN', 'ANSWERED', 'CLOSED'];

/** 서버 상태 문자열 → enum. 모르는 값은 OPEN 취급(칩이 비지 않게 — 목록은 계속 읽힌다). */
export function adaptFeedbackStatus(raw: string | null | undefined): FeedbackStatus {
  return STATUSES.includes(raw as FeedbackStatus) ? (raw as FeedbackStatus) : 'OPEN';
}

export function adaptFeedback(w: FeedbackWire): FeedbackItem {
  return {
    id: String(w.id ?? ''),
    content: w.content ?? '',
    imageUrls: (w.imageUrls ?? []).filter((u): u is string => !!u && /^https?:\/\//.test(u)),
    status: adaptFeedbackStatus(w.status),
    createdAt: w.createdAt ?? '',
    replies: (w.replies ?? [])
      .filter((r): r is ReplyWire => !!r)
      .map((r) => ({ id: String(r.id ?? ''), content: r.content ?? '', createdAt: r.createdAt ?? '' })),
  };
}

export function adaptFeedbackPage(wire: FeedbackPageWire): { items: FeedbackItem[]; nextCursor: string | null } {
  return { items: (wire.items ?? []).map(adaptFeedback), nextCursor: wire.nextCursor ?? null };
}
