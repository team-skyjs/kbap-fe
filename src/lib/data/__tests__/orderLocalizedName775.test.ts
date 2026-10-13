/**
 * KB-775(서버 #400 KB-782) — 주문 항목 이름: DB에 있는 음식 = 사용자 언어(name), 없으면(준비중·미등록·미지원 언어) 주문한 한국어(menuName).
 * 상세 캐시 키에 앱 언어 — 언어를 바꾼 직후 이전 언어 이름이 남지 않게.
 */
import * as fs from 'fs';
import { adaptOrderDetail, orderDetailKey, orderItemName } from '../useOrders';

it('어댑터 = 서버 name 통과(앞뒤 공백 제거) · 빈 문자열·부재·null = null', () => {
  const d = adaptOrderDetail({ orderId: 1, orderedAt: 0, items: [
    { menuName: '순두부찌개', name: ' Soft Tofu Stew ' },
    { menuName: '제육볶음', name: '' },
    { menuName: '김치찌개', name: null },
    { menuName: '수제비' },
  ] });
  expect(d.items.map((i) => i.name)).toEqual(['Soft Tofu Stew', null, null, null]);
});

it('표시 이름 = name ?? menuName(공백만이면 menuName)', () => {
  expect(orderItemName({ name: 'Soft Tofu Stew', menuName: '순두부찌개' })).toBe('Soft Tofu Stew');
  expect(orderItemName({ name: null, menuName: '순두부찌개' })).toBe('순두부찌개');
  expect(orderItemName({ name: '  ', menuName: '순두부찌개' })).toBe('순두부찌개');
});

it('상세 캐시 키 = 언어 포함(언어가 다르면 다른 캐시) · 조회 훅·편집 응답 반영이 같은 키 함수를 쓴다', () => {
  expect(orderDetailKey('1', 'en')).not.toEqual(orderDetailKey('1', 'ko'));
  expect(orderDetailKey('1', 'en')).toEqual(['orders', '1', 'en']);
  expect(orderDetailKey('1', 'en').slice(0, 1)).toEqual(['orders']); // 목록 무효화(['orders'] 접두)에 걸린다
  const orders = fs.readFileSync('src/lib/data/useOrders.ts', 'utf8');
  const edit = fs.readFileSync('src/lib/data/useOrderEdit.ts', 'utf8');
  expect(orders).toMatch(/const lang = clampLang\(useAppLanguage\(\)\);[\s\S]*queryKey: orderDetailKey\(orderId, lang\)/);
  expect(edit).toContain('orderDetailKey(detail.orderId, apiLang())');
  expect(edit).not.toMatch(/setQueryData<OrderDetail>\(\['orders', detail\.orderId\]/);
});

it('스토리 카드 메뉴 줄도 같은 표시 이름(orderItemName) — 주문 상세 화면 소스', () => {
  const src = fs.readFileSync('src/app/profile/order/[id].tsx', 'utf8');
  expect(src).toContain('q.data.items.map(orderItemName)');
  expect(src).not.toMatch(/\{it\.menuName\}/);
});
