/**
 * bookmarks.ts — 북마크, KB-142 실연결 (2026-07-15, BE Swagger 배포 확인).
 *
 * 계약: GET /bookmarks?cursor=&lang= (커서 무한스크롤, items=목록 카드 동형)
 *      POST /bookmarks {foodId:number} 등록 · ⚠️ 취소는 PATCH /bookmarks/{foodId}
 *      (DELETE 아님). 전부 인증 필수.
 *
 * 상세 저장 상태: 계약 갭 해소됨(2026-07-15 Swagger 재배포 — FoodDetailResponse에
 * bookmarked 추가, BE 질의 반영). 상세 화면은 상세 응답의 bookmarked를 쓰고,
 * 토글의 낙관 쓰기가 목록 캐시(['bookmarks'])와 상세 캐시(['food', id, lang])
 * 둘 다 갱신한다. 목록 캐시 유도 방식(useIsBookmarked)은 사용처가 없어져 제거.
 *
 * 게스트: 진입 자체가 게이트로 차단(KB-78/⑧-b)이지만 쿼리도 세션 없으면
 * 비활성(enabled) — 401 노이즈 방지.
 */
import * as React from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import i18n from '../i18n';
import type { RiskState } from '@/lib/theme';
import type { FoodCard, FoodDetail } from '../api/types';
import type { MenuSummaryWire, PageMenuSummaryWire } from '../api/foodListTypes';
import { api, apiLang } from '../api/client';
import { showTopToast } from '@/components/topToastStore';
import { adaptMenuSummary, riskWireOf, type RiskFilterChip } from '../api/foodAdapter';
import { useIsGuest } from '../auth/useSession';


const QK = () => ['bookmarks', i18n.language] as const;

/** 낙관적 프리펜드용 — FE 스냅샷 → 와이어 카드 (risk 역매핑, 알 수 없으면 UNKNOWN). */
const RISK_TO_WIRE: Record<RiskState, MenuSummaryWire['overallRiskStatus']> = {
  safe: 'SAFE',
  caution: 'CAUTION',
  danger: 'DANGER',
  unable: 'UNKNOWN',
};

export type BookmarkSnapshot = {
  foodId: string;
  name: string;
  nameKo: string;
  risk: RiskState;
  photoUrl: string | null;
};

function toWire(snap: BookmarkSnapshot): MenuSummaryWire {
  return {
    foodId: Number(snap.foodId) || 0,
    name: snap.name,
    koreanName: snap.nameKo,
    imageRef: snap.photoUrl, // full URL만 통과(refToUrl과 동일 규칙이라 재적용 무해)
    spiciness: 0,
    overallRiskStatus: RISK_TO_WIRE[snap.risk] ?? 'UNKNOWN',
  };
}

type Pages = InfiniteData<PageMenuSummaryWire, number | undefined>;

/** 서버 북마크 목록 — 커서 무한스크롤, 카드는 목록과 동일 어댑터.
 *  P-350(KB-492): risk = 서버 필터(&risk=SAFE 등) — 지정 시 쿼리키 분리.
 *  낙관 쓰기(optimisticWrite)는 무필터 캐시(QK)만 — risk 캐시는 onSettled
 *  invalidate(['bookmarks'] 접두)로 동기화. */
export function useBookmarks(risk?: RiskFilterChip) {
  const isGuest = useIsGuest();
  const wire = riskWireOf(risk);
  return useInfiniteQuery({
    queryKey: wire ? ([...QK(), wire] as const) : QK(),
    enabled: !isGuest, // 인증 필수 API — 게스트는 게이트로 진입 자체가 차단됨
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }): Promise<PageMenuSummaryWire> => {
      const cursor = pageParam != null ? `cursor=${encodeURIComponent(String(pageParam))}&` : '';
      const riskQ = wire ? `&risk=${wire}` : '';
      return api.get<PageMenuSummaryWire>(`/bookmarks?${cursor}lang=${apiLang()}${riskQ}`);
    },
    // P-332(KB-488): 종료 가드 — hasNext만 믿으면 커서가 전진하지 않는 경계 응답
    // (커서 에코)에서 드레인/스크롤이 무한 fetch = 홈 프리징. 이미 요청한 커서
    // 재등장 = 강제 종료(서버 응답 불변식에 앱 생사를 걸지 않는다).
    // P-350(KB-492): 구 "빈 페이지 = 종료" 가드는 제거 — risk 필터의 얇은 페이지
    // (items 0·hasNext true)가 정상 계약이 됨. 무한 방지는 커서 에코 가드 + 서버
    // 5배치 상한이 담당.
    getNextPageParam: (last, _pages, lastParam, allParams) =>
      last.hasNext && last.nextCursor != null &&
      last.nextCursor !== lastParam && !allParams.includes(last.nextCursor)
        ? last.nextCursor
        : undefined,
    select: (data) => data.pages.flatMap((p) => p.items.map(adaptMenuSummary)),
  });
}

/** P-353 ⑤/#116 P2 ①: 북마크 판정 소스 공용 훅 — 전 페이지 드레인(P-332 가드
 *  문법: isFetching 가드 + cancelRefetch:false) + foodId Set. FoodExplorer·검색 등
 *  저장 배지/토글 판정은 전부 이 훅 경유(중복 드레인 배선 금지). */
export function useSavedIds(): Set<string> {
  const saved = useBookmarks();
  React.useEffect(() => {
    if (saved.hasNextPage && !saved.isFetchingNextPage && !saved.isFetching)
      void saved.fetchNextPage({ cancelRefetch: false });
  }, [saved.hasNextPage, saved.isFetchingNextPage, saved.isFetching, saved.fetchNextPage]);
  const data = saved.data;
  return React.useMemo(() => new Set((data ?? []).map((f) => f.foodId)), [data]);
}

/** 캐시(와이어 페이지)에 낙관적 add/remove. 이전 상태를 반환해 롤백에 쓴다. */
function optimisticWrite(
  qc: ReturnType<typeof useQueryClient>,
  foodId: string,
  add: MenuSummaryWire | null, // null = remove
): Pages | undefined {
  const key = QK();
  const prev = qc.getQueryData<Pages>(key);
  qc.setQueryData<Pages>(key, (cur) => {
    if (!cur) {
      return add
        ? { pages: [{ items: [add], hasNext: false }], pageParams: [undefined] }
        : cur;
    }
    const idNum = Number(foodId);
    const pages = cur.pages.map((p, i) => ({
      ...p,
      items: add && i === 0
        ? [add, ...p.items.filter((it) => it.foodId !== idNum)]
        : p.items.filter((it) => it.foodId !== idNum),
    }));
    return { ...cur, pages };
  });
  return prev;
}

/**
 * 상세 화면 저장 토글 — add면 POST, 해제면 PATCH. 낙관적 즉시 반영, 실패 시
 * 롤백(에러 토스트는 호출측 onError).
 *
 * ⚠️ add 여부는 호출측이 mutate 변수로 전달한다. RQ v5는 onMutate를
 * mutationFn보다 먼저 실행하므로, mutationFn이 캐시를 재독해 분기하면
 * 항상 "낙관 반영 후" 상태를 보고 요청이 역전된다(KB-142 반려 재현).
 */
export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ snap, add }: { snap: BookmarkSnapshot; add: boolean }) => {
      if (add) {
        await api.post('/bookmarks', { foodId: Number(snap.foodId) });
      } else {
        await api.patch(`/bookmarks/${snap.foodId}`); // ⚠️ 취소 = PATCH (DELETE 아님)
      }
    },
    onMutate: async ({ snap, add }) => {
      await qc.cancelQueries({ queryKey: QK() });
      const prev = optimisticWrite(qc, snap.foodId, add ? toWire(snap) : null);
      // 상세 캐시의 bookmarked도 즉시 반전 — 상세 화면 saved가 이 필드 기반 (KB-142 후속)
      const detailKey = ['food', snap.foodId, i18n.language] as const;
      const prevDetail = qc.getQueryData<FoodDetail>(detailKey);
      if (prevDetail) qc.setQueryData<FoodDetail>(detailKey, { ...prevDetail, bookmarked: add });
      return { prev, prevDetail, detailKey };
    },
    // P-339 ⑤(KB-494): 상단 토스트 = 이 뮤테이션 한 곳(전 표면 공용 — 화면별 배선 금지).
    // 저장 화면의 스와이프 해제(useRemoveBookmark)는 Undo 스낵바 현행 유지(중복 방지).
    onSuccess: (_d, { add }) => {
      showTopToast(i18n.t(add ? 'saved.toast' : 'saved.removed'));
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK(), ctx.prev);
      if (ctx?.prevDetail) qc.setQueryData(ctx.detailKey, ctx.prevDetail);
      showTopToast(i18n.t('saved.error'), { error: true }); // P-346: AlertTri 변형
    },
    onSettled: (_d, _e, { snap }) => {
      void qc.invalidateQueries({ queryKey: ['bookmarks'] });
      void qc.invalidateQueries({ queryKey: ['food', snap.foodId] });
    },
  });
}

/** Saved 리스트 스와이프 해제 — PATCH + 낙관적 제거. Undo는 restore(재등록)로. */
export function useRemoveBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (foodId: string) => {
      await api.patch(`/bookmarks/${foodId}`);
    },
    onMutate: async (foodId) => {
      await qc.cancelQueries({ queryKey: QK() });
      return { prev: optimisticWrite(qc, foodId, null) };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK(), ctx.prev);
    },
    onSettled: (_d, _e, foodId) => {
      void qc.invalidateQueries({ queryKey: ['bookmarks'] });
      void qc.invalidateQueries({ queryKey: ['food', foodId] }); // 상세 bookmarked 동기화
    },
  });
}

/** Undo — 재등록(POST). 서버 정렬(최신 등록순)상 맨 위로 복귀한다. */
export function useRestoreBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (snap: BookmarkSnapshot) => {
      await api.post('/bookmarks', { foodId: Number(snap.foodId) });
    },
    onMutate: async (snap) => {
      await qc.cancelQueries({ queryKey: QK() });
      return { prev: optimisticWrite(qc, snap.foodId, toWire(snap)) };
    },
    onError: (_e, _snap, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK(), ctx.prev);
    },
    onSettled: (_d, _e, snap) => {
      void qc.invalidateQueries({ queryKey: ['bookmarks'] });
      void qc.invalidateQueries({ queryKey: ['food', snap.foodId] }); // 상세 bookmarked 동기화
    },
  });
}
