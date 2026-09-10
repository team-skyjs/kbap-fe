/**
 * orders (P-252/KB-337 선행) — 주문 이력 저장: POST /api/orders.
 * 조회 UI(My Foods)는 D-20 시안 대기(KB-360) — 지금은 저장만 배선해 데이터를 쌓는다.
 *
 * - 호출 지점 = 주문 완료 확정(P-192 리마인더 예약과 같은 지점 — FlippedOrderCard).
 * - **실패 무해**: 이력은 부가 기능 — 실패해도 주문 완료 UX 무영향(콘솔 로그만).
 * - 위치(P-302/KB-455, 9/7 예진·종한): 주문 = 식당 위치의 **유일한 원본**(스캔 무저장
 *   확정) — 권한 **미결정(undetermined)만 1회 요청**, 이미 거부는 재요청 금지.
 *   거부·타임아웃(3s)·실패 = 무위치 주문(앱 내 사전 안내 없음 — 시스템 팝업만).
 * - items: foodId 필수(스키마) — 미매칭(foodId null) 항목은 이력에서 제외.
 *   menuName = 한국어 스냅샷(주문 카드 문법)·price = 스캔 단가(미인식 = 생략).
 * - imagePath = 스캔 식별자(스캔 1회당 주문 1회) — KB-419: 호출 경로 = 스캔 주문
 *   카드뿐(상세 발 주문 라우트 삭제)이라 항상 존재. 업로드 실패('')만 필드 생략.
 */
import { track } from '@/lib/net/inflight';
import { api } from '@/lib/api/client';
import type { OrderItem } from '@/features/order/FlippedOrderCard';

async function grantedCoord(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // P-192 관례: 지연 require — 구 런타임 번들 동승 시 크래시 0
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location') as typeof import('expo-location');
    let perm = await Location.getForegroundPermissionsAsync();
    // P-302: 미결정만 1회 요청 — 카드 flip은 호출측 fire-and-forget이라 표시를 안 막는다
    if (perm.status === 'undetermined') perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null; // 거부(기존·방금) = 좌표 생략(재요청 금지)
    // 타임아웃 3s(발주) — GPS 침묵에도 저장은 무위치로 진행
    const pos = await Promise.race([
      track(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })), // #109 5R
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (!pos) return null;
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null; // 모듈 부재·GPS 오류 — 좌표만 조용히 생략
  }
}

export async function saveOrderHistory(input: { imagePath?: string | null; items: OrderItem[] }): Promise<void> {
  try {
    const items = input.items
      .filter((i) => i.qty > 0 && i.foodId != null) // foodId 필수(스키마) — 미매칭 제외
      .map((i) => ({
        foodId: Number(i.foodId),
        menuName: i.nameKo,
        quantity: i.qty,
        ...(typeof i.priceKrw === 'number' && i.priceKrw > 0 ? { price: i.priceKrw } : {}),
      }));
    if (items.length === 0) return; // 저장할 항목 없음(전부 미매칭) — 호출 생략
    const coord = await grantedCoord();
    await api.post('/api/orders', {
      ...(input.imagePath ? { imagePath: input.imagePath } : {}),
      items,
      ...(coord ?? {}),
    });
  } catch (e) {
    // 비치명 — 주문 완료 UX 무영향(이력만 유실).
    // P-256: code·status 동반 — 400 원인(조사 대기 foodId 거부 추정, 종한 확인 중) 관찰용.
    const err = e as { message?: string; status?: number; code?: string };
    console.log(`[order] 이력 저장 실패(비치명) ${err?.status ?? '?'} ${err?.code ?? 'NO-CODE'}:`, err?.message ?? e);
  }
}
