/**
 * useOrderEdit (KB-638 / P-413, 서버 #297) — 주문 편집 뮤테이션 3종. 조회·어댑터는 useOrders.ts.
 *
 * - 장소 교체: PATCH /api/orders/{id}/place `{placeId, name, address?, language}` — 검색 결과만(D3, placeId 필수)
 * - 항목 사진: PUT /api/orders/{id}/items/{itemId}/image `{imagePath}` — 업로드는 기존 2단계
 *   (upload-url → 스토리지 PUT → complete)에 purpose=ORDER_ITEM. complete를 건너뛰면 IMAGE-007.
 * - 기본 사진으로: DELETE 같은 경로(멱등)
 *
 * 세 응답 모두 갱신된 OrderDetailResponse → **응답 후 반영**(P-387: 낙관 갱신 금지) — 상세 캐시를 응답으로
 * 통째로 교체하고 목록(['orders'])은 무효화(서버 thumbnails가 회원 사진 우선으로 조립). 실패 = 토스트만,
 * 캐시는 원상태(건드린 적이 없다).
 * 토스트는 여기 한 곳(P-339 ⑤ 문법) — 화면은 호출만.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from '../i18n';
import { api, apiLang, ApiError } from '@/lib/api/client';
import { uploadImage } from '@/lib/api/scanImage';
import { showTopToast } from '@/components/topToastStore';
import { adaptOrderDetail, type OrderDetail, type OrderDetailWire } from './useOrders';

/** dev Swagger UploadUrlRequest.purpose enum 실측(9/23): … | ORDER_ITEM */
export const ORDER_ITEM_IMAGE_PURPOSE = 'ORDER_ITEM';

/** 실패 토스트 분기 — 서버 코드로만(status 아님). 그 외·네트워크 = 일반 실패. */
export function orderEditErrorKey(e: unknown): string {
  const code = e instanceof ApiError ? e.code : undefined;
  if (code === 'IMAGE-007') return 'myFoods.editPhotoNotReady'; // 본인 ORDER_ITEM 업로드가 아님(complete 누락 포함)
  if (code === 'ORDER-002' || code === 'ORDER-004') return 'myFoods.editNotFound'; // 타인·없는 주문 / 항목이 그 주문에 없음
  return 'myFoods.editFailed';
}

function useApplyOrderDetail() {
  const qc = useQueryClient();
  return (detail: OrderDetail) => {
    qc.setQueryData<OrderDetail>(['orders', detail.orderId], detail);
    void qc.invalidateQueries({ queryKey: ['orders'], exact: true }); // 목록 카드 thumbnails — 상세(['orders', id])는 방금 교체했으니 제외
  };
}

const onEditError = (e: unknown) => showTopToast(i18n.t(orderEditErrorKey(e)), { error: true });

/** 검색 결과 하나로 교체 — 페이로드는 리뷰 장소 태그와 같은 모양 + language(필수) = 검색을 보낸 언어. */
export function useUpdateOrderPlace() {
  const apply = useApplyOrderDetail();
  return useMutation({
    mutationFn: async ({ orderId, place }: { orderId: string; place: { placeId: string; name: string; roadAddress: string | null } }) =>
      adaptOrderDetail(
        await api.patch<OrderDetailWire>(`/api/orders/${orderId}/place`, {
          placeId: place.placeId,
          name: place.name,
          ...(place.roadAddress ? { address: place.roadAddress } : {}),
          language: apiLang(),
        }),
      ),
    onSuccess: apply,
    onError: onEditError,
  });
}

/** 로컬 사진 → 업로드(ORDER_ITEM) → PUT. 업로드 실패도 같은 onError(토스트)로 — 부분 상태 없음(PUT 전이라 서버 무변). */
export function useSetOrderItemImage() {
  const apply = useApplyOrderDetail();
  return useMutation({
    mutationFn: async ({ orderId, itemId, uri }: { orderId: string; itemId: string; uri: string }) => {
      const { path } = await uploadImage({ uri, width: 0, height: 0 }, ORDER_ITEM_IMAGE_PURPOSE);
      return adaptOrderDetail(await api.put<OrderDetailWire>(`/api/orders/${orderId}/items/${itemId}/image`, { imagePath: path }));
    },
    onSuccess: apply,
    onError: onEditError,
  });
}

export function useResetOrderItemImage() {
  const apply = useApplyOrderDetail();
  return useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      adaptOrderDetail(await api.del<OrderDetailWire>(`/api/orders/${orderId}/items/${itemId}/image`)),
    onSuccess: apply,
    onError: onEditError,
  });
}
