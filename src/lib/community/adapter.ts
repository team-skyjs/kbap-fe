/**
 * community/adapter.ts — 커뮤니티 데이터 접근의 **유일한** 격리 지점.
 *
 * P-142: 목 스토어 철거 → 실 API(BE #129~132, dev 8/10 배포). 훅·화면 무변.
 * - 글: GET/POST /community/posts · GET/PUT/DELETE /community/posts/{id}
 *   (피드·상세 lang **하드 필수** — 누락 400 실확인)
 * - 댓글: GET/POST /community/posts/{id}/comments (cursor) ·
 *   PUT/DELETE /community/comments/{id} — 응답 replies 1뎁스 = FE 1뎁스 정합.
 *   멘션 필드는 계약 부재 → 전송 드롭·표시 소멸(보고 명기).
 * - 사진: COMMUNITY purpose 업로드 → imagePaths(전송)·imageUrls(조회) —
 *   수정 시 기존 CDN URL은 imageUrlToPath 역변환(리뷰 규약 공유).
 * - 계약 부재 표면(임의 구현 금지): 리액션 토글·장소 태그·커뮤니티 신고 —
 *   FLAGS.community* off + placeTag 항상 null. 차단은 멤버 단위 기존 API 연결.
 */
import { api, apiLang } from '@/lib/api/client';
import { FLAGS } from '@/lib/flags';
import { uploadImage } from '@/lib/api/scanImage';
import { imageUrlToPath } from '@/lib/api/reviewAdapter';
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

/* ---- wire 타입 (스웨거 2f6ef1d 스냅샷) ---- */

interface AuthorWire {
  memberId: number;
  nickname?: string | null;
  profileImageUrl?: string | null;
}

interface PostItemWire {
  postId: number;
  author?: AuthorWire | null; // null = 탈퇴 회원 방어
  content?: string | null;
  imageUrls?: string[] | null;
  foodTags?: { foodId: number; name: string }[] | null;
  likeCount?: number | null;
  dislikeCount?: number | null;
  commentCount?: number | null;
  createdAt?: string | null;
}

interface PostPageWire {
  items?: PostItemWire[] | null;
  hasNext?: boolean;
  nextCursor?: string | null;
}

interface CommentReplyWire {
  commentId: number;
  author?: AuthorWire | null;
  content?: string | null;
  createdAt?: string | null;
  editedAt?: string | null;
}

interface CommentItemWire extends CommentReplyWire {
  replies?: CommentReplyWire[] | null;
}

interface CommentPageWire {
  items?: CommentItemWire[] | null;
  hasNext?: boolean;
  nextCursor?: string | null;
}

const adaptAuthor = (w: AuthorWire | null | undefined): CommunityAuthor => ({
  id: w ? String(w.memberId) : '',
  nickname: w?.nickname ?? null, // null = 탈퇴 → 화면 익명 표시
  nationality: null, // 계약 미제공 — 모노그램 폴백
  profileImageUrl: w?.profileImageUrl ?? null,
});

const adaptPost = (w: PostItemWire): CommunityPost => ({
  id: String(w.postId),
  author: adaptAuthor(w.author),
  body: w.content ?? '',
  photos: w.imageUrls ?? [],
  foodTags: (w.foodTags ?? []).map((f) => ({ foodId: String(f.foodId), name: f.name })),
  placeTag: null, // 계약 부재 (foodTags만) — UI도 플래그 off
  likes: w.likeCount ?? 0,
  dislikes: w.dislikeCount ?? 0,
  myReaction: null, // 토글 API 부재 — 표시 전용
  commentCount: w.commentCount ?? 0,
  createdAt: w.createdAt ?? new Date(0).toISOString(),
});

export async function fetchFeedPage(cursor: string | null): Promise<CommunityPage<CommunityPost>> {
  const q = new URLSearchParams({ lang: apiLang() });
  if (cursor) q.set('cursor', cursor);
  const page = await api.get<PostPageWire>(`/community/posts?${q.toString()}`);
  return {
    items: (page?.items ?? []).map(adaptPost),
    hasNext: page?.hasNext ?? false,
    nextCursor: page?.nextCursor ?? null,
  };
}

export async function fetchPost(id: string): Promise<CommunityPost | null> {
  const w = await api.get<PostItemWire>(`/community/posts/${id}?lang=${apiLang()}`);
  return w ? adaptPost(w) : null;
}

/** 로컬 사진 → COMMUNITY purpose 업로드 path · 기존 CDN URL → path 역변환(수정 유지분). */
async function resolveImagePaths(photos: string[]): Promise<string[]> {
  const paths: string[] = [];
  for (const uri of photos) {
    if (uri.startsWith('http')) paths.push(imageUrlToPath(uri));
    else paths.push((await uploadImage({ uri, width: 0, height: 0 }, 'COMMUNITY')).path);
  }
  return paths;
}

const postBody = async (input: { body: string; photos: string[]; foodTags: FoodTagRef[]; placeTag: PlaceTagRef | null }) => ({
  content: input.body,
  imagePaths: await resolveImagePaths(input.photos),
  foodIds: input.foodTags.map((f) => Number(f.foodId)),
  // placeTag: 계약 부재 — 전송 필드 없음(임의 구현 금지)
});

export async function createPost(input: { body: string; photos: string[]; foodTags: FoodTagRef[]; placeTag: PlaceTagRef | null }): Promise<CommunityPost> {
  const w = await api.post<PostItemWire>('/community/posts', await postBody(input));
  // 작성 응답(PostingResponse)은 목록형과 필드가 달라 최소 매핑 — 화면은 무효화 재조회가 진실
  return adaptPost(w ?? { postId: 0 });
}

export async function updatePost(id: string, input: { body: string; photos: string[]; foodTags: FoodTagRef[]; placeTag: PlaceTagRef | null }): Promise<void> {
  await api.put(`/community/posts/${id}`, await postBody(input));
}

export async function deletePost(id: string): Promise<void> {
  await api.del(`/community/posts/${id}`);
}

/** 댓글 전량 취득 — cursor 루프(1뎁스 replies 포함 평탄화). 댓글 볼륨 가정 하 캡 20페이지. */
export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const out: CommunityComment[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const q = new URLSearchParams();
    if (cursor) q.set('cursor', cursor);
    const qs = q.toString();
    const page: CommentPageWire | null = await api.get<CommentPageWire>(
      `/community/posts/${postId}/comments${qs ? `?${qs}` : ''}`,
    );
    for (const c of page?.items ?? []) {
      out.push(adaptComment(c, postId, null));
      for (const r of c.replies ?? []) out.push(adaptComment(r, postId, String(c.commentId)));
    }
    if (!page?.hasNext || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

const adaptComment = (w: CommentReplyWire, postId: string, parentId: string | null): CommunityComment => ({
  id: String(w.commentId),
  postId,
  parentId,
  mention: null, // 계약 부재 — 멘션 표시 소멸(보고 명기)
  author: adaptAuthor(w.author),
  body: w.content ?? '',
  likes: 0, // 댓글 카운트 계약 부재
  dislikes: 0,
  myReaction: null,
  createdAt: w.createdAt ?? new Date(0).toISOString(),
});

export async function createComment(input: { postId: string; parentId: string | null; mention: string | null; body: string }): Promise<CommunityComment> {
  // mention은 계약 부재 — 드롭(대댓글 소속은 parentCommentId가 표현)
  const w = await api.post<CommentReplyWire>(`/community/posts/${input.postId}/comments`, {
    content: input.body,
    ...(input.parentId ? { parentCommentId: Number(input.parentId) } : {}),
  });
  return adaptComment(w ?? { commentId: 0 }, input.postId, input.parentId);
}

export async function updateComment(id: string, body: string): Promise<void> {
  await api.put(`/community/comments/${id}`, { content: body });
}

export async function deleteComment(id: string): Promise<void> {
  await api.del(`/community/comments/${id}`);
}

/* ---- 계약 부재 표면 — UI는 FLAGS.communityReactionsEnabled off로 미노출 ---- */

export async function reactToPost(_id: string, _r: Exclude<Reaction, null>): Promise<void> {
  console.log('[community] reaction API 부재 — 플래그 off 표면 (도달 불가 경로)');
}

export async function reactToComment(_id: string, _r: Exclude<Reaction, null>): Promise<void> {
  console.log('[community] reaction API 부재 — 플래그 off 표면 (도달 불가 경로)');
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
  // /reports targetType = REVIEW뿐(8/10 스웨거 실확인) — 커뮤니티 신고 UI는 플래그 off
  if (target !== 'review') {
    console.log('[community] 신고 targetType 미지원(REVIEW뿐) — 플래그 off 표면 (도달 불가 경로)');
    return;
  }
  try {
    await api.post('/reports', {
      targetType: 'REVIEW',
      targetId: Number(id),
      reason: REPORT_REASON_WIRE[reason],
      ...(note ? { detail: note } : {}), // FE 300자 상한 유지 (계약 상한 500 내)
    });
  } catch (e) {
    // P-186: 중복 신고 방어 — 409(이미 접수)는 멱등 취급(접수 확인 UX 유지), 그 외 전파
    if ((e as { status?: number })?.status === 409) {
      console.log('[report] 중복 신고(409) — 기접수 멱등 처리');
      return;
    }
    throw e;
  }
}

/* ---- 차단 — 멤버 단위 기존 API(리뷰와 공유), 커뮤니티 작성자도 실 memberId ---- */

export async function blockUser(author: CommunityAuthor): Promise<void> {
  await api.post('/members/me/blocks', { memberId: Number(author.id) });
}

export async function unblockUser(id: string): Promise<void> {
  await api.del(`/members/me/blocks/${id}`);
}

/** GET /members/me/blocks 와이어 — 닉네임·프로필 null 방어 (BlockedMemberResponse). */
interface BlockedMemberWire {
  memberId: number;
  nickname?: string | null;
  profileImageUrl?: string | null;
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const wire = await api.get<BlockedMemberWire[]>('/members/me/blocks');
  return (wire ?? []).map((w) => ({
    id: String(w.memberId),
    nickname: w.nickname ?? null, // null = 미설정/탈퇴 → 화면 익명 표시
    nationality: null, // 계약 미제공 — 모노그램 폴백
  }));
}
