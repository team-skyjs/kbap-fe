/**
 * KB-789 — 스캔 v3.0 `substituted`·`originalScannedName` 매핑 + 2.0(필드 부재) 폴백 +
 * 주문 카드 nameKo(메뉴판 원문 우선) + 계측 화이트리스트.
 */
import { mergeResults, photoOnlyResults, type ScannedItem } from '../scanAdapter';
import type { ScanResultWire } from '../scanTypes';
import { orderNameKo } from '@/lib/scan/segmentMenu';
import { EVENTS, sanitize } from '@/lib/analytics';

const box = { x: 0.1, y: 0.3, width: 0.4, height: 0.05 };
const items: ScannedItem[] = [
  { itemId: 0, rawMenuName: '김치찌게', box },
  { itemId: 1, rawMenuName: '된장찌개', box },
];

const SUB: ScanResultWire = { idx: 0, matched: true, foodId: 8, riskLevel: 'CAUTION', name: 'Kimchi Stew', koreanName: '김치찌개', substituted: true, originalScannedName: '김치찌게' };
const PLAIN_V2: ScanResultWire = { idx: 1, matched: true, foodId: 7, riskLevel: 'SAFE', name: 'Doenjang Jjigae', koreanName: '된장찌개' }; // 2.0 응답 — 두 필드 부재

describe('KB-789 어댑터 — substituted·originalScannedName', () => {
  it('3.0: substituted=true + 원문 전달, foodId·이름·위험도는 대체 음식 기준 그대로', () => {
    const [m] = mergeResults(items, [SUB]);
    expect(m.substituted).toBe(true);
    expect(m.originalScannedName).toBe('김치찌게');
    expect(m.foodId).toBe('8');
    expect(m.displayName).toBe('Kimchi Stew');
    expect(m.koreanName).toBe('김치찌개');
    expect(m.risk).toBe('caution');
  });

  it('2.0 폴백: 필드 부재 → substituted=false · originalScannedName=null', () => {
    const [m] = mergeResults(items, [PLAIN_V2]);
    expect(m.substituted).toBe(false);
    expect(m.originalScannedName).toBeNull();
  });

  it('방어: substituted 비-boolean·원문 공백/null → false·null (엄격 true만)', () => {
    const [a] = mergeResults(items, [{ ...SUB, substituted: 'true' as unknown as boolean, originalScannedName: '  ' }]);
    expect(a.substituted).toBe(false);
    expect(a.originalScannedName).toBeNull();
    const [b] = mergeResults(items, [{ ...SUB, originalScannedName: null }]);
    expect(b.substituted).toBe(true);
    expect(b.originalScannedName).toBeNull();
  });

  it('photoOnly(idx=null) 경로도 동일 규칙', () => {
    const out = photoOnlyResults([{ ...SUB, idx: null }, { ...PLAIN_V2, idx: null }]);
    expect(out.map((o) => [o.substituted, o.originalScannedName])).toEqual([[true, '김치찌게'], [false, null]]);
  });
});

describe('KB-789 주문 카드 nameKo', () => {
  it('대체 항목 = 메뉴판 원문 우선(직원에게 보여주는 줄) · 비대체 = koreanName ?? rawMenuName', () => {
    expect(orderNameKo({ substituted: true, originalScannedName: '김치찌게', koreanName: '김치찌개', rawMenuName: 'Kimchi Stew' })).toBe('김치찌게');
    expect(orderNameKo({ substituted: false, originalScannedName: null, koreanName: '된장찌개', rawMenuName: 'x' })).toBe('된장찌개');
    expect(orderNameKo({ koreanName: null, rawMenuName: '수제비' })).toBe('수제비');
    // 원문 결측이면 대체 음식 한글명으로 폴백(빈 줄 금지)
    expect(orderNameKo({ substituted: true, originalScannedName: null, koreanName: '김치찌개', rawMenuName: 'x' })).toBe('김치찌개');
  });
});

it('KB-789 계측: scan_closest_match_open = food_id만 통과(메뉴 원문 등 다른 키 드롭)', () => {
  expect(EVENTS.scan_closest_match_open).toBe('scan_closest_match_open');
  expect(sanitize(EVENTS.scan_closest_match_open, { food_id: '8', scanned: '김치찌게' })).toEqual({ food_id: '8' });
});
