/**
 * useAdReward (KB-739 ⑤ · 서버 KB-740) — 보상형 광고 완료 신고 `POST /api/members/me/ad-rewards` {rewardKey, adUnitId}.
 * 카운트는 **서버 응답만**(클라 로컬 카운트·낙관 갱신 금지 — 서버 진실). 멱등(같은 rewardKey 재요청 = 200 현재 상태).
 * 429 MEMBER-014 = 24h 10회 상한("오늘은 여기까지") · 400 COMMON-002 = 남의 키·허용 밖 단위(재시도 없이 닫기).
 * 성공 뒤 프로필(['me']) invalidate를 **await**(KB-759 방어 1) — mutateAsync가 풀릴 땐 adRewards·scanQuota가 서버값(해제 반영)이다.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api/client';

export interface AdRewardResponse {
  rewardCount: number;
  remainingForUnlock: number;
  scanUnlocked: boolean;
}

export type AdRewardFailure = 'limit' | 'rejected' | 'network';

export function classifyAdRewardError(e: unknown): AdRewardFailure {
  if (e instanceof ApiError) {
    if (e.code === 'MEMBER-014' || e.status === 429) return 'limit';
    if (e.status != null && e.status >= 400 && e.status < 500) return 'rejected';
  }
  return 'network';
}

export function useClaimAdReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { rewardKey: string; adUnitId: string }) =>
      api.post<AdRewardResponse>('/api/members/me/ad-rewards', { rewardKey: input.rewardKey, adUnitId: input.adUnitId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }), // 재조회 완료까지 대기(실패해도 resolve — throwOnError 기본 false)
  });
}
