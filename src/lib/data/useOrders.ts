/**
 * useOrders (P-253/KB-360 1차) — 주문 이력 조회: GET /api/orders(커서)·/{orderId}.
 * **read-only**(수정 계약 부재 — 예진×종한 합의로 스코프 제외 확정). 저장은 P-252.
 * dev 전용(prod 서버 미배포 — 진입점이 회원 프로필 안이라 채널 게이트는 화면 몫 아님,
 * 실패 = 표준 에러 블록).
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/** 절대 URL만 통과(refToUrl 규칙 — 렌더 불가 값 차단). */
function urlOrNull(v: string | null | undefined): string | null {
  return v && /^https?:\/\//.test(v) ? v : null;
}

interface OrderSummaryWire {
  orderId: number;
  orderedAt: number; // epoch ms
  roadAddress?: string | null;
  totalQuantity?: number;
  thumbnails?: (string | null)[] | null;
  scanImageUrl?: string | null;
}

interface OrderItemWire {
  menuName?: string | null;
  quantity?: number;
  price?: number | null; // null = 스캔 가격 미인식(총액 제외)
  foodId?: number | null;
  imageRef?: string | null;
  /** P-259(계약 8/21): false = 준비중 음식(상세 호출 시 FOOD-001). 부재 = 공개 취급. */
  ready?: boolean;
}

interface OrderDetailWire extends OrderSummaryWire {
  totalPrice?: number | null;
  items?: OrderItemWire[] | null;
}

interface OrderListPageWire {
  items?: OrderSummaryWire[] | null;
  hasNext?: boolean;
  nextCursor?: string | null;
}

export interface OrderSummary {
  orderId: string;
  orderedAt: number;
  roadAddress: string | null;
  totalQuantity: number;
  thumbnails: string[]; // 서버 구성(최대 4·기본 이미지 포함) — URL만 통과
  scanImageUrl: string | null;
}

export interface OrderDetail extends OrderSummary {
  totalPrice: number | null;
  items: { menuName: string; quantity: number; price: number | null; foodId: string | null; imageUrl: string | null; ready?: boolean }[];
}

function adaptSummary(w: OrderSummaryWire): OrderSummary {
  return {
    orderId: String(w.orderId),
    orderedAt: w.orderedAt,
    roadAddress: w.roadAddress ?? null, // null = 위치 미동의·변환 실패 — 표기 생략
    totalQuantity: w.totalQuantity ?? 0,
    thumbnails: (w.thumbnails ?? []).map(urlOrNull).filter((u): u is string => !!u).slice(0, 4),
    scanImageUrl: urlOrNull(w.scanImageUrl),
  };
}

export function useOrders(enabled = true) {
  return useInfiniteQuery({
    queryKey: ['orders'],
    initialPageParam: undefined as string | undefined,
    enabled,
    queryFn: async ({ pageParam }): Promise<OrderListPageWire> =>
      api.get<OrderListPageWire>(`/api/orders${pageParam != null ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (last) => (last.hasNext && last.nextCursor != null ? last.nextCursor : undefined),
    select: (data) => data.pages.flatMap((p) => (p.items ?? []).map(adaptSummary)),
  });
}

export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: ['orders', orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<OrderDetail> => {
      const w = await api.get<OrderDetailWire>(`/api/orders/${orderId}`);
      return {
        ...adaptSummary(w),
        totalPrice: typeof w.totalPrice === 'number' ? w.totalPrice : null,
        items: (w.items ?? []).map((i) => ({
          menuName: i.menuName ?? '',
          quantity: i.quantity ?? 0,
          price: typeof i.price === 'number' ? i.price : null, // null = 단가 미표시
          foodId: i.foodId != null ? String(i.foodId) : null,
          imageUrl: urlOrNull(i.imageRef),
          // P-259: ready = 서버 boolean만 통과(부재 = 공개 폴백 — 게이트는 === false).
          // 기본 이미지 URL 문자열로 준비중 판단 금지(종한 명시) — 이 필드가 유일 기준.
          ...(typeof i.ready === 'boolean' ? { ready: i.ready } : {}),
        })),
      };
    },
  });
}
