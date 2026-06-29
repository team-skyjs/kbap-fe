/**
 * mocks/foods.ts — mock catalog typed against the contract (handoff §5-2).
 * Persona: traveler with a shellfish allergy (allergy:shellfish) — drives the
 * personalized risk so all four states (safe/caution/danger/unable) appear.
 *
 * Typed as the contract schemas → any drift from openapi.yaml fails to compile.
 */
import type {
  FoodCard,
  FoodDetail,
  HomeResponse,
} from '../api/types';

const agg = (average: number | null, count: number) => ({ average, count });

export const MOCK_FOODS: FoodCard[] = [
  { foodId: 'kimchi-jjigae', name: 'Kimchi Stew', nameKo: '김치찌개', photoUrl: null, risk: 'caution', overall: agg(4.4, 312) },
  { foodId: 'bibimbap', name: 'Bibimbap', nameKo: '비빔밥', photoUrl: null, risk: 'safe', overall: agg(4.7, 540) },
  { foodId: 'japchae', name: 'Japchae', nameKo: '잡채', photoUrl: null, risk: 'safe', overall: agg(4.5, 221) },
  { foodId: 'tteokbokki', name: 'Tteokbokki', nameKo: '떡볶이', photoUrl: null, risk: 'safe', overall: agg(4.3, 488) },
  { foodId: 'samgyeopsal', name: 'Samgyeopsal', nameKo: '삼겹살', photoUrl: null, risk: 'safe', overall: agg(4.8, 731) },
  { foodId: 'jokbal', name: 'Jokbal', nameKo: '족발', photoUrl: null, risk: 'caution', overall: agg(4.2, 156) },
  { foodId: 'sundubu-jjigae', name: 'Soft Tofu Stew', nameKo: '순두부찌개', photoUrl: null, risk: 'danger', overall: agg(4.5, 274) },
  { foodId: 'mul-naengmyeon', name: 'Cold Buckwheat Noodles', nameKo: '물냉면', photoUrl: null, risk: 'safe', overall: agg(4.1, 98) },
];

const byId = Object.fromEntries(MOCK_FOODS.map((f) => [f.foodId, f]));

export const MOCK_HOME: HomeResponse = {
  recent: [byId['kimchi-jjigae'], byId['sundubu-jjigae']],
  recommended: [
    byId['bibimbap'],
    byId['japchae'],
    byId['samgyeopsal'],
    byId['tteokbokki'],
  ],
};

/** Empty-state home (new user, 0 scans) — handoff §6 home-empty-rec. */
export const MOCK_HOME_EMPTY: HomeResponse = { recent: [], recommended: [] };

export const MOCK_FOOD_DETAILS: Record<string, FoodDetail> = {
  'kimchi-jjigae': {
    foodId: 'kimchi-jjigae',
    name: 'Kimchi Stew',
    nameKo: '김치찌개',
    risk: 'caution',
    riskBasis: [
      {
        ingredientCode: 'shrimp-paste',
        restrictionCode: 'allergy:shellfish',
        percentage: null,
        reason: 'Saeujeot (salted shrimp) is often added but varies by restaurant.',
      },
    ],
    overall: agg(4.4, 312),
    sameNationality: agg(4.2, 41),
    description:
      'A bubbling stew of aged kimchi, pork, and tofu. Comforting, sour, and spicy — a Korean staple.',
    photoUrl: null,
    // danger → caution → safe ordering (FR-014)
    ingredients: [
      { code: 'shrimp-paste', name: 'Salted shrimp (saeujeot)', percentage: null, risk: 'caution', note: 'store-dependent' },
      { code: 'kimchi', name: 'Kimchi', percentage: 35, risk: 'safe', note: null },
      { code: 'pork', name: 'Pork', percentage: 25, risk: 'safe', note: null },
      { code: 'tofu', name: 'Tofu', percentage: 15, risk: 'safe', note: null },
      { code: 'gochugaru', name: 'Chili powder', percentage: 8, risk: 'safe', note: null },
    ],
    isRegistered: true,
  },
  'sundubu-jjigae': {
    foodId: 'sundubu-jjigae',
    name: 'Soft Tofu Stew',
    nameKo: '순두부찌개',
    risk: 'danger',
    riskBasis: [
      {
        ingredientCode: 'clam',
        restrictionCode: 'allergy:shellfish',
        percentage: 12,
        reason: 'Typically simmered with clams and other shellfish.',
      },
    ],
    overall: agg(4.5, 274),
    sameNationality: agg(4.4, 33),
    description:
      'Silken tofu stew in a spicy seafood broth, served sizzling with a raw egg cracked on top.',
    photoUrl: null,
    ingredients: [
      { code: 'clam', name: 'Clams', percentage: 12, risk: 'danger', note: null },
      { code: 'shrimp', name: 'Shrimp', percentage: 6, risk: 'danger', note: null },
      { code: 'soft-tofu', name: 'Soft tofu', percentage: 45, risk: 'safe', note: null },
      { code: 'egg', name: 'Egg', percentage: 10, risk: 'safe', note: null },
    ],
    isRegistered: true,
  },
};

/** Unregistered food → unable verdict (FR-033). */
export const MOCK_FOOD_UNREGISTERED: FoodDetail = {
  foodId: 'unknown-dish',
  name: 'Unregistered dish',
  nameKo: '미등록 메뉴',
  risk: 'unable',
  riskBasis: [],
  overall: agg(null, 0),
  sameNationality: agg(null, 0),
  description: '',
  photoUrl: null,
  ingredients: [],
  isRegistered: false,
};
