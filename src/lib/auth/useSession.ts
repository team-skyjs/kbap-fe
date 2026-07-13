/**
 * useSession / useIsGuest — 실세션 기반 게스트 판별 (KB-77/78, guest-access-policy).
 * mock 토글이 아니라 BE 토큰 존재(hasBeSession)가 기준. 인증 경계(로그인/
 * 로그아웃/탈퇴/만료)마다 beAuth가 queryClient.clear()를 하므로 이 쿼리는
 * 전환 직후 자동 재평가된다 → 로그인하면 잠금이 즉시 풀린다.
 */
import { useQuery } from '@tanstack/react-query';
import { hasBeSession } from './beAuth';
import { FLAGS } from '@/lib/flags';

export function useSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: hasBeSession,
    staleTime: Infinity, // 경계마다 clear()로 무효화되므로 그 사이엔 고정
  });
}

/** 게스트 = guestMode ON && BE 세션 없음. 로딩 중엔 false(잠금 깜빡임 방지 —
 *  회원에게 잠금이 스치는 것보다 게스트에게 뱃지가 스치는 게 낫다는 판단이
 *  아니라, 로딩 중엔 개인화 데이터 자체가 없어 뱃지도 안 그려진다). */
export function useIsGuest(): boolean {
  const { data: hasSession } = useSession();
  return FLAGS.guestMode && hasSession === false;
}
