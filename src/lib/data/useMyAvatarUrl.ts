/**
 * useMyAvatarUrl (P-313/KB-480) — 내 아바타 이미지 소스 **정본 한 함수**:
 * 프로필 헤더·탭바가 동일 규칙을 공유한다(불일치 재발 방지 — Codex #66의 진짜 문제).
 * 규칙 = 헤더 그대로: 서버 profileImageUrl이면 그 값(**기본 프사 URL 포함**),
 * 게스트·null만 플레이스홀더(null 반환). 로드 실패 폴백은 소비처 몫.
 */
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';

export function useMyAvatarUrl(): string | null {
  const isGuest = useIsGuest();
  const { data: me } = useMe();
  return isGuest ? null : (me?.profileImageUrl ?? null);
}
