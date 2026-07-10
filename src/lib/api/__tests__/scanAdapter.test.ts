/**
 * scanAdapter — KB-72 신계약(2026-07-10) join semantics.
 * Locks the core mapping rules: server-excluded idx dropped, matched branching
 * (never on foodId), name fallback, false-safe risk mapping.
 */
import { mapRisk, mergeResults, type ScannedItem } from '../scanAdapter';
import type { ScanResultWire } from '../scanTypes';

const box = { x: 0.1, y: 0.3, width: 0.4, height: 0.05 };
const items: ScannedItem[] = [
  { itemId: 0, rawMenuName: '된장찌개', box },
  { itemId: 1, rawMenuName: '김치찌개', box },
  { itemId: 2, rawMenuName: '1스프린트', box }, // non-food the FE classifier missed
  { itemId: 3, rawMenuName: '신메뉴찌개', box },
];

const results: ScanResultWire[] = [
  { idx: 0, matched: true, foodId: 7, riskLevel: 'SAFE', name: '된장찌개', koreanName: '된장찌개' },
  { idx: 1, matched: true, foodId: 8, riskLevel: 'DANGER', name: 'Kimchi Stew', koreanName: '김치찌개' },
  // idx 2 ABSENT — server excluded it as non-food
  { idx: 3, matched: false, foodId: 99, riskLevel: 'UNKNOWN', name: null, koreanName: null }, // 조사 대기 (foodId 있어도!)
];

describe('mergeResults (KB-72 신계약)', () => {
  const merged = mergeResults(items, results);

  it('drops idx the server excluded (non-food) — no marker, no row', () => {
    expect(merged).toHaveLength(3);
    expect(merged.find((m) => m.rawMenuName === '1스프린트')).toBeUndefined();
  });

  it('matched=true → personalized risk + navigable foodId', () => {
    const kimchi = merged.find((m) => m.itemId === 1)!;
    expect(kimchi.matched).toBe(true);
    expect(kimchi.risk).toBe('danger');
    expect(kimchi.foodId).toBe('8');
  });

  it('matched=false → risk forced unable even with a foodId present', () => {
    const pending = merged.find((m) => m.itemId === 3)!;
    expect(pending.matched).toBe(false);
    expect(pending.risk).toBe('unable');
    expect(pending.foodId).toBe('99'); // present — but navigation gates on `matched`, not foodId
  });

  it('displayName = BE name, rawMenuName fallback when name is null', () => {
    expect(merged.find((m) => m.itemId === 1)!.displayName).toBe('Kimchi Stew');
    expect(merged.find((m) => m.itemId === 3)!.displayName).toBe('신메뉴찌개');
  });

  it('matched=false with hostile riskLevel never yields safe (false-safe guard)', () => {
    const [m] = mergeResults(
      [items[0]],
      [{ idx: 0, matched: false, foodId: null, riskLevel: 'SAFE', name: null, koreanName: null }],
    );
    expect(m.risk).toBe('unable');
  });
});

describe('mapRisk', () => {
  it('maps enums and falls back to unable — never safe', () => {
    expect(mapRisk('SAFE')).toBe('safe');
    expect(mapRisk('CAUTION')).toBe('caution');
    expect(mapRisk('DANGER')).toBe('danger');
    expect(mapRisk('UNKNOWN')).toBe('unable');
    expect(mapRisk('???')).toBe('unable');
    expect(mapRisk(null)).toBe('unable');
    expect(mapRisk(undefined)).toBe('unable');
  });
});
