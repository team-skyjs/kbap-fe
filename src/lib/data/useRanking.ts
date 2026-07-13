/**
 * useRanking — 랭킹 디테일 (KB-74 실연결 2026-07-13).
 * LIVE: GET /members/me/ranking (AUTH) — breakdown(리뷰·다양성·스캔) 포함.
 * BE 세션 없으면(비회원/웹) mock — 게이트는 KB-77에서.
 *
 * ⚠️ 서버 tier 문자열이 내부 tier 키(newcomer|taster|…)와 일치하는지 실기기
 * 확인 필요 — 불일치하면 tierByKey 매핑 테이블 추가 (relink-progress.md).
 */
import { useQuery } from '@tanstack/react-query';
import type { Ranking } from '../api/types';
import { api } from '../api/client';
import { adaptRanking, type MemberRankingWire } from '../api/memberAdapter';
import { hasBeSession } from '../auth/beAuth';
import { MOCK_RANKING_DETAIL } from '../mocks/ranking';

export function useRanking() {
  return useQuery({
    queryKey: ['me', 'ranking'],
    queryFn: async (): Promise<Ranking> => {
      if (!(await hasBeSession())) return MOCK_RANKING_DETAIL;
      const wire = await api.get<MemberRankingWire>('/members/me/ranking');
      return adaptRanking(wire);
    },
  });
}
