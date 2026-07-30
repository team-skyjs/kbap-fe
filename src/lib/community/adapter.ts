/**
 * community/adapter.ts — 커뮤니티 데이터 접근의 **유일한** 격리 지점 (P-087).
 *
 * ⚠️ 스왑 지점: 현행 = 인메모리 목 스토어(store.ts, 인위 지연 포함). BE 커뮤니티
 * API 계약이 배포되면 **이 파일만** 실 호출(api.get/post/…)로 교체한다 — 훅·화면
 * 무변이 목표. 커서 페이징(hasNext/nextCursor)은 리뷰 keyset 문법 가정으로
 * 이미 계약 형태를 흉내내고 있다.
 */
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

export async function submitReport(target: ReportTarget, id: string, reason: ReportReason, note: string | null): Promise<void> {
  await delay();
  store.report(target, id, reason, note);
}

export async function blockUser(author: CommunityAuthor): Promise<void> {
  await delay(300);
  store.blockUser(author);
}

export async function unblockUser(id: string): Promise<void> {
  await delay();
  store.unblockUser(id);
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  await delay();
  return store.blockedUsers();
}
