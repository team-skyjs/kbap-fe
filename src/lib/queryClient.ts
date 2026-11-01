/**
 * Shared TanStack Query client. Provided once at the app root (_layout.tsx).
 * In MOCK_MODE queryFns resolve synchronously from mock JSON.
 */
import { QueryClient } from '@tanstack/react-query';

/** P-164: 4xx(클라 오류)는 재시도해도 결과가 같다 — 재시도 금지(dev 404 연발 실증).
 *  5xx·네트워크(NETWORK 프리픽스, status 없음)만 기존 1회 재시도 유지. 전역 단일 지점. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (status != null && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
  },
});

/** KB-954(P-570): 위험도·판정을 담은 키 접두 — 회피 기준이 바뀌면 옛 값을 보여 주면 안 되는 것들 */
export const RISK_QUERY_KEYS = [['home'], ['foods'], ['food'], ['bookmarks'], ['processedFoods']] as const;
const isRiskKey = (key: readonly unknown[]) => RISK_QUERY_KEYS.some((p) => p.every((v, i) => key[i] === v));

/** 회피 기준 변경(프로필 저장·온보딩 완료) — 위험도 키는 reset(재조회 동안 옛 Safe 대신 스켈레톤, 실패 = 오류 → false-safe 창 0,
 *  무한 목록은 첫 페이지부터), 나머지는 invalidate(활성 재조회). clear()와 달리 마운트된 옵저버도 다시 받는다. */
export function resetPersonalizedQueries(qc: QueryClient = queryClient, opts: { riskOnly?: boolean } = {}): Promise<unknown> {
  return Promise.all([
    ...RISK_QUERY_KEYS.map((queryKey) => qc.resetQueries({ queryKey })),
    // riskOnly = 프로필 재조회가 바뀐 회피를 발견한 경로(Codex #388 P1) — 나머지·['me']는 방금 받았으니 다시 부르지 않는다(루프 0)
    ...(opts.riskOnly ? [] : [qc.invalidateQueries({ predicate: (q) => !isRiskKey(q.queryKey) })]),
  ]);
}
