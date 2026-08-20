/**
 * scanAdapter — KB-72 신계약(2026-07-10) join semantics.
 * Locks the core mapping rules: server-excluded idx dropped, matched branching
 * (never on foodId), name fallback, false-safe risk mapping.
 */
import { mapRisk, mergeResults, photoOnlyResults, type ScannedItem } from '../scanAdapter';
import type { ScanResultWire } from '../scanTypes';

const box = { x: 0.1, y: 0.3, width: 0.4, height: 0.05 };
const items: ScannedItem[] = [
  { itemId: 0, rawMenuName: '된장찌개', box },
  { itemId: 1, rawMenuName: '김치찌개', box },
  { itemId: 2, rawMenuName: '1스프린트', box }, // non-food the FE classifier missed
  { itemId: 3, rawMenuName: '신메뉴찌개', box },
];

const results: ScanResultWire[] = [
  { idx: 0, matched: true, foodId: 7, riskLevel: 'SAFE', name: '된장찌개', koreanName: '된장찌개', price: 8000 },
  { idx: 1, matched: true, foodId: 8, riskLevel: 'DANGER', name: 'Kimchi Stew', koreanName: '김치찌개', price: null }, // 가격 미표기
  // idx 2 ABSENT — server excluded it as non-food
  { idx: 3, matched: false, foodId: 99, riskLevel: 'UNKNOWN', name: null, koreanName: null }, // 조사 대기 (foodId 있어도!) · price 필드 자체 없음
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

  it('price: 제공값 그대로 전달, 미표기(null)/필드 없음 → null (P-002)', () => {
    expect(merged.find((m) => m.itemId === 0)!.price).toBe(8000);
    expect(merged.find((m) => m.itemId === 1)!.price).toBe(null);
    expect(merged.find((m) => m.itemId === 3)!.price).toBe(null);
  });

  it('price: 비숫자 wire 값은 방어적으로 null (표시 안 함 > 이상한 가격)', () => {
    const [m] = mergeResults(
      [items[0]],
      [{ idx: 0, matched: true, foodId: 7, riskLevel: 'SAFE', price: '9000' as unknown as number }],
    );
    expect(m.price).toBe(null);
  });

  it('idx=null 결과는 조인에서 제외 (photoOnlyResults 몫 — 크래시 없음)', () => {
    const out = mergeResults(
      [items[0]],
      [
        { idx: null, matched: true, foodId: 5, riskLevel: 'DANGER', name: '사진전용' },
        { idx: 0, matched: true, foodId: 7, riskLevel: 'SAFE' },
      ],
    );
    expect(out).toHaveLength(1);
    expect(out[0].itemId).toBe(0);
  });
});

describe('photoOnlyResults (P-002 안전 게이트 — idx=null 숨김 금지)', () => {
  it('idx=null 항목만 추출, 판정 규칙은 동일 (DANGER 유지·조사대기 unable)', () => {
    const out = photoOnlyResults([
      { idx: 0, matched: true, foodId: 7, riskLevel: 'SAFE' }, // 조인 대상 — 제외
      { idx: null, matched: true, foodId: 5, riskLevel: 'DANGER', name: '육회', koreanName: '육회', price: 15000 },
      { matched: false, foodId: null, riskLevel: 'UNKNOWN', koreanName: '정체불명' }, // idx 필드 자체 없음
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ displayName: '육회', risk: 'danger', matched: true, foodId: '5', price: 15000 });
    // 조사 대기: unable 강등 + name 없으면 koreanName 폴백
    expect(out[1]).toMatchObject({ displayName: '정체불명', risk: 'unable', matched: false, price: null });
  });

  it('matched=false + 적대적 riskLevel 이라도 safe 로 새지 않는다', () => {
    const [m] = photoOnlyResults([{ idx: null, matched: false, foodId: 1, riskLevel: 'SAFE', name: 'x' }]);
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


/* ---- P-241(KB-343): imageRef 썸네일 — 매칭/비매칭/부재 · similarFood 철거 ---- */
describe('P-241 imageRef', () => {
  it('imageRef(절대 URL) → imageUrl 그대로 — 비매칭 행도 값 유지(서버 디폴트 이미지)', () => {
    const out = photoOnlyResults([
      { idx: null, matched: false, foodId: null, riskLevel: 'UNKNOWN', name: '수제비', koreanName: null, price: null,
        imageRef: 'https://cdn.kbap.site/images/default-food.webp' } as never,
    ]);
    expect(out[0].risk).toBe('unable'); // 썸네일이 있어도 판정은 unable 유지(헌법 III)
    expect(out[0].imageUrl).toBe('https://cdn.kbap.site/images/default-food.webp');
  });

  it('부재(v1)·비-URL(bare 파일명) = null — refToUrl 규칙 동일(렌더 불가 값 차단)', () => {
    const v1 = photoOnlyResults([
      { idx: null, matched: true, foodId: 3, riskLevel: 'SAFE', name: 'A', koreanName: null, price: null } as never,
    ]);
    expect(v1[0].imageUrl).toBe(null);
    const bare = photoOnlyResults([
      { idx: null, matched: true, foodId: 3, riskLevel: 'SAFE', name: 'A', koreanName: null, price: null,
        imageRef: 'kimchi.png' } as never,
    ]);
    expect(bare[0].imageUrl).toBe(null);
  });

  it('P-241: similarFood 잔존 0 — 어댑터·타입·리스트·화면 전면 철거(서버 필드 소멸)', () => {
    const fs = require('fs');
    for (const f of ['src/lib/api/scanAdapter.ts', 'src/lib/api/scanTypes.ts', 'src/features/scan/ScanRichList.tsx', 'src/app/scan.tsx', 'src/lib/scan/segmentMenu.ts']) {
      const src = fs.readFileSync(f, 'utf8') as string;
      expect(src).not.toContain('SimilarFood');
      expect(src).not.toContain('onOpenSimilar');
    }
  });
});
