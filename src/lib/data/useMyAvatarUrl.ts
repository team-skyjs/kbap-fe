/**
 * useMyAvatarUrl (P-313/KB-480) — 내 아바타 이미지 소스 **정본 한 함수**:
 * 프로필 헤더·탭바가 동일 규칙을 공유한다(불일치 재발 방지 — Codex #66의 진짜 문제).
 * 규칙 = 헤더 그대로: 서버 profileImageUrl이면 그 값(**기본 프사 URL 포함**),
 * 게스트·null만 플레이스홀더(null 반환). 로드 실패 폴백은 소비처 몫.
 */
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';
import { isDefaultProfileImage } from '@/lib/api/memberAdapter';
import { flagEmoji } from '@/lib/flagEmoji';

export function useMyAvatarUrl(): string | null {
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  return isGuest ? null : (me?.profileImageUrl ?? null);
}

/** KB-1013(예진 11/6): 기본 아바타(음식 사진·기본 URL) 사용자 = 프사 자리에 내 국적 국기. 직접 올린 사진·국적 없음·코드 불량 = null(기존 표시 그대로).
 *  헤더·탭바가 같은 판정을 쓴다(P-313 정본 공유 — 둘이 어긋나면 Codex #66 재발). 국적 = 서버 프로필 값(로컬 판별 0). */
export function avatarFlagCode(url: string | null, nationality: string | null | undefined): string | null {
  return url && isDefaultProfileImage(url) && flagEmoji(nationality) ? nationality! : null;
}
export function useMyAvatarFlag(): string | null {
  const url = useMyAvatarUrl();
  const { data: me } = useMe();
  return avatarFlagCode(url, me?.nationality);
}
