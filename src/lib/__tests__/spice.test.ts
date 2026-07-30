/**
 * P-080(KB-261): 맵기 5단계 구간 함수 잠금 — 경계값 전수(0/1/3/4/6/7/8/9/10)
 * + 앵커 왕복 + 경고 판정(단계 비교, 원값 비교 금지).
 */
import { SPICE_ANCHOR, spiceBand, spicierThanUser } from '../spice';

it('구간 경계값 — 0=None / 1–3=Mild / 4–6=Medium / 7–8=Hot / 9–10=Extreme', () => {
  expect(spiceBand(0)).toBe(0);
  expect(spiceBand(1)).toBe(1);
  expect(spiceBand(3)).toBe(1);
  expect(spiceBand(4)).toBe(2);
  expect(spiceBand(6)).toBe(2);
  expect(spiceBand(7)).toBe(3);
  expect(spiceBand(8)).toBe(3);
  expect(spiceBand(9)).toBe(4);
  expect(spiceBand(10)).toBe(4);
});

it('앵커 왕복 — 각 앵커 저장값은 자기 단계로 되돌아온다 (0/2/5/7/10)', () => {
  expect(SPICE_ANCHOR).toEqual([0, 2, 5, 7, 10]);
  SPICE_ANCHOR.forEach((raw, band) => expect(spiceBand(raw)).toBe(band));
});

it('경고 판정 — 같은 단계면 원값이 높아도 경고 없음, 단계가 높아야 경고', () => {
  expect(spicierThanUser(6, 4)).toBe(false); // 둘 다 Medium — 원값 비교였다면 true(모순)
  expect(spicierThanUser(7, 6)).toBe(true); // Hot > Medium
  expect(spicierThanUser(1, 0)).toBe(true); // Mild > None
  expect(spicierThanUser(0, 0)).toBe(false);
  expect(spicierThanUser(10, 9)).toBe(false); // 둘 다 Extreme
});
