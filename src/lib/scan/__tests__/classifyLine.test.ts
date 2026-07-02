import { classifyLine } from '../classifyLine';
import type { BoundingBox } from '@/lib/api/scanTypes';

// helper: a box at the vertical middle (not a screen edge) unless y overridden
const box = (y = 0.4): BoundingBox => ({ x: 0.1, y, width: 0.3, height: 0.04 });

describe('classifyLine (handoff §14-2)', () => {
  it('prices', () => {
    expect(classifyLine('W12,000', box())).toBe('price');
    expect(classifyLine('w8,000', box())).toBe('price');
    expect(classifyLine('₩5000', box())).toBe('price');
  });

  it('origin', () => {
    expect(classifyLine('원산지: 소고기(국산), 김치(국산)', box())).toBe('origin');
    expect(classifyLine('돼지고기 수입산', box())).toBe('origin');
  });

  it('section headers', () => {
    expect(classifyLine('식사류', box())).toBe('section');
    expect(classifyLine('면류', box())).toBe('section');
    expect(classifyLine('음료', box())).toBe('section');
  });

  it('dish names (short Korean)', () => {
    for (const n of ['비빔밥', '떡볶이', '김치볶음밥', '갈비구이', '김치전', '해물파전', '라면', '냉면', '멸치국수', '오렌지주스']) {
      expect(classifyLine(n, box())).toBe('dishName');
    }
  });

  it('latin display-name candidate (center)', () => {
    expect(classifyLine('Bibimbap', box())).toBe('latin');
  });

  it('junk: symbols / file ext / function keys', () => {
    expect(classifyLine('Q &', box())).toBe('junk');
    expect(classifyLine('.jpg', box())).toBe('junk');
    expect(classifyLine('F4', box())).toBe('junk');
    expect(classifyLine('F8', box())).toBe('junk');
  });

  it('junk: latin UI text at screen edge (e.g. MacBook Air)', () => {
    expect(classifyLine('MacBook Air', box(0.04))).toBe('junk'); // top edge
    expect(classifyLine('MacBook Air', box(0.95))).toBe('junk'); // bottom edge
  });

  it('description: long / sentence-like Korean (never used for matching)', () => {
    expect(classifyLine('고소한 참기름과 신선한 제철 나물을 듬뿍 얹은 한 그릇', box())).toBe('description');
    expect(classifyLine('되지고기, 김치, 두부가 어우러진 얼큰한', box())).toBe('description');
  });
});
