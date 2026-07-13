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
  onboardingCompleted: boolean;
  ranking: RankingSummaryWire;
}

export interface ProfileUpdateWire {
  nickname?: string;
  avoidanceSubstanceCodes?: string[];
  countryCode?: string;
  appLanguage?: string;
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
    spiceTolerance: localSpice, // 계약 밖 — 로컬 보관 (KB-75 질의)
    restrictions: wire.avoidanceSubstanceCodes.map((code) => ({
      kind: 'allergy' as RestrictionKind, // UI 미사용 필드 — 코드가 정보의 전부
      code,
    })),
    rank: adaptRanking(wire.ranking),
    onboardingCompleted: wire.onboardingCompleted,
  };
}
