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
  spiceTolerance: number | null; // 0–10
  restrictions: DietaryRestriction[];
  rank: Ranking;
  /** 프로필 사진 표시 URL (KB-149). 미설정/mock 은 생략 = 플레이스홀더. */
  profileImageUrl?: string | null;
  /** 가입 소셜 (KB-203) — 'APPLE' | 'GOOGLE' (미래 확장 대비 string). mock 생략. */
  provider?: string;
  /** 서버 온보딩 완료 플래그 (KB-75 재유도 판정의 원천). mock/비회원에선 생략. */
  onboardingCompleted?: boolean;
}

export interface UserUpdate {
  nickname?: string;
  nationality?: string;
  readerLanguage?: string;
  spiceTolerance?: number | null;
  restrictions?: DietaryRestriction[];
  profileImageUrl?: string; // path 설정 · 삭제=기본 path 전송(P-016 확정, null 폐기) · 생략=유지 (KB-149)
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
  description: string; // reader language, ≤150 chars (EN)
  spiceLevel: number | null; // 0–10 dish heat (mockup "X/10"); compared to spiceTolerance
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

export interface Review {
  id: string;
  foodId: string;
  rating: number; // 1–5
  body: string | null;
  bodyLanguage: string;
  translatedBody: string | null; // when translateTo requested
  authorNationality: string | null;
  authorRankTier: string | null;
  anonymized: boolean;
  createdAt: string; // ISO date-time
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

export interface FoodReviewsResponse {
  overall: RatingAggregate;
  sameNationality: RatingAggregate;
  items: Review[];
}
