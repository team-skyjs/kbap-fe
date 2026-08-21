/**
 * P-252(KB-337 선행): 주문 이력 저장 — POST /api/orders payload 실측·위치 권한
 * 분기(비동의 = 생략·재요청 금지)·실패 무해·완료 지점 배선.
 */
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { post: (...a: unknown[]) => mockPost(...a) } }));
const mockGetPerm = jest.fn();
const mockGetPos = jest.fn();
const mockRequestPerm = jest.fn();
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => mockGetPerm(),
  requestForegroundPermissionsAsync: () => mockRequestPerm(),
  getCurrentPositionAsync: () => mockGetPos(),
  Accuracy: { Balanced: 3 },
}));

import { saveOrderHistory } from '../orders';
import type { OrderItem } from '@/features/order/FlippedOrderCard';

const ITEMS: OrderItem[] = [
  { nameKo: '순두부찌개', name: 'Soft Tofu Stew', qty: 2, priceKrw: 9000, foodId: '7' },
  { nameKo: '수제비', name: 'Sujebi', qty: 1, priceKrw: null, foodId: null }, // 미매칭
  { nameKo: '김치찌개', name: 'Kimchi Stew', qty: 0, priceKrw: 8000, foodId: '3' }, // 미담김
];

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue(undefined);
  mockGetPerm.mockResolvedValue({ status: 'granted' });
  mockGetPos.mockResolvedValue({ coords: { latitude: 37.5636, longitude: 126.9834 } });
});

it('payload 실측 — imagePath·items(foodId 필수: 미매칭·미담김 제외·price 스냅샷)·좌표', async () => {
  await saveOrderHistory({ imagePath: 'scan/42/menu.jpg', items: ITEMS });
  expect(mockPost).toHaveBeenCalledWith('/api/orders', {
    imagePath: 'scan/42/menu.jpg',
    items: [{ foodId: 7, menuName: '순두부찌개', quantity: 2, price: 9000 }],
    latitude: 37.5636,
    longitude: 126.9834,
  });
});

it('가격 미인식(null/0) = price 생략 · 이미지 경로 없음("", 상세 발) = imagePath 생략', async () => {
  await saveOrderHistory({ imagePath: '', items: [{ nameKo: '비빔밥', name: 'Bibimbap', qty: 1, priceKrw: null, foodId: '9' }] });
  const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
  expect(body).not.toHaveProperty('imagePath');
  expect(body.items).toEqual([{ foodId: 9, menuName: '비빔밥', quantity: 1 }]);
});

it('위치 비동의 = 좌표 생략 + 권한 재요청 0(기존 보유 권한만 — 발주 명시)', async () => {
  mockGetPerm.mockResolvedValue({ status: 'denied' });
  await saveOrderHistory({ imagePath: 'p', items: ITEMS });
  const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
  expect(body).not.toHaveProperty('latitude');
  expect(body).not.toHaveProperty('longitude');
  expect(mockRequestPerm).not.toHaveBeenCalled(); // 요청 팝업 금지
  expect(mockGetPos).not.toHaveBeenCalled();
});

it('저장할 항목 0(전부 미매칭) = 호출 자체 생략', async () => {
  await saveOrderHistory({ imagePath: 'p', items: [{ nameKo: '수제비', name: 'S', qty: 1, priceKrw: null, foodId: null }] });
  expect(mockPost).not.toHaveBeenCalled();
});

it('실패 무해 — POST reject·위치 오류 모두 throw 없이 종료(주문 완료 UX 무영향)', async () => {
  mockPost.mockRejectedValue(new Error('500'));
  await expect(saveOrderHistory({ imagePath: 'p', items: ITEMS })).resolves.toBeUndefined();
  mockPost.mockResolvedValue(undefined);
  mockGetPos.mockRejectedValue(new Error('gps'));
  await expect(saveOrderHistory({ imagePath: 'p', items: ITEMS })).resolves.toBeUndefined();
  const body = mockPost.mock.calls.at(-1)![1] as Record<string, unknown>;
  expect(body).not.toHaveProperty('latitude'); // GPS 오류 = 좌표만 조용히 생략
});

it('P-256: 실패 로그 = status·code 동반(400 진단 — 조사 대기 foodId 거부 관찰)', async () => {
  const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const err = Object.assign(new Error('잘못된 요청입니다'), { status: 400, code: 'ORDER-001' });
  mockPost.mockRejectedValue(err);
  await saveOrderHistory({ imagePath: 'p', items: ITEMS });
  expect(spy).toHaveBeenCalledWith('[order] 이력 저장 실패(비치명) 400 ORDER-001:', '잘못된 요청입니다');
  spy.mockRestore();
});

it('배선 소스 잠금 — 완료 지점(P-192 리마인더와 동일) 저장 + 스캔 경로 관통', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  const card = fs.readFileSync('src/features/order/FlippedOrderCard.tsx', 'utf8') as string;
  // P-256: 호출 시점 = done 탭(모달 전) — go home 미탭 이탈에도 저장·계측·리마인더 발화
  const beforeModal = card.split('order-done-confirm')[0];
  const afterModal = card.split('order-done-confirm')[1] ?? '';
  expect(beforeModal).toContain('saveOrderHistory({ imagePath: orderImagePath, items })');
  expect(beforeModal).toContain('scheduleReviewReminder'); // 동일 시점 동반 이동(재량 ②)
  expect(beforeModal).toContain('EVENTS.order_done');
  expect(beforeModal).toContain('if (committedRef.current) return;'); // 1회 가드(재탭 이중 발화 0)
  // 모달 go home = 복귀만 — 저장/계측/리마인더 잔존 0
  expect(afterModal).not.toContain('saveOrderHistory');
  expect(afterModal).not.toContain('scheduleReviewReminder');
  expect(afterModal).not.toContain('EVENTS.order_done');
  expect(fs.readFileSync('src/app/scan-order.tsx', 'utf8')).toContain('orderImagePath={imgParam || null}');
  expect(fs.readFileSync('src/app/scan.tsx', 'utf8')).toContain('&img=');
});
