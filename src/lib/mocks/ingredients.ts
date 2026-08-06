/**
 * ingredients.ts — 기피 성분 카탈로그, **BE 표준 코드(UPPER_SNAKE) 81종으로
 * 키잉** (KB-75 버그 수정 2026-07-13: 내부 ing:slug가 와이어로 새어 400).
 * avoidance_substance.code 정본과 1:1 — 코드가 곧 와이어 값이라 변환이 없다.
 *
 * i18nKey: 표시 전용 — ingredients.<slug> 번역 키(10개 언어). KB-125에서
 * 신규 29종 번역 채움 (2026-07-14) — 전 항목이 키를 가진다.
 */

import i18n from '@/lib/i18n';

export interface Ingredient {
  code: string; // BE 표준 코드 (UPPER_SNAKE) — 와이어 값 그 자체
  name: string; // English fallback name
  i18nKey?: string; // 구 slug 번역 재사용용
}

const ing = (code: string, name: string, i18nKey?: string): Ingredient => ({ code, name, i18nKey });

/** BE avoidance_substance.code 정본 81종 (guest/온보딩/프로필 공용). */
export const INGREDIENTS: Ingredient[] = [
  // dairy & animal-derived
  ing('EGG', 'Egg', 'egg'), ing('MILK', 'Milk', 'milk'), ing('DAIRY', 'Dairy', 'dairy'),
  ing('GOAT_MILK', 'Goat milk', 'goatmilk'), ing('BUTTER', 'Butter', 'butter'), ing('GHEE', 'Ghee', 'ghee'),
  ing('CHEESE', 'Cheese', 'cheese'), ing('GELATIN', 'Gelatin', 'gelatin'), ing('RENNET', 'Rennet', 'rennet'),
  ing('HONEY', 'Honey', 'honey'), ing('CARMINE', 'Carmine', 'carmine'),
  // nuts & seeds
  ing('PEANUT', 'Peanut', 'peanut'), ing('WALNUT', 'Walnut', 'walnut'), ing('PINE_NUT', 'Pine nut', 'pinenut'),
  ing('ALMOND', 'Almond', 'almond'), ing('CASHEW', 'Cashew', 'cashew'), ing('PISTACHIO', 'Pistachio', 'pistachio'),
  ing('HAZELNUT', 'Hazelnut', 'hazelnut'), ing('MACADAMIA', 'Macadamia', 'macadamia'), ing('PECAN', 'Pecan', 'pecan'),
  ing('BRAZIL_NUT', 'Brazil nut', 'brazilnut'), ing('CHESTNUT', 'Chestnut', 'chestnut'),
  ing('SESAME', 'Sesame', 'sesame'), ing('SUNFLOWER_SEED', 'Sunflower seed', 'sunflowerseed'),
  ing('MUSTARD', 'Mustard', 'mustard'),
  // grains & legumes
  ing('WHEAT', 'Wheat', 'wheat'), ing('BUCKWHEAT', 'Buckwheat', 'buckwheat'), ing('BARLEY', 'Barley', 'barley'),
  ing('RYE', 'Rye', 'rye'), ing('OAT', 'Oat', 'oat'), ing('CORN', 'Corn', 'corn'),
  ing('SOY', 'Soy', 'soybean'), ing('LUPIN', 'Lupin', 'lupin'), ing('PEA', 'Pea', 'pea'),
  ing('CHICKPEA', 'Chickpea', 'chickpea'), ing('LENTIL', 'Lentil', 'lentil'),
  // seafood
  ing('SHRIMP', 'Shrimp', 'shrimp'), ing('SALTED_SHRIMP', 'Salted shrimp (saeujeot)', 'shrimppaste'),
  ing('CRAB', 'Crab', 'crab'), ing('CRAYFISH', 'Crayfish', 'crayfish'), ing('LOBSTER', 'Lobster', 'lobster'),
  ing('SQUID', 'Squid', 'squid'), ing('OCTOPUS', 'Octopus', 'octopus'), ing('OYSTER', 'Oyster', 'oyster'),
  ing('OYSTER_SAUCE', 'Oyster sauce', 'oystersauce'), ing('ABALONE', 'Abalone', 'abalone'), ing('MUSSEL', 'Mussel', 'mussel'),
  ing('CLAM', 'Clam', 'clam'), ing('SHORT_NECK_CLAM', 'Short-neck clam', 'shortneckclam'), ing('SCALLOP', 'Scallop', 'scallop'),
  ing('SEAFOOD', 'Seafood (all)', 'shellfish'),
  ing('FISH', 'Fish', 'fish'), ing('MACKEREL', 'Mackerel', 'mackerel'), ing('SALMON', 'Salmon', 'salmon'),
  ing('TUNA', 'Tuna', 'tuna'), ing('COD', 'Cod', 'cod'), ing('ANCHOVY', 'Anchovy', 'anchovy'),
  ing('FISH_SAUCE', 'Fish sauce', 'fishsauce'), ing('BROTH', 'Broth (meat/fish stock)', 'broth'), ing('DASHI', 'Dashi', 'dashi'),
  // meat
  ing('BEEF', 'Beef', 'beef'), ing('PORK', 'Pork', 'pork'), ing('LARD', 'Lard', 'lard'), ing('TALLOW', 'Tallow', 'tallow'),
  ing('CHICKEN', 'Chicken', 'chicken'), ing('POULTRY', 'Poultry (all)', 'poultry'),
  // produce & aromatics
  ing('PEACH', 'Peach', 'peach'), ing('TOMATO', 'Tomato', 'tomato'), ing('CELERY', 'Celery', 'celery'),
  ing('POTATO', 'Potato', 'potato'), ing('CARROT', 'Carrot', 'carrot'), ing('ONION', 'Onion', 'onion'),
  ing('GARLIC', 'Garlic', 'garlic'), ing('SCALLION', 'Scallion', 'greenonion'), ing('CHIVE', 'Chive', 'chive'),
  ing('WILD_CHIVE', 'Wild chive', 'wildchive'), ing('ASAFOETIDA', 'Asafoetida', 'asafoetida'),
  // etc.
  ing('ALCOHOL', 'Alcohol', 'alcohol'), ing('MIRIN', 'Mirin', 'mirin'), ing('COOKING_WINE', 'Cooking wine', 'ricewine'),
  ing('SULFITES', 'Sulfites', 'sulfites'),
];

const BY_CODE: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((i) => [i.code, i]));

/** BE 정본 코드 집합 — 와이어로 나가도 되는 유일한 값들. */
export const BE_CODES: ReadonlySet<string> = new Set(INGREDIENTS.map((i) => i.code));

/**
 * 레거시 내부 id(ing:slug — 구 draft/mock 잔재) → BE 코드.
 * 안전 원칙: 애매하면 더 넓은 카테고리로(과회피는 안전, 누락은 위험).
 * 대응 불가(null)는 와이어에서 드롭 + 로그 — 출시 전이라 실사용 영향 없음.
 */
const LEGACY_TO_BE: Record<string, string | null> = {
  egg: 'EGG', milk: 'MILK', cheese: 'CHEESE', butter: 'BUTTER', yogurt: 'DAIRY',
  gelatin: 'GELATIN', honey: 'HONEY', peanut: 'PEANUT', walnut: 'WALNUT', almond: 'ALMOND',
  cashew: 'CASHEW', pistachio: 'PISTACHIO', pinenut: 'PINE_NUT', sesame: 'SESAME',
  mustard: 'MUSTARD', sunflowerseed: 'SUNFLOWER_SEED', wheat: 'WHEAT', buckwheat: 'BUCKWHEAT',
  barley: 'BARLEY', rye: 'RYE', oat: 'OAT', corn: 'CORN', rice: null,
  soybean: 'SOY', tofu: 'SOY', soysauce: 'SOY', doenjang: 'SOY', gochujang: null, redbean: null,
  shrimp: 'SHRIMP', crab: 'CRAB', lobster: 'LOBSTER', squid: 'SQUID', octopus: 'OCTOPUS',
  cuttlefish: 'SQUID', clam: 'CLAM', oyster: 'OYSTER', mussel: 'MUSSEL', abalone: 'ABALONE',
  seasnail: 'SEAFOOD', scallop: 'SCALLOP', shellfish: 'SEAFOOD',
  fish: 'FISH', mackerel: 'MACKEREL', anchovy: 'ANCHOVY', tuna: 'TUNA', pollock: 'FISH',
  cod: 'COD', salmon: 'SALMON', eel: 'FISH', fishsauce: 'FISH_SAUCE', fishcake: 'FISH',
  shrimppaste: 'SALTED_SHRIMP',
  beef: 'BEEF', pork: 'PORK', chicken: 'CHICKEN', duck: 'POULTRY', lamb: null,
  ham: 'PORK', sausage: 'PORK', bloodsausage: 'PORK',
  garlic: 'GARLIC', onion: 'ONION', greenonion: 'SCALLION', ginger: null, chili: null,
  perilla: null, cilantro: null, tomato: 'TOMATO', peach: 'PEACH', kiwi: null, apple: null,
  mango: null, mushroom: null, eggplant: null, spinach: null,
  alcohol: 'ALCOHOL', ricewine: 'COOKING_WINE', vinegar: null, msg: null, sulfites: 'SULFITES',
};

/**
 * 와이어 경계 변환: 어떤 내부/레거시 코드든 BE 코드 또는 null.
 * null = 서버가 모르는 코드 → 호출측이 드롭+로그 (400 방지).
 */
export function toBeCode(code: string): string | null {
  if (BE_CODES.has(code)) return code; // 이미 정본
  const slug = code.startsWith('ing:') ? code.slice(4) : code;
  return LEGACY_TO_BE[slug] ?? null;
}

/**
 * Reader-language display name. 구 slug 번역(ingredients.<slug>)이 있으면
 * 재사용, 없으면 카탈로그 영어명. 레거시 ing:slug 코드도 라벨링된다.
 */
export function ingredientLabel(code: string): string {
  const entry = BY_CODE[code];
  if (entry) {
    return entry.i18nKey
      ? i18n.t(`ingredients.${entry.i18nKey}`, { defaultValue: entry.name })
      : entry.name;
  }
  // 레거시 ing:slug (구 draft/mock)
  const slug = code.startsWith('ing:') ? code.slice(4) : code;
  return i18n.t(`ingredients.${slug}`, {
    defaultValue: slug.charAt(0).toUpperCase() + slug.slice(1),
  });
}

/** P-134(온보딩 v3): 카테고리 섹션 — 파일 내 주석 그룹의 데이터 승격(회피 타일 그리드용). 라벨 = i18n ingCat.<key>. */
export const INGREDIENT_SECTIONS: { key: string; codes: string[] }[] = [
  { key: 'dairy', codes: ['EGG', 'MILK', 'DAIRY', 'GOAT_MILK', 'BUTTER', 'GHEE', 'CHEESE', 'GELATIN', 'RENNET', 'HONEY', 'CARMINE'] },
  { key: 'nuts', codes: ['PEANUT', 'WALNUT', 'PINE_NUT', 'ALMOND', 'CASHEW', 'PISTACHIO', 'HAZELNUT', 'MACADAMIA', 'PECAN', 'BRAZIL_NUT', 'CHESTNUT', 'SESAME', 'SUNFLOWER_SEED', 'MUSTARD'] },
  { key: 'grains', codes: ['WHEAT', 'BUCKWHEAT', 'BARLEY', 'RYE', 'OAT', 'CORN', 'SOY', 'LUPIN', 'PEA', 'CHICKPEA', 'LENTIL'] },
  { key: 'seafood', codes: ['SHRIMP', 'SALTED_SHRIMP', 'CRAB', 'CRAYFISH', 'LOBSTER', 'SQUID', 'OCTOPUS', 'OYSTER', 'OYSTER_SAUCE', 'ABALONE', 'MUSSEL', 'CLAM', 'SHORT_NECK_CLAM', 'SCALLOP', 'SEAFOOD', 'FISH', 'MACKEREL', 'SALMON', 'TUNA', 'COD', 'ANCHOVY', 'FISH_SAUCE', 'BROTH', 'DASHI'] },
  { key: 'meat', codes: ['BEEF', 'PORK', 'LARD', 'TALLOW', 'CHICKEN', 'POULTRY'] },
  { key: 'produce', codes: ['PEACH', 'TOMATO', 'CELERY', 'POTATO', 'CARROT', 'ONION', 'GARLIC', 'SCALLION', 'CHIVE', 'WILD_CHIVE', 'ASAFOETIDA'] },
  { key: 'etc', codes: ['ALCOHOL', 'MIRIN', 'COOKING_WINE', 'SULFITES'] },
];
