/**
 * useHome — home feed (KB-69 실연결 2026-07-13).
 *
 * LIVE: GET /home — 인증 선택 엔드포인트. 회원이면 3섹션(기피성분·인기5·
 * 최근스캔10) 전부, 비회원이면 authenticated=false + 개인화 배열 빈값 →
 * 화면이 가입 유도 UI로 분기. 스캔 이력은 서버가 보관(로컬 이력 계획 폐기).
 * 요약 어댑터는 목록/검색과 공유(adaptMenuSummary).
 */
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import i18n from '../i18n';
import type { HomeResponse } from '../api/types';
import type { MenuSummaryWire } from '../api/foodListTypes';
import { api } from '../api/client';
import { adaptMenuSummary } from '../api/foodAdapter';
import { MOCK_HOME } from '../mocks/foods';

/** 오프라인 데모용 스위치 — 게스트도 LIVE가 정상 경로다. */
const MOCK_MODE_HOME = false;

interface HomeWire {
  authenticated: boolean;
  avoidedSubstances: { code: string; name: string }[];
  popularFoods: MenuSummaryWire[];
  recentScans: MenuSummaryWire[];
}

/** 홈 피드 fetch — 훅과 부트 프리페치(P-018 bootGate)가 공유. */
export async function fetchHome(): Promise<HomeResponse> {
  if (MOCK_MODE_HOME) return MOCK_HOME;
  const wire = await api.get<HomeWire>('/home');
  return {
    authenticated: wire.authenticated,
    avoided: wire.avoidedSubstances ?? [],
    recommended: (wire.popularFoods ?? []).map(adaptMenuSummary),
    recent: (wire.recentScans ?? []).map(adaptMenuSummary),
  };
}

export function useHome() {
  const query = useQuery({
    // 언어 전환 시 성분명·음식명 재지역화
    queryKey: ['home', i18n.language],
    queryFn: fetchHome,
  });

  // KB-68 반려 #2: 탭 화면은 언마운트되지 않아 홈 복귀만으로는 재조회가 없다 —
  // 포커스 시 stale(기본 staleTime 60s 경과 또는 invalidate됨)일 때만 재조회.
  // 전면 폴링 아님: fresh하면 no-op.
  const stale = React.useRef(false);
  stale.current = query.isStale;
  const refetch = query.refetch;
  useFocusEffect(
    React.useCallback(() => {
      if (stale.current) void refetch();
    }, [refetch]),
  );

  return query;
}
