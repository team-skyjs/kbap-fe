/**
 * 기피 성분 코드 정합 (KB-75 버그 회귀 방지).
 * 내부 카탈로그 = BE avoidance_substance.code 정본 81종 그 자체여야 하고,
 * 와이어 경계(toBeCode)는 어떤 선택 가능 코드도 정본 밖 값을 내보내면 안 된다.
 */
import { BE_CODES, INGREDIENTS, toBeCode, ingredientLabel } from '../ingredients';

// BE 정본 (2026-07-13 전달분 — avoidance_substance.code 전체)
const CANONICAL = new Set([
  'EGG','MILK','DAIRY','GOAT_MILK','BUTTER','GHEE','CHEESE','GELATIN','RENNET','HONEY','CARMINE',
  'PEANUT','WALNUT','PINE_NUT','ALMOND','CASHEW','PISTACHIO','HAZELNUT','MACADAMIA','PECAN','BRAZIL_NUT','CHESTNUT',
  'SESAME','SUNFLOWER_SEED','MUSTARD','WHEAT','BUCKWHEAT','BARLEY','RYE','OAT','CORN','SOY','LUPIN','PEA','CHICKPEA','LENTIL',
  'SHRIMP','SALTED_SHRIMP','CRAB','CRAYFISH','LOBSTER','SQUID','OCTOPUS','OYSTER','OYSTER_SAUCE','ABALONE','MUSSEL','CLAM',
  'SHORT_NECK_CLAM','SCALLOP','SEAFOOD','FISH','MACKEREL','SALMON','TUNA','COD','ANCHOVY','FISH_SAUCE','BROTH','DASHI',
  'BEEF','PORK','LARD','TALLOW','CHICKEN','POULTRY','PEACH','TOMATO','CELERY','POTATO','CARROT','ONION','GARLIC','SCALLION',
  'CHIVE','WILD_CHIVE','ASAFOETIDA','ALCOHOL','MIRIN','COOKING_WINE','SULFITES',
]);

describe('성분 코드 정합 (KB-75)', () => {
  it('카탈로그 = BE 정본 81종과 1:1 (누락/초과/중복 없음)', () => {
    expect(CANONICAL.size).toBe(81);
    expect(INGREDIENTS).toHaveLength(81);
    const codes = INGREDIENTS.map((i) => i.code);
    expect(new Set(codes).size).toBe(81); // 중복 없음
    for (const c of codes) expect(CANONICAL.has(c)).toBe(true); // 초과 없음
    for (const c of CANONICAL) expect(codes).toContain(c); // 누락 없음
  });

  it('선택 가능한 모든 카탈로그 코드는 toBeCode에서 자기 자신으로 통과', () => {
    for (const i of INGREDIENTS) expect(toBeCode(i.code)).toBe(i.code);
  });

  it("레거시 'ing:cheese' → 'CHEESE' (실기기 400 케이스)", () => {
    expect(toBeCode('ing:cheese')).toBe('CHEESE');
  });

  it('toBeCode 출력은 항상 정본 안이거나 null — 정본 밖 값이 와이어로 새지 않는다', () => {
    const probes = ['ing:cheese', 'ing:shellfish', 'ing:duck', 'ing:msg', 'ing:unknown-thing', 'CHEESE', 'garbage'];
    for (const p of probes) {
      const out = toBeCode(p);
      expect(out === null || CANONICAL.has(out)).toBe(true);
    }
  });

  it('레거시 매핑은 넓은 카테고리로 (과회피=안전): shellfish→SEAFOOD, duck→POULTRY, ham→PORK', () => {
    expect(toBeCode('ing:shellfish')).toBe('SEAFOOD');
    expect(toBeCode('ing:duck')).toBe('POULTRY');
    expect(toBeCode('ing:ham')).toBe('PORK');
  });

  it('모든 항목이 라벨을 가진다 (영어 fallback 포함)', () => {
    for (const i of INGREDIENTS) expect(ingredientLabel(i.code).length).toBeGreaterThan(0);
  });
});
