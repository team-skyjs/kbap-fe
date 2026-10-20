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
import { useAppLanguage } from '../i18n/useAppLanguage';
import type { HomeResponse } from '../api/types';
import type { MenuSummaryWire, TopRatedFoodWire } from '../api/foodListTypes';
import { api, apiLang } from '../api/client';
import { adaptMenuSummary, adaptTopRatedFood } from '../api/foodAdapter';
import { MOCK_HOME } from '../mocks/foods';

/** 오프라인 데모용 스위치 — 게스트도 LIVE가 정상 경로다. */
const MOCK_MODE_HOME = false;

/** KB-785: GET /home 전용 X-API-Version — 다른 엔드포인트는 client.ts 기본값.
 *  KB-800: 1.3 = 1.2(마케팅 인기) + topRatedFoods. 1.3 을 모르는 서버는 거절 → BE 배포 후 릴리스. */
export const HOME_API_VERSION = '1.3';

interface HomeWire {
  authenticated: boolean;
  avoidedSubstances: { code: string; name: string }[];
  popularFoods: MenuSummaryWire[];
  /** P-393(KB-580, BE #273): 활성 리뷰 수 내림차순·READY만·최대 10. 구 서버엔 없다. */
  mostReviewedFoods?: MenuSummaryWire[] | null;
  recentScans: MenuSummaryWire[];
  /** KB-800: 1.3 이상만 — 활성 리뷰 수↓·총평점↓·foodId↓, 최대 20. 1.2 이하 서버는 키 부재. */
  topRatedFoods?: TopRatedFoodWire[] | null;
}

/** 홈 피드 fetch — 훅과 부트 프리페치(P-018 bootGate)가 공유. */
export async function fetchHome(): Promise<HomeResponse> {
  if (MOCK_MODE_HOME) return MOCK_HOME;
  // KB-199(P-023): lang 필수 승격(BE 7/20 밤) — 미전송 시 홈 400. /foods와 동일 패턴.
  // 표시 언어를 파라미터가 담당해 Q-13 언어 전환 잔상·게스트/미설정 영어도 해소
  // (회원 DB appLanguage 기반 번역 → 요청 언어 기반).
  // KB-785: 홈만 1.2 — popularFoods가 조회 수 집계 → 운영 풀(food_marketing_popular) 무작위 10개.
  // 응답 형태는 1.1과 동일(dev Swagger) — HomeWire 무변. 기본 API_VERSION_HEADER·타 엔드포인트는 그대로.
  const wire = await api.get<HomeWire>(`/home?lang=${apiLang()}`, { headers: { 'X-API-Version': HOME_API_VERSION } });
  return {
    authenticated: wire.authenticated,
    avoided: wire.avoidedSubstances ?? [],
    recommended: (wire.popularFoods ?? []).map(adaptMenuSummary),
    // P-393: 필드 부재(구 서버) = 빈 배열 → 섹션 자체가 안 뜬다
    mostReviewed: (wire.mostReviewedFoods ?? []).map(adaptMenuSummary),
    recent: (wire.recentScans ?? []).map(adaptMenuSummary),
    // KB-800: 부재·null = 빈 배열 → 섹션 숨김(CTA 만)
    topRated: (wire.topRatedFoods ?? []).map(adaptTopRatedFood),
  };
}

export function useHome() {
  const lang = useAppLanguage(); // KB-695: 구독 — 렌더 중 i18n.language 직접 읽기는 컴파일러가 키를 굳힌다
  const query = useQuery({
    // 언어 전환 시 성분명·음식명 재지역화
    queryKey: ['home', lang],
    queryFn: fetchHome,
  });

  // KB-68 반려 #2: 탭 화면은 언마운트되지 않아 홈 복귀만으로는 재조회가 없다 —
  // 포커스 시 stale(기본 staleTime 60s 경과 또는 invalidate됨)일 때만 재조회.
  // 전면 폴링 아님: fresh하면 no-op.
  const stale = React.useRef(false);
  // KB-657: 최신값 ref는 렌더 중이 아니라 커밋(layout effect)에서 동기화 — 리더는 전부 이벤트·리스너·passive effect(layout 뒤)
  React.useLayoutEffect(() => {
    stale.current = query.isStale;
  });
  const refetch = query.refetch;
  useFocusEffect(
    React.useCallback(() => {
      if (stale.current) void refetch();
    }, [refetch]),
  );

  return query;
}
