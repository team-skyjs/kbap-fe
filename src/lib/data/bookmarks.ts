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
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import i18n from '../i18n';
import type { RiskState } from '@/lib/theme';
import type { FoodCard, FoodDetail } from '../api/types';
import type { MenuSummaryWire, PageMenuSummaryWire } from '../api/foodListTypes';
import { api, apiLang } from '../api/client';
import { adaptMenuSummary } from '../api/foodAdapter';
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

/** 서버 북마크 목록 — 커서 무한스크롤, 카드는 목록과 동일 어댑터. */
export function useBookmarks() {
  const isGuest = useIsGuest();
  return useInfiniteQuery({
    queryKey: QK(),
    enabled: !isGuest, // 인증 필수 API — 게스트는 게이트로 진입 자체가 차단됨
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }): Promise<PageMenuSummaryWire> => {
      const cursor = pageParam != null ? `cursor=${encodeURIComponent(String(pageParam))}&` : '';
      return api.get<PageMenuSummaryWire>(`/bookmarks?${cursor}lang=${apiLang()}`);
    },
    getNextPageParam: (last) => (last.hasNext && last.nextCursor != null ? last.nextCursor : undefined),
    select: (data) => data.pages.flatMap((p) => p.items.map(adaptMenuSummary)),
  });
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
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK(), ctx.prev);
      if (ctx?.prevDetail) qc.setQueryData(ctx.detailKey, ctx.prevDetail);
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
