/**
 * KB-954(P-570): 당겨서 새로고침 공용 — 화면 자기 키 + ['me'](다른 기기 회피 변경·쿼터) 무효화, 활성 재조회가 끝날 때까지 스피너.
 * 홈·Dishes·Reviews는 기존 자체 핸들러(목록 refetch 규칙이 화면마다 달라)에 ['me']만 더했다.
 */
import * as React from 'react';
import { QueryClientContext, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

/** 화면 Provider의 클라이언트, 없으면 앱 싱글턴(홈 새로고침과 같은 대상) — useQueryClient는 Provider 없으면 throw */
export function useRefreshClient(): QueryClient {
  return React.useContext(QueryClientContext) ?? queryClient;
}

export function usePullRefresh(keys: QueryKey[]): { refreshing: boolean; onRefresh: () => void } {
  const qc = useRefreshClient();
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    void Promise.all([...keys, ['me']].map((queryKey) => qc.invalidateQueries({ queryKey }))).finally(() => setRefreshing(false));
  };
  return { refreshing, onRefresh };
}
