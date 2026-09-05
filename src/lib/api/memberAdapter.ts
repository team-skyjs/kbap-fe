/**
 * memberAdapter.ts — BE member 계약 → 내부 User/Ranking 번역 (KB-68/74).
 *
 *   GET  /members/me/profile → MyProfileWire (+RankingSummary 동반)
 *   PATCH /members/me/profile ← ProfileUpdateWire (부분 수정 — 보낸 필드만
 *         반영, avoidanceSubstanceCodes 빈 배열 = 전부 해제, 미전송 = 유지)
 *   GET  /members/me/ranking → MemberRankingWire (breakdown 포함)
 *
 * 갭 채움:
 *   - spiceTolerance ← 계약에 없음 → 로컬 보관값(loadLocalSpice) 주입
 *   - restrictions.kind ← 와이어는 코드만 — UI가 kind를 안 쓰므로 'allergy' 고정
 *   - email ← 계약에 없음(소셜 전용) → undefined
 */
import { reportProfileContractDrift } from '../sentry';
import type { Ranking, RestrictionKind, User } from './types';
import type { SpiceChoice } from '@/lib/spice';
import { wireToSpiceChoice } from './spiceAdapter';

export interface RankingSummaryWire {
  tier: string;
  level: number;
  score: number;
  nextTier?: string | null; // 최고 등급이면 null
  pointsToNext?: number | null;
}

export interface MemberRankingWire extends RankingSummaryWire {
  breakdown: {
    reviews: { count: number; points: number };
    diversity: { count: number; points: number };
    scans: { count: number; points: number };
  };
}

export interface MyProfileWire {
  dietCategories?: string[];
  memberId: number;
  nickname: string;
  avoidanceSubstanceCodes: string[];
  countryCode: string;
  appLanguage: string;
  /** P-084(7/30): dev 신계약 = enum 문자열(SKIP/NONE/…strict). 구계약(prod) =
   *  0..10 정수·-1 미설정 센티널 — 폴백 수신 유지. 누락 방어 옵셔널은 구서버 대비. */
  spicinessPreference?: number | string | null;
  /** 프로필 사진 표시 URL (KB-149, 2026-07-16 배포). 미설정 시 null/누락. */
  profileImageUrl?: string | null;
  /** 가입 소셜 (KB-203, required 배포) — APPLE | GOOGLE. 구서버 방어 옵셔널. */
  provider?: string;
  /** P-165(#145): 유저 통화(ISO-4217) — 미설정 null/누락(국적 폴백은 클라 exchange 몫). */
  currency?: string | null;
  onboardingCompleted: boolean;
  ranking: RankingSummaryWire;
}

export interface ProfileUpdateWire {
  dietCategories?: string[]; // P-243(BE #179): 풀 셋 교체
  nickname?: string;
  avoidanceSubstanceCodes?: string[];
  countryCode?: string;
  appLanguage?: string;
  spicinessPreference?: string; // P-084 enum 문자열(전 채널 — KB-389 2차로 prod 구정수 분기 소멸, 해제 = 'SKIP') — 생략은 유지
  profileImageUrl?: string; // path 설정 · 삭제=PROFILE_IMAGE_DEFAULT_PATH 전송(P-016, null 폐기) · 생략=유지
  currency?: string | null; // P-165(#145): null = 미설정(국적 폴백) · 생략=유지
}

/**
 * 맵기 wire → 내부 enum (KB-150 -1 센티널 → P-081 enum → P-084 문자열 신계약).
 * 문자열(dev 신계약)·정수(prod 구계약) 겸수신 — 변환은 spiceAdapter 격리.
 * 서버가 항상 값을 주므로 서버값이 진실 — 로컬 fallback은 필드 누락(구서버·
 * 마이그레이션)일 때만.
 */
export function adaptSpice(wire: number | string | null | undefined, localFallback: SpiceChoice | null): SpiceChoice {
  if (typeof wire !== 'number' && typeof wire !== 'string') return localFallback ?? 'SKIP';
  return wireToSpiceChoice(wire);
}

export function adaptRanking(wire: RankingSummaryWire | MemberRankingWire): Ranking {
  return {
    tier: wire.tier,
    level: wire.level,
    score: wire.score,
    nextTier: wire.nextTier ?? null, // 최고 등급 경계 (KB-74)
    pointsToNext: wire.pointsToNext ?? null,
    ...('breakdown' in wire && wire.breakdown
      ? {
          breakdown: {
            reviews: wire.breakdown.reviews,
            diversity: wire.breakdown.diversity,
            scans: wire.breakdown.scans,
          },
        }
      : {}),
  };
}

/**
 * 프로필 사진 최종 컨벤션 (P-016, 종한 최종 확정 7/20 — null 폐기):
 * 삭제·온보딩 미선택 = 이 기본 path를 **값으로 전송**, 응답도 항상 값(기본 URL 포함).
 * "미설정" 상태 소멸 — 기본 path가 그 역할.
 */
export const PROFILE_IMAGE_DEFAULT_PATH = 'images/default/profile/profile-default-512.png';

/** 서버가 준 URL이 기본 프로필 사진인지 — 기본이면 삭제 액션 미노출(사진 없음 취급).
 *  P-140: 색상 아바타 6종 경로(webp/default_profile)도 기본 취급 — 삭제 미노출·재선택 가능. */
export function isDefaultProfileImage(url: string | null | undefined): boolean {
  return !!url && (url.includes('images/default/profile/') || url.includes('images/webp/default_profile/'));
}

/** provider → 연동 라벨 i18n 키 (KB-203/P-029). 미지원·누락은 폴백 — 빈 값 금지. */
export function providerLabelKey(provider: string | undefined): string {
  if (provider === 'APPLE') return 'editProfile.linkedApple';
  if (provider === 'GOOGLE') return 'editProfile.linkedGoogle';
  return 'editProfile.linkedSocial';
}

/** 조회 profileImageUrl 방어 — 절대 URL(http…)만 렌더, 그 외 null(플레이스홀더). */
export function adaptProfileImageUrl(wire: string | null | undefined): string | null {
  if (typeof wire !== 'string' || !wire) return null;
  if (!wire.startsWith('http')) {
    // BE 확인 필요 신호 — 진행로그 참조 (P-006 할 일 2)
    console.log('[profile] 조회 profileImageUrl이 절대 URL이 아님(path로 옴?) — BE 확인 필요:', wire);
    return null;
  }
  return wire;
}

export function adaptProfile(wire: MyProfileWire, localSpice: SpiceChoice | null): User {
  // KB-434 후속(9/5 프로필 탭 전체 에러): 필수 2필드 부재 = 어댑터 throw → useMe error →
  // 화면 전체 QueryErrorBlock이 되던 것 방어. 부재는 조용히 삼키지 않고 드리프트 경고
  // (reportProfileContractDrift — console.warn + Sentry 태그). 회피 부재 = 빈 배열
  // (personalRisk가 unable로 강등하는 false-safe 방향) · ranking 부재 = null(카드 미렌더).
  const missing: string[] = [];
  if (!Array.isArray(wire.avoidanceSubstanceCodes)) missing.push('avoidanceSubstanceCodes');
  if (wire.ranking == null) missing.push('ranking');
  if (wire.memberId == null) missing.push('memberId');
  reportProfileContractDrift(missing);
  return {
    id: String(wire.memberId),
    nickname: wire.nickname,
    nationality: wire.countryCode,
    readerLanguage: wire.appLanguage,
    spiceTolerance: adaptSpice(wire.spicinessPreference, localSpice),
    // KB-149 후속(P-006): 조회는 서버가 도메인을 조합한 절대 URL 이어야 한다
    // (FE 는 CDN 도메인을 모름 — 전송은 path 만). 비-http 값(path 로 오는 등)은
    // 렌더 불가 → 플레이스홀더 + 감지 로그 (빈 문자열 '' Image source 방지 겸).
    profileImageUrl: adaptProfileImageUrl(wire.profileImageUrl),
    provider: wire.provider, // KB-203 — 연동 계정 표시용
    currency: wire.currency ?? null, // P-165(#145): 서버 정본 — 결정 체인 1순위(exchange)

    restrictions: (Array.isArray(wire.avoidanceSubstanceCodes) ? wire.avoidanceSubstanceCodes : []).map((code) => ({
      kind: 'allergy' as RestrictionKind, // UI 미사용 필드 — 코드가 정보의 전부
      code,
    })),
    rank: wire.ranking != null ? adaptRanking(wire.ranking) : null,
    onboardingCompleted: wire.onboardingCompleted,
    // P-243: 식이 카테고리 서버 정본(BE #179) — 부재(구응답) = 빈 배열
    dietCategories: Array.isArray(wire.dietCategories) ? wire.dietCategories : [],
  };
}
