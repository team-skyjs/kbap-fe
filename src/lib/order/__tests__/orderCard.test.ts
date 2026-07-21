/**
 * P-030(KB-205): 주문+고지 원카드 문장 조립 잠금.
 * 핵심 불변식: 카드 본문은 UI 언어와 무관하게 **한국어 고정**(헌법 place=ko),
 * 기피 0개면 고지 생략(순수 주문 카드), 을/를 받침 분기, "외 n개" 접기.
 */
import i18n from '@/lib/i18n';
import {
  avoidSentenceKo,
  eulReul,
  ingredientLabelKo,
  lifestyleLinesKo,
  MAX_AVOID_SHOWN,
  orderSentenceKo,
} from '../orderCard';

describe('eulReul — 받침 조사 분기', () => {
  it('받침 있음→을, 없음→를, 비한글→병기 폴백', () => {
    expect(eulReul('달걀')).toBe('을');
    expect(eulReul('새우')).toBe('를');
    expect(eulReul('Egg')).toBe('을(를)');
  });
});

describe('ko 고정 잠금 — UI 언어가 en이어도 카드 라벨은 한국어', () => {
  it('ingredientLabelKo: EGG→달걀, SHRIMP→새우 (현재 i18n 언어 무관)', async () => {
    await i18n.changeLanguage('en');
    expect(ingredientLabelKo('EGG')).toBe('달걀');
    expect(ingredientLabelKo('SHRIMP')).toBe('새우');
  });
});

describe('orderSentenceKo — ① 주문 문장', () => {
  it('{koreanName} {n}개 주세요.', () => {
    expect(orderSentenceKo('김치찌개', 1)).toBe('김치찌개 1개 주세요.');
    expect(orderSentenceKo('비빔밥', 3)).toBe('비빔밥 3개 주세요.');
  });
});

describe('avoidSentenceKo — ② 기피 고지', () => {
  it('기피 0개 → null (순수 주문 카드 — ②③ 생략)', () => {
    expect(avoidSentenceKo([])).toBe(null);
  });

  it('재료 아닌 코드만 있으면(종교·식이) ②는 역시 null — ③이 담당', () => {
    expect(avoidSentenceKo(['religion:halal', 'diet:vegan'])).toBe(null);
  });

  it('받침 분기: 달걀→을 / 새우→를', () => {
    expect(avoidSentenceKo(['EGG'])).toBe('저는 달걀을 못 먹어요. 들어가면 알려주세요.');
    expect(avoidSentenceKo(['SHRIMP'])).toBe('저는 새우를 못 먹어요. 들어가면 알려주세요.');
  });

  it(`${MAX_AVOID_SHOWN}개 초과 → "외 n개" 접기 (조사는 '개'에 붙어 '를')`, () => {
    const eight = ['EGG', 'MILK', 'SHRIMP', 'CRAB', 'PEANUT', 'WALNUT', 'BEEF', 'PORK'];
    const s = avoidSentenceKo(eight)!;
    expect(s).toContain('외 2개를 못 먹어요');
    expect(s.split(',').length).toBe(MAX_AVOID_SHOWN); // 표시 라벨 수 상한
  });
});

describe('lifestyleLinesKo — ③ 종교·식이 한 줄', () => {
  it('보유 코드만 한 줄로, 재료 코드는 무시', () => {
    expect(lifestyleLinesKo(['religion:halal', 'EGG', 'diet:vegetarian'])).toEqual([
      '무슬림 식단입니다.',
      '베지테리언입니다.',
    ]);
    expect(lifestyleLinesKo(['EGG'])).toEqual([]);
  });
});
