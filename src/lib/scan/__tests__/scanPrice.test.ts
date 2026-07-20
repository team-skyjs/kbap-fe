/**
 * P-012(KB-179): 스캔→상세 가격 param 규칙을 잠근다.
 * - 첨부: 양의 정수만 '?price=n', null/0/비정수 미첨부 (스캔 이동 지점은
 *   openDish 한 곳 — scanPriceParam 사용)
 * - 파싱: 표시 전용·신뢰 경계 낮음 — 정수 파싱 실패·음수·조작값은 null(미표시)
 */
import { parseScanPrice, scanPriceParam } from '../segmentMenu';

describe('scanPriceParam (첨부 잠금)', () => {
  it('양의 정수 → ?price=n', () => {
    expect(scanPriceParam(9000)).toBe('?price=9000');
  });
  it('null/0/음수/비정수 → 미첨부', () => {
    expect(scanPriceParam(null)).toBe('');
    expect(scanPriceParam(undefined)).toBe('');
    expect(scanPriceParam(0)).toBe('');
    expect(scanPriceParam(-100)).toBe('');
    expect(scanPriceParam(9000.5)).toBe('');
  });
});

describe('parseScanPrice (상세 표시 게이트)', () => {
  it('유효 정수 문자열 → 표시', () => {
    expect(parseScanPrice('9000')).toBe(9000);
  });
  it('무·비정수·음수·조작값 → null(미표시)', () => {
    expect(parseScanPrice(undefined)).toBe(null);
    expect(parseScanPrice('')).toBe(null);
    expect(parseScanPrice('abc')).toBe(null);
    expect(parseScanPrice('-100')).toBe(null); // 음수 표기(비숫자 문자 포함)
    expect(parseScanPrice('9000.5')).toBe(null);
    expect(parseScanPrice('0')).toBe(null);
    expect(parseScanPrice('1e3')).toBe(null);
    expect(parseScanPrice('99999999999999999999')).toBe(null); // 안전 정수 초과
  });
  it('배열(중복 param)은 첫 값만', () => {
    expect(parseScanPrice(['9000', '1'])).toBe(9000);
  });
});
