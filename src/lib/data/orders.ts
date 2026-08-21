/**
 * orders (P-252/KB-337 선행) — 주문 이력 저장: POST /api/orders.
 * 조회 UI(My Foods)는 D-20 시안 대기(KB-360) — 지금은 저장만 배선해 데이터를 쌓는다.
 *
 * - 호출 지점 = 주문 완료 확정(P-192 리마인더 예약과 같은 지점 — FlippedOrderCard).
 * - **실패 무해**: 이력은 부가 기능 — 실패해도 주문 완료 UX 무영향(콘솔 로그만).
 * - 위치 = **기존 보유 권한만**(granted 아니면 좌표 생략 — 권한 요청 새로 띄우지
 *   않는다, 발주 명시. places.ts currentCoord와 달리 request 경로 자체가 없다).
 * - items: foodId 필수(스키마) — 미매칭(foodId null) 항목은 이력에서 제외.
 *   menuName = 한국어 스냅샷(주문 카드 문법)·price = 스캔 단가(미인식 = 생략).
 * - imagePath = 스캔 식별자(스캔 1회당 주문 1회) — 스캔 경로 없으면(상세 발 주문·
 *   업로드 실패 '') 필드 생략(스키마 optional).
 */
import { api } from '@/lib/api/client';
import type { OrderItem } from '@/features/order/FlippedOrderCard';

async function grantedCoord(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // P-192 관례: 지연 require — 구 런타임 번들 동승 시 크래시 0
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location') as typeof import('expo-location');
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null; // 비동의 = 좌표 생략(재요청 금지)
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
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
    // 비치명 — 주문 완료 UX 무영향(이력만 유실)
    console.log('[order] 이력 저장 실패(비치명):', (e as Error)?.message ?? e);
  }
}
