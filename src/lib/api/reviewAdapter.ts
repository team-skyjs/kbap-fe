/**
 * reviewAdapter.ts — 리뷰 API 와이어 경계 (P-085/KB-73 실연결).
 *
 * 계약(dev 스웨거 스냅샷 2026-07-30):
 *   POST /reviews {foodId, rating, content?, imagePaths?} · PATCH /reviews/{id}
 *   · DELETE /reviews/{id} · GET /foods/{id}/reviews?cursor&countryCode ·
 *   GET /members/me/reviews?cursor — 전부 BaseResponse 봉투(클라이언트가 해체).
 *
 * ⚠️ PATCH 시맨틱 = **"생략 = 제거"** (rating만 필수): 본문만 고칠 때도
 * imagePaths를 안 보내면 서버가 사진을 삭제한다 — buildReviewUpdate가 항상
 * 풀 페이로드를 만든다 (이 발주의 최대 함정, 유닛 잠금).
 *
 * 사진: 전송 = path(objectKey) / 조회 = 서버 조합 완전 URL(imageUrls) —
 * 프로필 사진과 동일 규약. 기존 사진 유지 시 URL→path 역변환(imageUrlToPath).
 */
import type { Review, ReviewAuthor, ReviewPage } from './types';

/* ---- wire shapes (스냅샷 기준) ---- */

export interface ReviewAuthorWire {
  memberId: number;
  nickname?: string | null;
  countryCode?: string | null;
  tier: string;
  level: number;
  score: number;
}

export interface ReviewWire {
  reviewId: number;
  foodId: number;
  memberId: number;
  rating: number;
  content?: string | null;
  imageUrls: string[];
  createdAt: string;
  author?: ReviewAuthorWire | null; // 탈퇴 회원이면 null
}

export interface ReviewPageWire {
  items: ReviewWire[];
  hasNext: boolean;
  nextCursor?: number | null;
}

export interface ReviewUpdateWire {
  rating: number;
  content?: string;
  imagePaths?: string[];
}

/* ---- adapt (wire → 내부) ---- */

function adaptAuthor(wire: ReviewAuthorWire | null | undefined): ReviewAuthor | null {
  if (!wire) return null;
  return {
    memberId: String(wire.memberId),
    nickname: wire.nickname ?? null,
    nationality: wire.countryCode ?? null,
    tier: wire.tier,
    level: wire.level,
  };
}

export function adaptReview(wire: ReviewWire): Review {
  const author = adaptAuthor(wire.author);
  return {
    id: String(wire.reviewId),
    foodId: String(wire.foodId),
    rating: wire.rating,
    body: wire.content ?? null,
    createdAt: wire.createdAt,
    photos: wire.imageUrls ?? [],
    memberId: String(wire.memberId),
    author,
    // 파생 — 기존 화면 호환 축 (author null=탈퇴 → 익명 표시)
    authorNationality: author?.nationality ?? null,
    authorRankTier: author?.tier ?? null,
    anonymized: author == null,
    // 번역 축 — 계약 미배포(지시 7): 원문 언어 미상, UI는 플래그로 비노출
    bodyLanguage: undefined,
    translatedBody: null,
  };
}

export function adaptReviewPage(wire: ReviewPageWire): ReviewPage {
  return {
    items: (wire.items ?? []).map(adaptReview),
    hasNext: wire.hasNext === true,
    nextCursor: wire.nextCursor != null ? String(wire.nextCursor) : null,
  };
}

/* ---- 송신 헬퍼 ---- */

/**
 * 조회 URL → 전송 path 역변환. 서버 규약: 조회는 CDN 완전 URL, 전송은
 * objectKey(path, 스킴 금지 패턴). 이미 path면 그대로 통과.
 * (정확한 역변환 규약은 BE 질의 — pathname 추출이 현행 CDN 구조의 실용해)
 */
export function imageUrlToPath(url: string): string {
  if (!/^https?:\/\//.test(url)) return url;
  const m = url.match(/^https?:\/\/[^/]+\/(.*)$/);
  return m ? m[1] : url;
}

/**
 * PATCH 풀 페이로드 — "생략=제거" 함정 방지: rating·imagePaths는 항상 포함
 * (사진은 현재 보유분 전량 유지), content는 최종 본문이 비면 **의도된 제거**로
 * 생략, 있으면 포함.
 */
export function buildReviewUpdate(
  current: { rating: number; body: string | null; photos?: string[] },
  changes: { rating?: number; body?: string | null },
): ReviewUpdateWire {
  const body = (changes.body !== undefined ? changes.body : current.body)?.trim() ?? '';
  return {
    rating: changes.rating ?? current.rating,
    ...(body ? { content: body } : {}), // 빈 본문 = 제거 의도 → 생략
    imagePaths: (current.photos ?? []).map(imageUrlToPath), // 항상 전송 — 사진 소실 방지
  };
}
