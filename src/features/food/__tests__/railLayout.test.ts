/** P-319(KB-485) — 레일 카드 폭: 화면 폭 기준 2장 + 3번째 peek(발주 예시값 잠금). */
import { railCardW, RAIL_MIN_CARD_W } from '../railLayout';

it('railCardW — 발주 예시값 3종(393/375/430) 잠금', () => {
  expect(railCardW(393)).toBe(152);
  expect(railCardW(375)).toBe(143);
  expect(railCardW(430)).toBe(171);
});

it('railCardW — 최소 폭 140 보장(초소형 폭은 peek이 줄어드는 셈)', () => {
  expect(railCardW(320)).toBeGreaterThanOrEqual(RAIL_MIN_CARD_W);
  expect(railCardW(200)).toBe(RAIL_MIN_CARD_W);
});
