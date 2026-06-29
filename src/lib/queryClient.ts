/**
 * Shared TanStack Query client. Provided once at the app root (_layout.tsx).
 * In MOCK_MODE queryFns resolve synchronously from mock JSON.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
