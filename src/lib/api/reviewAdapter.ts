/**
 * reviewAdapter.ts — 리뷰 API 와이어 경계 (P-085/KB-73 실연결).
 *
 * 계약(dev 스웨거 스냅샷 2026-08-11 — P-165/#144 **버전리스 이관**, /api/v1/reviews* 삭제):
 *   POST /api/reviews {foodId, rating, content?, imagePaths?} · PATCH /api/reviews/{id}
 *   · DELETE /api/reviews/{id} · GET /api/reviews?lang&foodId&cursor&countryCode
 *   · GET /api/reviews/me?lang&cursor — 전부 BaseResponse 봉투(클라이언트가 해체).
 *   breaking: 최상위 foodId·memberId 소멸 → food.foodId·author.memberId(구응답 폴백 유지).
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

/** P-165(#144): 리뷰 대상 음식 요약 — 목록 조회에서만, 음식 삭제 시 null. name은 lang 해석값. */
export interface ReviewFoodWire {
  foodId: number;
  name: string;
  imageUrl?: string | null;
}

export interface ReviewWire {
  servingSpeed?: number;
  staffKindness?: number;
  reviewId: number;
  /** P-165: 계약에서 소멸 — 구응답 방어 폴백으로만 유지. 정본은 food.foodId. */
  foodId?: number;
  /** P-165: 계약에서 소멸 — 정본은 author.memberId. */
  memberId?: number;
  /** P-165(#144): 음식 요약(서버 이름·썸네일) — 작성/수정 응답·삭제된 음식이면 null. */
  food?: ReviewFoodWire | null;
  rating: number;
  content?: string | null;
  imageUrls: string[];
  createdAt: string;
  author?: ReviewAuthorWire | null; // 탈퇴 회원이면 null
  /** P-181(BE #152): 탈퇴 작성자 플래그 — true면 author null. 서버 정본(불변 규칙 1). */
  authorWithdrawn?: boolean;
  /** P-108(KB-257): 좋아요 — 서버값 (8/3 계약). 구응답 방어 옵셔널. */
  likeCount?: number;
  likedByMe?: boolean;
  /** P-201(KB-249): 장소 태그 — source = KAKAO_PLACE/MANUAL/AUTHOR_LOCATION. */
  place?: { name?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null; source?: string | null } | null;
}

export interface ReviewPageWire {
  items: ReviewWire[];
  hasNext: boolean;
  nextCursor?: number | null;
}

export interface ReviewUpdateWire {
  servingSpeed?: number;
  staffKindness?: number;
  rating: number;
  content?: string;
  imagePaths?: string[];
  /** P-201: 장소 — 생략 = 제거(전 필드 공통 시맨틱), MANUAL = name만. */
  place?: { name: string; address?: string; latitude?: number; longitude?: number };
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
  // P-165(#144): foodId·memberId 정본 = 중첩(food/author), 최상위는 구응답 폴백
  const foodId = wire.food?.foodId ?? wire.foodId;
  const memberId = wire.author?.memberId ?? wire.memberId;
  return {
    id: String(wire.reviewId),
    foodId: foodId != null ? String(foodId) : '',
    rating: wire.rating,
    body: wire.content ?? null,
    createdAt: wire.createdAt,
    photos: wire.imageUrls ?? [],
    memberId: memberId != null ? String(memberId) : undefined,
    author,
    // P-165: 서버 해석 음식 이름·썸네일(내 리뷰 화면 우선 소스) — 부재 시 화면이 캐시 폴백
    foodName: wire.food?.name ?? null,
    foodImageUrl: wire.food?.imageUrl ?? null,
    // 파생 — 기존 화면 호환 축. P-181: 탈퇴 판정 = authorWithdrawn **서버 정본 우선**,
    // 필드 부재(구 응답)만 author==null 폴백. 렌더(익명)는 무변.
    authorNationality: author?.nationality ?? null,
    authorRankTier: author?.tier ?? null,
    anonymized: wire.authorWithdrawn ?? (author == null),
    // 번역 축 — 계약 미배포(지시 7): 원문 언어 미상, UI는 플래그로 비노출
    bodyLanguage: undefined,
    translatedBody: null,
    // P-108: 좋아요 = 서버값 (목 로컬 계산 폐기 — 토글 낙관 반영은 뮤테이션 몫)
    likes: wire.likeCount ?? 0,
    myLike: wire.likedByMe === true,
    // P-236: 2축(0 = 평가 안 함) — 누락 = 0과 동일 취급
    servingSpeed: wire.servingSpeed ?? 0,
    staffKindness: wire.staffKindness ?? 0,
    // P-201: 장소 — name 없으면 무태그. MANUAL = 좌표 null(딥링크는 이름 검색 폴백)
    place: wire.place?.name
      ? {
          name: wire.place.name,
          roadAddress: wire.place.address ?? null,
          latitude: wire.place.latitude ?? null,
          longitude: wire.place.longitude ?? null,
        }
      : null,
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

/** P-201: 내부 place → 전송 wire. MANUAL(좌표 null) = name만. */
type ReviewPlaceLike = { name: string; roadAddress?: string | null; latitude?: number | null; longitude?: number | null };
function placeWire(p: ReviewPlaceLike): NonNullable<ReviewUpdateWire['place']> {
  if (p.latitude == null || p.longitude == null) return { name: p.name };
  return { name: p.name, ...(p.roadAddress ? { address: p.roadAddress } : {}), latitude: p.latitude, longitude: p.longitude };
}

/**
 * PATCH 풀 페이로드 — "생략=제거" 함정 방지: rating·imagePaths는 항상 포함
 * (사진은 현재 보유분 전량 유지), content는 최종 본문이 비면 **의도된 제거**로
 * 생략, 있으면 포함. P-201 place 동일 시맨틱: changes.place undefined = 현행 유지
 * (있으면 재전송 — 소실 방지), null = 해제 의도 → 생략, 값 = 교체.
 */
export function buildReviewUpdate(
  current: { rating: number; body: string | null; photos?: string[]; place?: ReviewPlaceLike | null; servingSpeed?: number; staffKindness?: number },
  changes: { rating?: number; body?: string | null; place?: ReviewPlaceLike | null; servingSpeed?: number; staffKindness?: number },
): ReviewUpdateWire {
  const body = (changes.body !== undefined ? changes.body : current.body)?.trim() ?? '';
  const place = changes.place !== undefined ? changes.place : (current.place ?? null);
  return {
    rating: changes.rating ?? current.rating,
    // P-236: 2축 — 풀 페이로드 규약상 누락 = 0 리셋이므로 항상 현행/변경 값 전송
    servingSpeed: changes.servingSpeed ?? current.servingSpeed ?? 0,
    staffKindness: changes.staffKindness ?? current.staffKindness ?? 0,
    ...(body ? { content: body } : {}), // 빈 본문 = 제거 의도 → 생략
    imagePaths: (current.photos ?? []).map(imageUrlToPath), // 항상 전송 — 사진 소실 방지
    ...(place ? { place: placeWire(place) } : {}), // null = 해제 → 생략
  };
}
