/**
 * community/types.ts — 커뮤니티 내부 타입 (P-087/KB-251 목 선작업).
 * BE 계약 미정 — 커서 페이징(hasNext/nextCursor)은 리뷰 keyset 문법 가정.
 * 계약 배포 시 wire 타입은 adapter에 추가되고 이 내부 타입은 유지가 목표.
 */
export type Reaction = 'like' | 'dislike' | null;

export interface CommunityAuthor {
  id: string;
  nickname: string | null; // null = 탈퇴한 사용자 (content 유지 + 기본 프로필)
  nationality: string | null;
}

export interface FoodTagRef {
  foodId: string;
  name: string;
}

export interface PlaceTagRef {
  name: string;
  roadAddress: string;
}

export interface CommunityPost {
  id: string;
  author: CommunityAuthor;
  body: string;
  photos: string[]; // 최대 4 — [0] = 커버
  foodTags: FoodTagRef[]; // 최대 3
  placeTag: PlaceTagRef | null; // 최대 1
  likes: number;
  dislikes: number;
  myReaction: Reaction;
  commentCount: number;
  createdAt: string; // ISO
}

export interface CommunityComment {
  id: string;
  postId: string;
  /** null = 최상위. 값 = 소속 최상위 댓글 id (1뎁스 고정 — 유튜브식). */
  parentId: string | null;
  /** 대댓글에 답글 시 원 작성자 멘션 (primary 색 텍스트, 탭 무동작). */
  mention: string | null;
  author: CommunityAuthor;
  body: string;
  likes: number;
  dislikes: number;
  myReaction: Reaction;
  createdAt: string;
}

export interface CommunityPage<T> {
  items: T[];
  hasNext: boolean;
  nextCursor: string | null;
}

export type ReportTarget = 'post' | 'comment';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'misinfo' | 'other';

export interface BlockedUser {
  id: string;
  nickname: string | null;
  nationality: string | null;
}
