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
