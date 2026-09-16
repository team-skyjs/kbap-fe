/**
 * useNotifications (KB-499) — 알림함 **서버 정본** 훅.
 *
 * GET /api/notifications(최근 7일·id 내림차순·이 기기 = X-Installation-Id, 공용 클라가 자동 첨부) 하나가
 * 알림함 화면과 헤더 종 배지의 단일 소스. 미읽음 수 엔드포인트는 없다(KB-467) — `read === false` 개수를
 * 같은 쿼리에서 select로 파생한다(요청 1회 공유). 로컬 저장 0(구 로컬 스토어 P-289 소멸, P-147).
 *
 * 활성 조건 = 세션 **확정 true**만(useSession). 게스트(false)·부팅 미확정(null) 모두 요청 0·배지 0 —
 * `!useIsGuest()`는 미확정을 회원으로 봐 콜드 스타트 게스트 기기에서 401이 한 번 나간다(research R-2).
 *
 * 읽음 PATCH는 항목 단위·멱등 → 낙관 반영 + 실패 롤백. **세션 세대(currentGen)가 같을 때만** 응답/롤백을
 * 반영해 계정 전환 중 이전 계정 목록이 clear된 캐시에 되살아나지 않게 한다(Codex #150 P1 계열).
 * 멱등 낙관 토글이라 useSubmitGuard 예외(CLAUDE.md).
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toInboxItem, type InboxItem, type NotificationWire } from '@/lib/api/notificationAdapter';
import { hasBeSession } from '@/lib/auth/beAuth';
import { currentGen } from '@/lib/auth/beTokens';
import { useSession } from '@/lib/auth/useSession';
import { queryClient as sharedQueryClient } from '@/lib/queryClient';

export const NOTIFICATIONS_KEY = ['notifications'] as const;
const PATH = '/api/notifications';

export async function fetchNotifications(): Promise<InboxItem[]> {
  const list = await api.get<NotificationWire[]>(PATH);
  return (list ?? []).map(toInboxItem);
}

export async function markNotificationRead(id: number): Promise<InboxItem> {
  return toInboxItem(await api.patch<NotificationWire>(`${PATH}/${id}/read`));
}

/** 목록 재조회 — 앱 포그라운드 복귀·푸시 수신/탭·읽음 후(FR-010). 쿼리가 비활성(게스트)이면 no-op. */
export function invalidateNotifications(qc: QueryClient = sharedQueryClient): void {
  void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
}

function useEnabled(): boolean {
  return useSession() === true;
}

export function useInbox() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
    staleTime: 0, // 화면 진입마다 서버 재확인(정본)
    enabled: useEnabled(),
  });
}

/** 헤더 종 배지 — 미읽음 개수(> 0이면 NEW 필). 게스트·미확정 = 0. */
export function useUnreadCount(): number {
  const q = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
    staleTime: 0,
    enabled: useEnabled(),
    select: (list: InboxItem[]) => list.filter((i) => !i.read).length,
  });
  return q.data ?? 0;
}

type Ctx = { prevRead: boolean | undefined; gen: number };

/**
 * 읽음 = 항목 단위 낙관. Codex 리뷰(#163): 스냅샷을 목록 전체로 잡으면 A·B를 연달아 탭했을 때 뒤 요청의 롤백이 앞 요청의
 * 낙관 상태를 되살리거나 앞 요청 실패가 뒤 요청의 성공을 지운다 → 되돌리는 것도 **그 항목의 이전 read 값 하나**.
 * 성공 = 서버가 돌려준 항목으로 교체(정본, 재조회 없음). 실패 = 항목 원복 + 보정 재조회.
 */
export function useMarkRead() {
  const qc = useQueryClient();
  const patchItem = (id: number, f: (i: InboxItem) => InboxItem) =>
    qc.setQueryData<InboxItem[]>(NOTIFICATIONS_KEY, (cur) => cur?.map((i) => (i.id === id ? f(i) : i)));
  return useMutation<InboxItem, unknown, number, Ctx>({
    mutationFn: markNotificationRead,
    onMutate: (id) => {
      void qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const prevRead = qc.getQueryData<InboxItem[]>(NOTIFICATIONS_KEY)?.find((i) => i.id === id)?.read;
      if (prevRead !== undefined) patchItem(id, (i) => ({ ...i, read: true }));
      return { prevRead, gen: currentGen() };
    },
    onSuccess: (res, _id, ctx) => {
      if (ctx && ctx.gen === currentGen()) patchItem(res.id, () => res);
    },
    onError: (_e, id, ctx) => {
      if (ctx?.prevRead !== undefined && ctx.gen === currentGen()) {
        const prevRead = ctx.prevRead;
        patchItem(id, (i) => ({ ...i, read: prevRead }));
      }
      invalidateNotifications(qc); // 보정 — 서버 값이 정본
    },
  });
}

/**
 * 푸시 탭 진입 — data.notificationId(이 기기 알림 행 id)를 읽음 처리하고 목록을 재조회한다(FR-009).
 * 콜드 스타트엔 세션 스토어가 아직 null일 수 있어 토큰 기반 hasBeSession()으로 판정(registerPushToken과 동일).
 * 게스트 기기 = 이동만. 404(타 기기·부재)·네트워크 실패는 비치명.
 */
export async function onPushTapped(notificationId?: number | string): Promise<void> {
  if (notificationId == null) return;
  const id = Number(notificationId);
  if (!Number.isFinite(id)) return;
  if (!(await hasBeSession())) return;
  try {
    await markNotificationRead(id);
  } catch {
    /* 비치명 — 재조회가 서버 값을 가져온다 */
  }
  invalidateNotifications();
}
