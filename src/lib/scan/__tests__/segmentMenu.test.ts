import { segmentMenu, parsePriceKrw, formatKrw, type OcrLine } from '../segmentMenu';
import type { BoundingBox } from '@/lib/api/scanTypes';

const b = (x: number, y: number, w = 0.2, h = 0.04): BoundingBox => ({ x, y, width: w, height: h });

describe('segmentMenu (handoff §14-2.3 radial nearest-neighbor)', () => {
  const lines: OcrLine[] = [
    // grid layout (식사류): name → latin → price stacked in one column
    { text: '식사류', box: b(0.1, 0.24, 0.12) },
    { text: '비빔밥', box: b(0.1, 0.30, 0.12) },
    { text: 'Bibimbap', box: b(0.1, 0.36, 0.16) },
    { text: 'W12,000', box: b(0.1, 0.42, 0.14) },
    // an unrelated far price (should NOT attach to 비빔밥)
    { text: 'W99,000', box: b(0.8, 0.05, 0.14) },
    // list layout (면류): short name | price on the same row, close together
    { text: '라면', box: b(0.1, 0.70, 0.10) },
    { text: 'w8,000', box: b(0.28, 0.70, 0.14) },
    { text: '냉면', box: b(0.1, 0.78, 0.10) },
    { text: 'w9,000', box: b(0.28, 0.78, 0.14) },
    // structural non-dish lines: excluded from dishes
    { text: '원산지: 소고기(국산)', box: b(0.1, 0.90, 0.5) },
    { text: '.jpg', box: b(0.9, 0.02, 0.08) },
  ];

  const seg = segmentMenu(lines);
  const byName = Object.fromEntries(seg.dishes.map((d) => [d.rawMenuName, d]));

  it('keeps only dish names as dishes (structural filter)', () => {
    expect(seg.dishes.map((d) => d.rawMenuName).sort()).toEqual(['냉면', '라면', '비빔밥']);
  });

  it('assigns sequential itemIds', () => {
    expect(seg.dishes.map((d) => d.itemId)).toEqual([0, 1, 2]);
  });

  it('grid: attaches the price stacked below + the romanized name', () => {
    expect(byName['비빔밥'].priceKrw).toBe(12000);
    expect(byName['비빔밥'].latin).toBe('Bibimbap');
  });

  it('list: attaches the price on the same row (nearest), not a neighbor row', () => {
    expect(byName['라면'].priceKrw).toBe(8000);
    expect(byName['냉면'].priceKrw).toBe(9000);
  });

  it('surfaces origin lines for display (not sent to BE)', () => {
    expect(seg.origins).toEqual(['원산지: 소고기(국산)']);
  });

  // 멘토링 ④: 가격 없는 메뉴에 먼 가격이 붙지 않는다 (반경 밖 = null = 미표시)
  it('does not attach a far-away price (distance cap)', () => {
    const far = segmentMenu([
      { text: '비빔밥', box: b(0.1, 0.3, 0.12) },
      { text: 'W99,000', box: b(0.8, 0.9, 0.14) },
    ]);
    expect(far.dishes[0].priceKrw).toBeNull();
  });
});

describe('parsePriceKrw / formatKrw (멘토링 ④)', () => {
  it('parses all supported price shapes to KRW integers', () => {
    expect(parsePriceKrw('12,000')).toBe(12000);
    expect(parsePriceKrw('12000')).toBe(12000);
    expect(parsePriceKrw('12,000원')).toBe(12000);
    expect(parsePriceKrw('₩12,000')).toBe(12000);
    expect(parsePriceKrw('W8,000')).toBe(8000);
  });

  it('returns null when no digits', () => {
    expect(parsePriceKrw('원')).toBeNull();
  });

  it('formats with ₩ and thousands separators', () => {
    expect(formatKrw(12000)).toBe('₩12,000');
    expect(formatKrw(900)).toBe('₩900');
    expect(formatKrw(1500000)).toBe('₩1,500,000');
  });
});
