/**
 * mocks/owner.ts — owner-confirmation phrases (place language = ko, Constitution I).
 * Keyed by `${foodId}:${ingredientCode}` with a safe default. menuNameKo must
 * match the scanned menu name (FR-019/SC-006).
 */
import type { OwnerConfirmation } from '../api/types';

const PHRASES: Record<string, OwnerConfirmation> = {
  'kimchi-jjigae:shrimp-paste': {
    questionKo: '김치찌개에 새우젓이 들어가나요?',
    explanationKo: '저는 새우 알레르기가 있어서 먹으면 위험할 수 있어요.',
    menuNameKo: '김치찌개',
    placeLanguage: 'ko',
  },
  'sundubu-jjigae:clam': {
    questionKo: '순두부찌개에 조개나 해산물이 들어가나요?',
    explanationKo: '저는 갑각류·조개 알레르기가 있어서 먹으면 위험합니다.',
    menuNameKo: '순두부찌개',
    placeLanguage: 'ko',
  },
};

const DEFAULT: OwnerConfirmation = {
  questionKo: '이 음식에 제가 못 먹는 재료가 들어가나요?',
  explanationKo: '저는 음식 알레르기가 있어서 확인이 필요해요.',
  menuNameKo: '이 음식',
  placeLanguage: 'ko',
};

export function mockOwnerConfirmation(foodId: string, ingredientCode?: string): OwnerConfirmation {
  if (ingredientCode && PHRASES[`${foodId}:${ingredientCode}`]) {
    return PHRASES[`${foodId}:${ingredientCode}`];
  }
  // fall back to any phrase for the food, else the generic default
  const anyForFood = Object.entries(PHRASES).find(([k]) => k.startsWith(`${foodId}:`));
  return anyForFood ? anyForFood[1] : DEFAULT;
}
