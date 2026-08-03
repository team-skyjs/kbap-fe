/**
 * community/adapter.ts — 커뮤니티 데이터 접근의 **유일한** 격리 지점 (P-087).
 *
 * ⚠️ 스왑 지점: 현행 = 인메모리 목 스토어(store.ts, 인위 지연 포함). BE 커뮤니티
 * API 계약이 배포되면 **이 파일만** 실 호출(api.get/post/…)로 교체한다 — 훅·화면
 * 무변이 목표. 커서 페이징(hasNext/nextCursor)은 리뷰 keyset 문법 가정으로
 * 이미 계약 형태를 흉내내고 있다.
 */
import { api } from '@/lib/api/client';
import { FLAGS } from '@/lib/flags';
import * as store from './store';
import type {
  BlockedUser,
  CommunityAuthor,
  CommunityComment,
  CommunityPage,
  CommunityPost,
  FoodTagRef,
  PlaceTagRef,
  Reaction,
  ReportReason,
  ReportTarget,
} from './types';

/** 네트워크 감각용 인위 지연 — 스왑 시 소멸. */
const delay = (ms = 180) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchFeedPage(cursor: string | null): Promise<CommunityPage<CommunityPost>> {
  await delay();
  return store.feedPage(cursor);
}

export async function fetchPost(id: string): Promise<CommunityPost | null> {
  await delay();
  return store.getPost(id);
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  await delay();
  return store.commentsFor(postId);
}

export async function createPost(input: { body: string; photos: string[]; foodTags: FoodTagRef[]; placeTag: PlaceTagRef | null }): Promise<CommunityPost> {
  await delay();
  return store.addPost(input);
}

export async function updatePost(id: string, input: { body: string; photos: string[]; foodTags: FoodTagRef[]; placeTag: PlaceTagRef | null }): Promise<void> {
  await delay();
  store.updatePost(id, input);
}

export async function deletePost(id: string): Promise<void> {
  await delay();
  store.deletePost(id);
}

export async function createComment(input: { postId: string; parentId: string | null; mention: string | null; body: string }): Promise<CommunityComment> {
  await delay();
  return store.addComment(input);
}

export async function updateComment(id: string, body: string): Promise<void> {
  await delay();
  store.updateComment(id, body);
}

export async function deleteComment(id: string): Promise<void> {
  await delay();
  store.deleteComment(id);
}

export async function reactToPost(id: string, r: Exclude<Reaction, null>): Promise<void> {
  store.reactToPost(id, r); // 리액션은 즉각 반영 감각 — 지연 없음
}

export async function reactToComment(id: string, r: Exclude<Reaction, null>): Promise<void> {
  store.reactToComment(id, r);
}

/** P-108: UI 사유 → BE enum (8/3 계약 고정 매핑). */
const REPORT_REASON_WIRE: Record<ReportReason, string> = {
  spam: 'SPAM',
  harassment: 'ABUSE',
  inappropriate: 'SEXUAL',
  misinfo: 'FALSE_INFO',
  other: 'OTHER',
};

export async function submitReport(target: ReportTarget, id: string, reason: ReportReason, note: string | null): Promise<void> {
  // P-108: **리뷰 신고만 실 API** — 계약 targetType이 REVIEW뿐(POST/COMMENT는 BE 후속, 커뮤니티는 목 유지)
  if (target === 'review' && FLAGS.reviewsLiveEnabled) {
    await api.post('/reports', {
      targetType: 'REVIEW',
      targetId: Number(id),
      reason: REPORT_REASON_WIRE[reason],
      ...(note ? { detail: note } : {}), // FE 300자 상한 유지 (계약 상한 500 내)
    });
    return;
  }
  await delay();
  store.report(target, id, reason, note);
}

/** 실 회원 id 판별 — 커뮤니티 목 스토어의 시드 작성자('u2' 등)는 BE에 없는 가짜 id. */
const isRealMemberId = (id: string) => /^\d+$/.test(id);

export async function blockUser(author: CommunityAuthor): Promise<void> {
  // P-108: 실 차단(BE 필터가 진실). **목 스토어 로컬 차단은 병행 유지** — 커뮤니티
  // 목 피드/댓글 필터용(실 차단과 별개). 목 시드 작성자(비수치 id)는 로컬만.
  if (FLAGS.reviewsLiveEnabled && isRealMemberId(author.id)) {
    await api.post('/members/me/blocks', { memberId: Number(author.id) });
    store.blockUser(author);
    return;
  }
  await delay(300);
  store.blockUser(author);
}

export async function unblockUser(id: string): Promise<void> {
  if (FLAGS.reviewsLiveEnabled && isRealMemberId(id)) {
    await api.del(`/members/me/blocks/${id}`);
    store.unblockUser(id);
    return;
  }
  await delay();
  store.unblockUser(id);
}

/** GET /members/me/blocks 와이어 — 닉네임·프로필 null 방어 (BlockedMemberResponse). */
interface BlockedMemberWire {
  memberId: number;
  nickname?: string | null;
  profileImageUrl?: string | null;
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  if (FLAGS.reviewsLiveEnabled) {
    const wire = await api.get<BlockedMemberWire[]>('/members/me/blocks');
    const live: BlockedUser[] = (wire ?? []).map((w) => ({
      id: String(w.memberId),
      nickname: w.nickname ?? null, // null = 미설정/탈퇴 → 화면 익명 표시
      nationality: null, // 계약 미제공 — 모노그램 폴백
    }));
    // 커뮤니티 목 로컬 차단 병행 노출(해제 동선 보장) — id 충돌 시 실값 우선
    const local = store.blockedUsers().filter((b) => !live.some((l) => l.id === b.id));
    return [...live, ...local];
  }
  await delay();
  return store.blockedUsers();
}
