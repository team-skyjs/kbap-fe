/**
 * T072 step6 — segmentation verified on a representative OCR fixture modeled on
 * the real 58-line log described in handoff §14-1 (식사류 3-col grid + 면류/음료
 * 2-col list, romanized + noisy descriptions + prices + origin + UI junk).
 *
 * The full raw log isn't stored in the spec repo, so this fixture reproduces the
 * §14-1 confirmed facts: dish names are clean, descriptions are OCR-noisy, and
 * layout mixes grid + list. Asserts the §14 outcome: only the dish names survive
 * as matchable dishes; sections/prices/origin/descriptions/junk are separated.
 */
import { segmentMenu, type OcrLine } from '../segmentMenu';
import { classifyLine } from '../classifyLine';
import type { BoundingBox } from '@/lib/api/scanTypes';

const b = (x: number, y: number, w = 0.25, h = 0.035): BoundingBox => ({ x, y, width: w, height: h });

// Representative menu (positions approximate; edge junk kept in the top strip y<0.17).
const FIXTURE: OcrLine[] = [
  // top screen-edge UI noise (latin at edge) + structural junk
  { text: 'MacBook Air', box: b(0.35, 0.03, 0.3) },
  { text: 'Q &', box: b(0.9, 0.02, 0.06) },
  { text: 'F4', box: b(0.02, 0.02, 0.05) },
  { text: '.jpg', box: b(0.95, 0.03, 0.06) },

  // ── 식사류 (3-column grid: name → romanized → description → price) ──
  { text: '식사류', box: b(0.1, 0.2, 0.12) },
  { text: '비빔밥', box: b(0.1, 0.26, 0.12) },
  { text: 'Bibimbap', box: b(0.1, 0.30, 0.16) },
  { text: '고소한 참기름에 신선한 제철 나물을 듬뿍 얹은', box: b(0.1, 0.34, 0.28) },
  { text: 'W12,000', box: b(0.1, 0.38, 0.14) },
  { text: '떡볶이', box: b(0.4, 0.26, 0.12) },
  { text: 'Tteokbokki', box: b(0.4, 0.30, 0.16) },
  { text: 'W8,000', box: b(0.4, 0.38, 0.14) },
  { text: '김치볶음밥', box: b(0.7, 0.26, 0.16) },
  { text: 'Kimchi Fried Rice', box: b(0.7, 0.30, 0.2) },
  { text: 'W9,000', box: b(0.7, 0.38, 0.14) },
  { text: '갈비구이', box: b(0.1, 0.46, 0.14) },
  { text: '되지고기, 김치, 두부가 어우러진 얼큰한 국물', box: b(0.1, 0.50, 0.28) }, // OCR-noisy description
  { text: 'W18,000', box: b(0.1, 0.54, 0.14) },
  { text: '김치전', box: b(0.4, 0.46, 0.12) },
  { text: 'W10,000', box: b(0.4, 0.54, 0.14) },
  { text: '해물파전', box: b(0.7, 0.46, 0.14) },
  { text: 'W13,000', box: b(0.7, 0.54, 0.14) },

  // ── 면류 (2-column list: name | price same row) ──
  { text: '면류', box: b(0.1, 0.64, 0.1) },
  { text: '라면', box: b(0.1, 0.68, 0.1) },
  { text: 'w4,000', box: b(0.28, 0.68, 0.14) },
  { text: '냉면', box: b(0.1, 0.72, 0.1) },
  { text: 'w9,000', box: b(0.28, 0.72, 0.14) },
  { text: '멸치국수', box: b(0.1, 0.76, 0.14) },
  { text: 'w7,000', box: b(0.28, 0.76, 0.14) },

  // ── 음료 ──
  { text: '음료', box: b(0.1, 0.8, 0.1) },
  { text: '오렌지주스', box: b(0.1, 0.83, 0.16) }, // y still < edgeBottom(0.81)? 0.83 > 0.81 but it's Korean, edge rule only applies to latin

  // origin (display only) + a stray long description
  { text: '원산지: 소고기(국산), 돼지고기(국산), 김치(국산)', box: b(0.1, 0.88, 0.6) },
];

describe('T072 segmentation on §14-1 representative menu', () => {
  const seg = segmentMenu(FIXTURE);
  const names = seg.dishes.map((d) => d.rawMenuName);

  it('surfaces exactly the dish names as matchable dishes (grid + list + drink)', () => {
    expect(names).toEqual([
      '비빔밥',
      '떡볶이',
      '김치볶음밥',
      '갈비구이',
      '김치전',
      '해물파전',
      '라면',
      '냉면',
      '멸치국수',
      '오렌지주스',
    ]);
  });

  it('never leaks sections / prices / descriptions / junk as dishes', () => {
    for (const notDish of ['식사류', '면류', '음료', 'W12,000', 'Bibimbap', 'MacBook Air', 'F4', '.jpg', 'Q &']) {
      expect(names).not.toContain(notDish);
    }
  });

  it('keeps origin for display (not sent to BE)', () => {
    expect(seg.origins).toHaveLength(1);
    expect(seg.origins[0]).toContain('원산지');
  });

  it('classification breakdown is stable (snapshot)', () => {
    const counts = seg.classified.reduce<Record<string, number>>((acc, c) => {
      acc[c.type] = (acc[c.type] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toMatchSnapshot();
  });

  it('sanity: the clean dish names each classify as dishName', () => {
    for (const n of names) {
      expect(classifyLine(n, b(0.1, 0.4))).toBe('dishName');
    }
  });
});
