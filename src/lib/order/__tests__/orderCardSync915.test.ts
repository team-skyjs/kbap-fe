/**
 * KB-915 — 사장님 주문 카드 한국어 면·미러(리더 언어)가 같은 모델에서 나온다: 항목 수·순서·회피 재료 집합 동일.
 * 재현(구): 회피 목록에 81종 미등재 코드(레거시 ing:slug·카탈로그 신규)가 섞이면 한국어 면은 거르고 미러는 전부 나열 → 영어 면에만 재료가 더 보였다.
 */
import { avoidNoticeKo, buildOrderCard, ingredientLabelKo, orderClosingKo, orderItemLineKo, orderSentenceKo } from '@/lib/order/orderCard';

const three = [
  { nameKo: '제육볶음', name: 'Spicy Stir-fried Pork', qty: 1 },
  { nameKo: '새우튀김', name: 'Fried Shrimp', qty: 2 },
  { nameKo: '떡볶이', name: 'Spicy Rice Cakes', qty: 1 },
];

describe('KB-915 buildOrderCard — 한 모델, 두 면', () => {
  it('메뉴 3 + 회피 2: 항목 수·순서 동일, 회피 집합 = 같은 코드(한국어 라벨 ↔ 리더 이름 짝)', () => {
    const m = buildOrderCard(three, ['SHRIMP', 'EGG'], ['Shrimp', 'Egg']);
    expect(m.lines.map((l) => l.ko)).toEqual(three.map((i) => orderItemLineKo(i.nameKo, i.qty)));
    expect(m.lines.map((l) => [l.qty, l.name])).toEqual(three.map((i) => [i.qty, i.name]));
    expect(m.closing).toBe(orderClosingKo(4));
    expect(m.avoid!.codes).toEqual(['SHRIMP', 'EGG']);
    expect(m.avoid!.names).toEqual(['Shrimp', 'Egg']);
    expect(m.avoid!.list).toBe(['SHRIMP', 'EGG'].map(ingredientLabelKo).join(', '));
    expect(m.avoid!.sentence).toBe(avoidNoticeKo(['SHRIMP', 'EGG'])!.sentence);
  });

  it('재현: 미등재 코드는 두 면 모두에서 빠진다(구: 미러에만 남음) — 순서는 원래 순서', () => {
    const m = buildOrderCard(three, ['ing:legacy', 'SHRIMP', 'NEW_SERVER_CODE', 'EGG'], ['Legacy', 'Shrimp', 'New thing', 'Egg']);
    expect(m.avoid!.codes).toEqual(['SHRIMP', 'EGG']);
    expect(m.avoid!.names).toEqual(['Shrimp', 'Egg']);
    expect(m.avoid!.list.split(', ')).toHaveLength(m.avoid!.names.length);
  });

  it('해석 가능한 회피 0개 = 두 면 모두 회피 섹션 없음', () => {
    expect(buildOrderCard(three, ['ing:legacy'], ['Legacy']).avoid).toBeNull();
    expect(buildOrderCard(three, [], []).avoid).toBeNull();
  });

  it('단일 품목 = 한 문장(맺음 없음) · 표시명 부재 = 한국어 표기로(미러 빈 줄 0)', () => {
    const m = buildOrderCard([{ nameKo: '수제비', name: '', qty: 1 }], [], []);
    expect(m.lines).toEqual([{ ko: orderSentenceKo('수제비', 1), qty: 1, name: '수제비' }]);
    expect(m.closing).toBeNull();
  });
});
