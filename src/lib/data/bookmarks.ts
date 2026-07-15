/**
 * bookmarks.ts — 북마크, KB-142 실연결 (2026-07-15, BE Swagger 배포 확인).
 *
 * 계약: GET /bookmarks?cursor=&lang= (커서 무한스크롤, items=목록 카드 동형)
 *      POST /bookmarks {foodId:number} 등록 · ⚠️ 취소는 PATCH /bookmarks/{foodId}
 *      (DELETE 아님). 전부 인증 필수.
 *
 * 계약 갭: GET /foods/{id}에 bookmarked 필드가 없어 상세 저장 버튼의 초기
 * 상태를 서버가 안 준다 → GET /bookmarks로 채운 목록 캐시에서 유도
 * (useIsBookmarked) + 낙관적 토글. 로드된 페이지 밖의 북마크는 초기에 저장
 * 안 된 것으로 보일 수 있음 — "상세 응답에 bookmarked 추가" BE 질의 기록
 * (맵기 필드 선례). 훅 표면은 로컬 시절과 동일(화면 수정 최소).
 *
 * 게스트: 진입 자체가 게이트로 차단(KB-78/⑧-b)이지만 쿼리도 세션 없으면
 * 비활성(enabled) — 401 노이즈 방지.
 */
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import i18n from '../i18n';
import type { RiskState } from '@/lib/theme';
import type { FoodCard } from '../api/types';
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

/** 상세 저장 버튼 초기 상태 — 로드된 북마크 페이지에서 유도(계약 갭 임시 대응). */
export function useIsBookmarked(foodId: string): boolean {
  const { data } = useBookmarks();
  return (data ?? []).some((b) => b.foodId === foodId);
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
 * 상세 화면 저장 토글 — 현재 캐시 기준 add면 POST, remove면 PATCH.
 * 낙관적 즉시 반영, 실패 시 롤백(에러 토스트는 호출측 onError).
 */
export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (snap: BookmarkSnapshot) => {
      const bookmarked = (qc.getQueryData<Pages>(QK())?.pages ?? []).some((p) =>
        p.items.some((it) => it.foodId === Number(snap.foodId)),
      );
      // 낙관적 판단과 요청이 어긋나지 않게 mutationFn 진입 시점 상태로 분기
      if (bookmarked) {
        await api.patch(`/bookmarks/${snap.foodId}`); // ⚠️ 취소 = PATCH (DELETE 아님)
      } else {
        await api.post('/bookmarks', { foodId: Number(snap.foodId) });
      }
    },
    onMutate: async (snap) => {
      await qc.cancelQueries({ queryKey: QK() });
      const wasBookmarked = (qc.getQueryData<Pages>(QK())?.pages ?? []).some((p) =>
        p.items.some((it) => it.foodId === Number(snap.foodId)),
      );
      const prev = optimisticWrite(qc, snap.foodId, wasBookmarked ? null : toWire(snap));
      return { prev };
    },
    onError: (_e, _snap, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK(), ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['bookmarks'] }),
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
    onSettled: () => void qc.invalidateQueries({ queryKey: ['bookmarks'] }),
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
    onSettled: () => void qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  });
}
