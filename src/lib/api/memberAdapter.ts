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
import type { Ranking, RestrictionKind, User } from './types';

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
  memberId: number;
  nickname: string;
  avoidanceSubstanceCodes: string[];
  countryCode: string;
  appLanguage: string;
  /** 0..10 유효값, **-1 = 미설정 센티널** (BE 확정 2026-07-16 회의 — required int,
   *  미설정 유저는 항상 -1로 옴). 누락 방어 겸 옵셔널은 구서버 대비로만 유지. */
  spicinessPreference?: number | null;
  /** 프로필 사진 표시 URL (KB-149, 2026-07-16 배포). 미설정 시 null/누락. */
  profileImageUrl?: string | null;
  onboardingCompleted: boolean;
  ranking: RankingSummaryWire;
}

export interface ProfileUpdateWire {
  nickname?: string;
  avoidanceSubstanceCodes?: string[];
  countryCode?: string;
  appLanguage?: string;
  spicinessPreference?: number; // 0..10, 해제 = -1 전송 (BE 확정 7/16 — 생략은 유지)
  profileImageUrl?: string; // 업로드 publicUrl (KB-149) — 생략 = 유지
}

/**
 * 맵기 wire → 내부 표현 (KB-150, -1 센티널 확정 7/16).
 * -1(미설정) 포함 0..10 밖·비정수는 전부 null(미설정) — 칩에 "-1/10"이 노출되는
 * 오작동 방지. 서버가 항상 값을 주므로(-1 정책) 서버값이 진실 — 로컬 fallback은
 * 필드 누락/비숫자(구서버·마이그레이션)일 때만.
 */
export function adaptSpice(wire: number | null | undefined, localFallback: number | null): number | null {
  if (typeof wire !== 'number') return localFallback;
  if (!Number.isInteger(wire) || wire < 0 || wire > 10) return null;
  return wire;
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

export function adaptProfile(wire: MyProfileWire, localSpice: number | null): User {
  return {
    id: String(wire.memberId),
    nickname: wire.nickname,
    nationality: wire.countryCode,
    readerLanguage: wire.appLanguage,
    spiceTolerance: adaptSpice(wire.spicinessPreference, localSpice),
    // 빈 문자열도 미설정 취급 — Image source 에 '' 가 들어가는 것 방지 (KB-149)
    profileImageUrl:
      typeof wire.profileImageUrl === 'string' && wire.profileImageUrl ? wire.profileImageUrl : null,
    restrictions: wire.avoidanceSubstanceCodes.map((code) => ({
      kind: 'allergy' as RestrictionKind, // UI 미사용 필드 — 코드가 정보의 전부
      code,
    })),
    rank: adaptRanking(wire.ranking),
    onboardingCompleted: wire.onboardingCompleted,
  };
}
