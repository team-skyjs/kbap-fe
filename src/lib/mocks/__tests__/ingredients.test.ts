/**
 * 기피 성분 코드 정합 (KB-75 버그 회귀 방지).
 * 내부 카탈로그 = BE avoidance_substance.code 정본 87종(81 + KB-843 서버 #446 6종) 그 자체여야 하고,
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
  // KB-843(서버 #446, 2026-10-21): 묶음 4 + 말단 2
  'NUTS','CRUSTACEAN','MOLLUSK','MEAT','LAMB','MEAT_BROTH',
]);

describe('성분 코드 정합 (KB-75)', () => {
  it('카탈로그 = BE 정본 87종과 1:1 (누락/초과/중복 없음)', () => {
    expect(CANONICAL.size).toBe(87);
    expect(INGREDIENTS).toHaveLength(87);
    const codes = INGREDIENTS.map((i) => i.code);
    expect(new Set(codes).size).toBe(87); // 중복 없음
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

  it('KB-843: 새 6종 = 카탈로그 맨 뒤(식단 프리셋 1-기반 위치 무변) · 섹션 안 = 묶음은 하위 바로 뒤(DAIRY·SEAFOOD·POULTRY와 같은 자리 규칙) · 섹션에 전부 한 번', () => {
    const { INGREDIENT_SECTIONS } = jest.requireActual('../ingredients') as typeof import('../ingredients');
    expect(INGREDIENTS.slice(81).map((i) => i.code)).toEqual(['NUTS', 'CRUSTACEAN', 'MOLLUSK', 'MEAT', 'LAMB', 'MEAT_BROTH']);
    expect(INGREDIENTS[80].code).toBe('SULFITES'); // 앞 81종 위치 그대로
    const sec = (k: string) => INGREDIENT_SECTIONS.find((x) => x.key === k)!.codes;
    const after = (k: string, code: string) => sec(k)[sec(k).indexOf(code) - 1];
    expect(after('nuts', 'NUTS')).toBe('CHESTNUT'); // 견과 하위 뒤(씨앗 앞)
    expect(after('seafood', 'CRUSTACEAN')).toBe('LOBSTER'); // 새우~랍스터 뒤
    expect(after('seafood', 'MOLLUSK')).toBe('SCALLOP'); // 오징어~가리비 뒤
    expect(after('seafood', 'SEAFOOD')).toBe('MOLLUSK');
    expect(sec('meat')).toEqual(['BEEF', 'PORK', 'LARD', 'TALLOW', 'CHICKEN', 'POULTRY', 'LAMB', 'MEAT_BROTH', 'MEAT']); // 묶음 육류 = 맨 뒤
    const all = INGREDIENT_SECTIONS.flatMap((x) => x.codes);
    expect(all).toHaveLength(87);
    expect(new Set(all)).toEqual(new Set(INGREDIENTS.map((i) => i.code)));
  });

  it("KB-843: 레거시 'ing:lamb' → LAMB(전엔 대응 없음 → 드롭) · 새 6종 라벨 = 10개 언어 키(영어 이름 폴백 아님)", () => {
    expect(toBeCode('ing:lamb')).toBe('LAMB');
    const fs = jest.requireActual('fs') as typeof import('fs');
    for (const lang of ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es']) {
      const ing = (JSON.parse(fs.readFileSync(`src/lib/i18n/${lang}.json`, 'utf8')) as { ingredients: Record<string, string> }).ingredients;
      for (const k of ['nuts', 'crustacean', 'mollusk', 'meat', 'lamb', 'meatbroth']) {
        expect(typeof ing[k]).toBe('string');
        expect(ing[k]).not.toContain('·');
      }
    }
  });

  it('모든 항목이 라벨을 가진다 (영어 fallback 포함)', () => {
    for (const i of INGREDIENTS) expect(ingredientLabel(i.code).length).toBeGreaterThan(0);
  });
});
