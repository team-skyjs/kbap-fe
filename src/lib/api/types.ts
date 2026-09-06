/**
 * api/types.ts — hand-authored mirror of the API contract (SSOT):
 *   spec repo `specs/001-personalized-menu-mvp/contracts/openapi.yaml` → components/schemas.
 *
 * Field names match the contract EXACTLY so mock JSON typed against these surfaces
 * drift at compile time (handoff §5). Replace this file with generated types
 * (`npx openapi-typescript openapi.yaml`) once the contract is re-stabilized.
 *
 * NOTE (handoff §11): the contract is mid-renegotiation. Food identity
 * (foodId vs menuName) is NOT final — do not hard-couple screen logic to it.
 */

import type { SpiceChoice, SpiceLevel } from '@/lib/spice';

export type RiskState = 'safe' | 'caution' | 'danger' | 'unable';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

export type RestrictionKind = 'allergy' | 'diet' | 'religion';
export interface DietaryRestriction {
  kind: RestrictionKind;
  code: string; // e.g. "allergy:shellfish"
}

/** One score-contributing activity (FR-025): its count and the points it added. */
export interface RankingFactor {
  count: number; // reviews written / unique dishes / scans
  points: number; // points this factor contributed
}

export interface Ranking {
  tier: string; // stable key: newcomer|taster|explorer|regular|gourmet|kfood_master|korean_at_heart
  level: number; // 1–7
  score: number;
  nextTier: string | null; // stable key, null at top tier
  pointsToNext: number | null;
  /** Score breakdown for the ranking-detail screen (contract-optional; omitted by GET /me). */
  breakdown?: {
    reviews: RankingFactor;
    diversity: RankingFactor;
    scans: RankingFactor;
  };
}

export interface User {
  id: string;
  email?: string; // from auth; read-only on the edit form
  nickname: string;
  nationality: string; // ISO 3166-1 alpha-2
  readerLanguage: string; // BCP-47
  spiceTolerance: SpiceChoice; // P-081: enum — 'SKIP' = 미설정(구 null/-1)
  restrictions: DietaryRestriction[];
  /** KB-434 후속: 서버 ranking 부재(계약 드리프트) = null — 랭킹 표면 미렌더 */
  rank: Ranking | null;
  /** 프로필 사진 표시 URL (KB-149). 미설정/mock 은 생략 = 플레이스홀더. */
  profileImageUrl?: string | null;
  /** 가입 소셜 (KB-203) — 'APPLE' | 'GOOGLE' (미래 확장 대비 string). mock 생략. */
  provider?: string;
  /** 서버 온보딩 완료 플래그 (KB-75 재유도 판정의 원천). mock/비회원에선 생략. */
  onboardingCompleted?: boolean;
  /** P-243(KB-340): 식이 카테고리 서버 정본 — 역추론 표시 대체. 부재/빈 배열 = 섹션 숨김. */
  dietCategories?: string[];
  /** P-165(#145): 유저 통화(ISO-4217) — 서버 정본, null/생략 = 미설정(국적 폴백). */
  currency?: string | null;
}

export interface UserUpdate {
  nickname?: string;
  // nationality: P-078(7/29 정책) — 수정 불가, PATCH 계약에서 제거(온보딩 최초 설정만)
  readerLanguage?: string;
  spiceTolerance?: SpiceChoice; // 'SKIP' = 설정 해제(와이어 -1은 어댑터 몫)
  restrictions?: DietaryRestriction[];
  profileImageUrl?: string; // path 설정 · 삭제=기본 path 전송(P-016 확정, null 폐기) · 생략=유지 (KB-149)
  currency?: string | null; // P-165(#145): null = 미설정(국적 폴백) · 생략 = 유지
  dietCategories?: string[]; // P-243(BE #179): 식이 카테고리 풀 셋 교체 · 생략 = 유지
}

export interface RatingAggregate {
  average: number | null; // 1–5, null if 0 reviews
  count: number;
}

/** List/home/recommend summary (personalized risk included). */
export interface FoodCard {
  foodId: string;
  name: string; // reader-language display name
  nameKo: string;
  photoUrl: string | null;
  risk: RiskState;
  overall: RatingAggregate;
  /** Editorial popularity rank (1 = most popular). Search "popular" list. Optional; BE fills it (KB-71). */
  popularityRank?: number;
  /** One-line reader-language blurb for search result cards. Optional; BE fills it (KB-71). */
  blurb?: string;
}

export interface IngredientRisk {
  code: string;
  name: string; // reader language
  percentage: number | null;
  risk: RiskState;
  note: string | null; // e.g. "store-dependent"
}

/** Traceable basis for a risk verdict (FR-012). */
export interface RiskBasis {
  ingredientCode: string;
  restrictionCode: string;
  percentage: number | null;
  reason: string;
}

export interface FoodDetail {
  foodId: string;
  name: string;
  nameKo: string;
  risk: RiskState;
  riskBasis: RiskBasis[];
  overall: RatingAggregate;
  sameNationality: RatingAggregate;
  /** P-235: review:null 방어 — 요약 미상(브리프 섹션 미렌더). blur 축은 소멸(8/19). */
  reviewSummaryMissing?: boolean;
  /** P-251: false = Write a review 게이트(스캔 유도) — undefined(prod 구응답) = 게이트 없음. */
  reviewEligible?: boolean;
  /** P-239: 신스키마 인라인 최신 리뷰 — 있으면 상세가 목록 호출 생략. 부재 = prod 폴백. */
  recentReviews?: Review[];
  description: string; // reader language, ≤150 chars (EN)
  spiceLevel: SpiceLevel | null; // P-081: enum 단계 (null = 데이터 없음); spiceTolerance와 순서 비교
  photoUrl: string | null;
  ingredients: IngredientRisk[]; // 90%+ inclusion, danger→caution→safe order (FR-014)
  isRegistered: boolean; // false ⇒ treat as unable (FR-033)
  /** 조회 회원의 저장(북마크) 여부 (KB-142). 옵셔널 = mock/미등록 경로 — 미설정은 false 취급. */
  bookmarked?: boolean;
}

export interface ScanResultItem {
  rawText: string; // request original (overlay-matching key)
  foodId: string | null; // null if unmatched
  name: string; // reader-language display (translation or catalog name)
  risk: RiskState;
  note: string | null;
  registered: boolean;
}

/** place language = ko (Constitution I). */
export interface OwnerConfirmation {
  questionKo: string;
  explanationKo: string;
  menuNameKo: string; // matches scanned menu name (FR-019)
  placeLanguage: string; // default "ko"
}

/** 리뷰 작성자 프로필 (P-085/KB-73 — ReviewAuthorResponse). */
export interface ReviewAuthor {
  memberId: string;
  nickname: string | null; // 미설정이면 null
  nationality: string | null; // countryCode — 미보유면 null
  tier: string;
  level: number;
}

export interface Review {
  id: string;
  foodId: string;
  rating: number; // 1–5
  body: string | null; // content
  createdAt: string; // ISO date-time
  /** 조회 사진 = 서버 조합 완전 URL (전송은 path — reviewAdapter.imageUrlToPath). */
  photos?: string[];
  /** 작성자 회원 id — 내 리뷰 판별 (P-085 → P-165: 정본 author.memberId에서 파생). mock 경로는 생략 가능. */
  memberId?: string;
  /** P-165(#144): 서버 해석(lang) 음식 이름 — 목록 응답에서만, 부재/삭제 시 null(화면 캐시 폴백). */
  foodName?: string | null;
  /** P-165(#144): 음식 대표 썸네일 URL — 부재 시 null. */
  foodImageUrl?: string | null;
  /** 작성자 프로필 — **null = 탈퇴 회원** (P-085 방어 렌더 3케이스의 하나). */
  author?: ReviewAuthor | null;
  /** 파생(author.nationality) — 화면 호환 유지. */
  authorNationality: string | null;
  authorRankTier: string | null;
  anonymized: boolean; // author 부재(탈퇴) = true
  /** 번역 축 — 리뷰 번역 계약 미배포(P-085 지시 7): UI는 FLAGS.reviewTranslationEnabled로 비노출. */
  bodyLanguage?: string;
  translatedBody?: string | null;
  /** P-095 목 → P-201(KB-249) 실계약: 장소 태그 — MANUAL은 name만(좌표·주소 null). */
  place?: { name: string; roadAddress: string | null; latitude?: number | null; longitude?: number | null; placeId?: string | null } | null;
  /** P-095: 좋아요 — BE 계약 미배포, 목 전용(표시만 — 정렬 미반영 확정). */
  likes?: number;
  /** P-236(KB-347): 2축 평가 — 0 = 평가 안 함(구 리뷰 전부 0). */
  servingSpeed?: number;
  staffKindness?: number;
  myLike?: boolean;
}

/* ---- response envelopes ---- */

export interface AvoidedSubstance {
  code: string;
  name: string; // 회원 언어로 지역화된 성분명 (LIVE /home 제공)
}

export interface HomeResponse {
  recent: FoodCard[];
  recommended: FoodCard[];
  /** LIVE(KB-69) 전용 — false면 개인화 섹션은 가입 유도 UI. mock에선 생략. */
  authenticated?: boolean;
  /** LIVE(KB-69) 전용 — 지역화된 기피 성분명. mock에선 생략(restrictionLabel 폴백). */
  avoided?: AvoidedSubstance[];
}

export interface ScanResponse {
  results: ScanResultItem[];
}

/** 리뷰 keyset 페이지 (P-085 — PageReviewResponse). 평점 집계는 음식 상세(averageRating 등)로 이동. */
export interface ReviewPage {
  items: Review[];
  hasNext: boolean;
  nextCursor: string | null;
}
