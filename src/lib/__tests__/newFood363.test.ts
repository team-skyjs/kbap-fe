/**
 * P-385(KB-363) — NEW 배지 = publishedAt 기준 24시간 이내만. 규칙은 lib/newFood 한 곳.
 */
import { isNewFood } from '../newFood';

const NOW = Date.parse('2026-09-15T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

it('23시간 59분 전 = NEW', () => {
  expect(isNewFood(ago(23 * HOUR + 59 * MIN), NOW)).toBe(true);
});

it('정확히 24시간 00분 전 = NEW 아님(경계 배타)', () => {
  expect(isNewFood(ago(24 * HOUR), NOW)).toBe(false);
});

it('방금 공개(0ms) = NEW', () => {
  expect(isNewFood(ago(0), NOW)).toBe(true);
});

it('null·undefined·빈 문자열 = NEW 아님', () => {
  expect(isNewFood(null, NOW)).toBe(false);
  expect(isNewFood(undefined, NOW)).toBe(false);
  expect(isNewFood('', NOW)).toBe(false);
});

it('파싱 불가 문자열 = NEW 아님', () => {
  expect(isNewFood('not-a-date', NOW)).toBe(false);
});

it('미래 시각(시계 어긋남) = NEW 아님', () => {
  expect(isNewFood(ago(-5 * MIN), NOW)).toBe(false);
});
