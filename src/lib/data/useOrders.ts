/**
 * useOrders (P-253/KB-360 1차) — 주문 이력 조회: GET /api/orders(커서)·/{orderId}.
 * 조회 전용이었으나 KB-638(P-413, 서버 #297)로 **편집**이 생겼다 — 뮤테이션은 useOrderEdit.ts, 여기는
 * 조회·어댑터·표시 헬퍼. 편집 응답(OrderDetailResponse)도 같은 adaptOrderDetail을 탄다.
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
  /** P-386(KB-456, BE #245): 장소 — prod 미반영(다음 릴리스)이라 부재/null이면 roadAddress 경로 그대로. */
  place?: { placeId?: string | null; name?: string | null; address?: string | null; language?: string | null } | null;
}

interface OrderItemWire {
  menuName?: string | null;
  quantity?: number;
  price?: number | null; // null = 스캔 가격 미인식(총액 제외)
  foodId?: number | null;
  imageRef?: string | null;
  /** P-259(계약 8/21): false = 준비중 음식(상세 호출 시 FOOD-001). 부재 = 공개 취급. */
  ready?: boolean;
  /** KB-572(서버 #270, 9/21): false = 실사진 없음(서버가 대체 이미지를 준 경우).
   *  `imageRef`만으론 실사진과 대체 이미지를 구분할 수 없어서 추가된 필드. 부재 = 모름. */
  hasPhoto?: boolean;
  /** KB-638(서버 #297): 항목 식별자 — 사진 편집 경로(items/{itemId}/image)에 필요. 구응답·캐시엔 없다. */
  id?: number | null;
  /** KB-638: 회원이 직접 올린 사진(있으면 카탈로그 imageRef보다 우선 표시 — orderItemImage). */
  userImageUrl?: string | null;
}

export interface OrderDetailWire extends OrderSummaryWire {
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
  /** P-386: 서버 장소명 — 부재(구응답·미태그) = null. 표시 판단은 orderPlaceLabel 한 곳. */
  placeName: string | null;
  /** P-380(KB-518): 장소 주소(회원 언어 해석) — 공유 카드 메타줄 도시 추출용. */
  placeAddress: string | null;
  totalQuantity: number;
  thumbnails: string[]; // 서버 구성(최대 4·기본 이미지 포함) — URL만 통과
  scanImageUrl: string | null;
}

export interface OrderItem {
  /** null = 구응답(서버 #297 이전 캐시) — 사진 편집 불가 */
  id: string | null;
  menuName: string;
  quantity: number;
  price: number | null;
  foodId: string | null;
  /** 카탈로그 대표 사진(대체 이미지 포함 — hasPhoto로 구분) */
  imageUrl: string | null;
  /** 회원 사진 — 표시는 orderItemImage 한 곳을 통해서만 */
  userImageUrl: string | null;
  ready?: boolean;
  hasPhoto?: boolean;
}

export interface OrderDetail extends OrderSummary {
  totalPrice: number | null;
  items: OrderItem[];
}

function adaptSummary(w: OrderSummaryWire): OrderSummary {
  return {
    orderId: String(w.orderId),
    orderedAt: w.orderedAt,
    roadAddress: w.roadAddress ?? null, // null = 위치 미동의·변환 실패 — 표기 생략
    placeName: w.place?.name?.trim() || null, // 빈 문자열도 null — 빈 줄 렌더 금지
    placeAddress: w.place?.address?.trim() || null,
    totalQuantity: w.totalQuantity ?? 0,
    thumbnails: (w.thumbnails ?? []).map(urlOrNull).filter((u): u is string => !!u).slice(0, 4),
    scanImageUrl: urlOrNull(w.scanImageUrl),
  };
}

/**
 * P-386(KB-456): 주문 행·상세 제목의 장소 라벨 = 식당명 우선, 없으면 주소, 둘 다 없으면 null.
 * null이면 줄 자체를 렌더하지 않는다(빈 공백 금지) — 호출부 3곳이 이 한 규칙을 공유.
 */
export function orderPlaceLabel(order: { placeName?: string | null; roadAddress?: string | null }): string | null {
  return order.placeName?.trim() || order.roadAddress?.trim() || null;
}

/**
 * KB-638(P-413 D2): 항목 사진 표시 우선순위 — **회원 사진 > 카탈로그 사진**. 상세 썸네일·공유 카드(sharePhotos)
 * 둘 다 이 한 곳을 통한다(My Foods 카드는 서버 thumbnails가 같은 우선순위로 조립 — 클라 무변).
 */
export function orderItemImage(item: { userImageUrl?: string | null; imageUrl: string | null }): string | null {
  return item.userImageUrl ?? item.imageUrl;
}

/** OrderDetailResponse → OrderDetail. 조회(GET)와 편집 응답(PATCH/PUT/DELETE) 공용 — 응답 후 반영은 이걸로 캐시를 통째로 교체한다. */
export function adaptOrderDetail(w: OrderDetailWire): OrderDetail {
  return {
    ...adaptSummary(w),
    totalPrice: typeof w.totalPrice === 'number' ? w.totalPrice : null,
    items: (w.items ?? []).map((i) => ({
      id: i.id != null ? String(i.id) : null,
      menuName: i.menuName ?? '',
      quantity: i.quantity ?? 0,
      price: typeof i.price === 'number' ? i.price : null, // null = 단가 미표시
      foodId: i.foodId != null ? String(i.foodId) : null,
      imageUrl: urlOrNull(i.imageRef),
      userImageUrl: urlOrNull(i.userImageUrl),
      // P-259: ready = 서버 boolean만 통과(부재 = 공개 폴백 — 게이트는 === false).
      // 기본 이미지 URL 문자열로 준비중 판단 금지(종한 명시) — 이 필드가 유일 기준.
      ...(typeof i.ready === 'boolean' ? { ready: i.ready } : {}),
      // KB-572: hasPhoto도 같은 문법 — 서버 boolean만 통과, 부재는 키를 안 만든다.
      // 소비처(sharePhotos)가 `!== false`로 보므로 부재 = 기존 동작 유지.
      ...(typeof i.hasPhoto === 'boolean' ? { hasPhoto: i.hasPhoto } : {}),
    })),
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
    queryFn: async (): Promise<OrderDetail> => adaptOrderDetail(await api.get<OrderDetailWire>(`/api/orders/${orderId}`)),
  });
}
