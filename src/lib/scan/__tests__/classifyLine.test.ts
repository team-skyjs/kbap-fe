import { classifyLine } from '../classifyLine';
import type { BoundingBox } from '@/lib/api/scanTypes';

// helper: a box at the vertical middle (not a screen edge) unless y overridden
const box = (y = 0.4): BoundingBox => ({ x: 0.1, y, width: 0.3, height: 0.04 });

describe('classifyLine (handoff §14-2)', () => {
  it('prices', () => {
    expect(classifyLine('W12,000', box())).toBe('price');
    expect(classifyLine('w8,000', box())).toBe('price');
    expect(classifyLine('₩5000', box())).toBe('price');
    // 멘토링 ④: 통화 접두 없는 표기
    expect(classifyLine('12,000', box())).toBe('price');
    expect(classifyLine('12000', box())).toBe('price');
    expect(classifyLine('12,000원', box())).toBe('price');
    expect(classifyLine('9,000원', box())).toBe('price');
  });

  it('origin', () => {
    expect(classifyLine('원산지: 소고기(국산), 김치(국산)', box())).toBe('origin');
    expect(classifyLine('돼지고기 수입산', box())).toBe('origin');
  });

  it('section headers (류/료 suffix or known category)', () => {
    expect(classifyLine('식사류', box())).toBe('section');
    expect(classifyLine('면류', box())).toBe('section');
    expect(classifyLine('음료', box())).toBe('section');
    expect(classifyLine('탄산음료', box())).toBe('section'); // real fixture: 료-suffix category
  });

  it('dish names (short Korean)', () => {
    for (const n of ['비빔밥', '떡볶이', '김치볶음밥', '갈비구이', '김치전', '해물파전', '라면', '냉면', '멸치국수', '오렌지주스']) {
      expect(classifyLine(n, box())).toBe('dishName');
    }
  });

  it('latin display-name candidate (center)', () => {
    expect(classifyLine('Bibimbap', box())).toBe('latin');
  });

  it('junk: symbols / file ext / function keys / trailing-colon fragment', () => {
    expect(classifyLine('Q &', box())).toBe('junk');
    expect(classifyLine('.jpg', box())).toBe('junk');
    expect(classifyLine('vio0239mkl8.jpg', box())).toBe('junk');
    expect(classifyLine('F4', box())).toBe('junk');
    expect(classifyLine('F8', box())).toBe('junk');
    expect(classifyLine('소한:', box())).toBe('junk'); // real fixture: description fragment (고소한 cut)
  });

  it('junk: latin UI text at screen edge (e.g. MacBook Air)', () => {
    expect(classifyLine('MacBook Air', box(0.04))).toBe('junk'); // top edge
    expect(classifyLine('MacBook Air', box(0.95))).toBe('junk'); // bottom edge
  });

  it('description: long / sentence-like Korean (never used for matching)', () => {
    expect(classifyLine('고소한 참기름과 신선한 제철 나물을 듬뿍 얹은 한 그릇', box())).toBe('description');
    expect(classifyLine('되지고기, 김치, 두부가 어우러진 얼큰한', box())).toBe('description');
  });

  // ⚠️ 임시 패치 (KB-72): ML Kit merges "한글 요리명 + 로마자" into one line —
  // the description judgment now uses the Korean part only. Real-device log cases.
  describe('KB-72: merged hangul+romanized lines are dishes, not descriptions', () => {
    it('real-device log cases classify as dishName', () => {
      expect(classifyLine('김치찌가개 d', box())).toBe('dishName'); // OCR typo + stray latin
      expect(classifyLine('된장찌개 Doeniang fioe', box())).toBe('dishName');
      expect(classifyLine('■ 부대지개 Budae fige', box())).toBe('dishName'); // bullet + romanized
      expect(classifyLine('· 닭볶음탕 Dak Bokkeumtang 2인 이상', box())).toBe('dishName'); // quantity tag stripped
    });

    it('quantity tags alone do not push a dish into description', () => {
      expect(classifyLine('감자탕 3인분', box())).toBe('dishName');
    });

    it('no NEW non-menu false positives (existing known case stays as-is)', () => {
      // "1스프린트" was a dishName before the patch too — assert it did not get worse.
      expect(classifyLine('1스프린트', box())).toBe('dishName');
    });

    it('regression: real descriptions still classify as description', () => {
      // Korean part itself is long/sentence-like → unchanged
      expect(classifyLine('고소한 참기름과 신선한 제철 나물을 듬뿍 얹은 한 그릇', box())).toBe('description');
      expect(classifyLine('되지고기, 김치, 두부가 어우러진 얼큰한', box())).toBe('description');
    });

    it('regression: origin/price lines unaffected', () => {
      expect(classifyLine('원산지: 소고기(국산), 김치(국산)', box())).toBe('origin');
      expect(classifyLine('W12,000', box())).toBe('price');
    });

    it('latin-dominant line with a single stray Hangul char is NOT promoted to dish', () => {
      expect(classifyLine('Doenjang Jjigae special set menu 찌', box())).toBe('description');
    });

    it('mixed hangul+latin UI chrome at a screen edge stays junk (browser tab title)', () => {
      expect(classifyLine('메뉴판 - Googlea x', box(0.07))).toBe('junk'); // real fixture, top edge
      // ...but the same shape at the CENTER is a merged dish line → dish
      expect(classifyLine('된장찌개 Doeniang fioe', box(0.4))).toBe('dishName');
    });
  });
});
