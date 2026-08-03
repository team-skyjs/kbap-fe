/**
 * P-030(KB-205): 주문+고지 원카드 문장 조립 잠금.
 * 핵심 불변식: 카드 본문은 UI 언어와 무관하게 **한국어 고정**(헌법 place=ko),
 * 기피 0개면 고지 생략(순수 주문 카드), 을/를 받침 분기, "외 n개" 접기.
 */
import i18n from '@/lib/i18n';
import {
  avoidSentenceKo,
  eulReul,
  iGa,
  ingredientLabelKo,
  MAX_AVOID_SHOWN,
  orderSentenceKo,
  ownerQuestionKo,
} from '../orderCard';

describe('eulReul — 받침 조사 분기', () => {
  it('받침 있음→을, 없음→를, 비한글→병기 폴백', () => {
    expect(eulReul('달걀')).toBe('을');
    expect(eulReul('새우')).toBe('를');
    expect(eulReul('Egg')).toBe('을(를)');
  });
});

describe('iGa — 주격 조사 분기 (P-045)', () => {
  it('받침 있음→이, 없음→가, 비한글→병기 폴백', () => {
    expect(iGa('달걀')).toBe('이');
    expect(iGa('새우')).toBe('가');
    expect(iGa('Egg')).toBe('이(가)');
  });
});

describe('ownerQuestionKo — 사장님 확인 질문 실데이터 조립 (P-045/KB-215)', () => {
  it("재료 있음: '{실명}에 {재료ko}이(가) 들어가나요?' — mock '이 음식' 잔재 금지", async () => {
    await i18n.changeLanguage('en'); // ko 고정 잠금 겸
    expect(ownerQuestionKo('김치찌개', 'SHRIMP')).toBe('김치찌개에 새우가 들어가나요?');
    expect(ownerQuestionKo('비빔밥', 'EGG')).toBe('비빔밥에 달걀이 들어가나요?');
  });

  it('재료 없음(unregistered 진입): 일반 질문 — 음식명은 항상 실명', () => {
    expect(ownerQuestionKo('된장찌개')).toBe('된장찌개에 제가 못 먹는 재료가 들어가나요?');
  });

  // P-052(반려): 상세의 합성 라우트 키(ing:{i}:{name})가 그대로 통과해
  // "ing:0:Egg이(가) 들어가나요"가 노출됐다 — 3분기 잠금.
  it("P-052 ①: 합성 키 'ing:0:Egg' → en 카탈로그명 역매핑 → '달걀이'", () => {
    expect(ownerQuestionKo('쫄면', 'ing:0:Egg')).toBe('쫄면에 달걀이 들어가나요?');
    expect(ownerQuestionKo('쫄면', 'ing:3:shrimp')).toBe('쫄면에 새우가 들어가나요?'); // 대소문자 정규화
    expect(ownerQuestionKo('쫄면', 'ing:2:달걀')).toBe('쫄면에 달걀이 들어가나요?'); // ko 라벨 역매핑
  });

  it('P-052 ②: 역매핑 실패(비한글 미지 name)·미지 형식 → 일반 질문 — 원문/식별자 노출 0', () => {
    expect(ownerQuestionKo('쫄면', 'ing:1:Mystery Sauce')).toBe('쫄면에 제가 못 먹는 재료가 들어가나요?');
    expect(ownerQuestionKo('쫄면', 'GARBAGE_CODE')).toBe('쫄면에 제가 못 먹는 재료가 들어가나요?');
    expect(ownerQuestionKo('쫄면', 'ing:1:계란 sauce')).toBe('쫄면에 제가 못 먹는 재료가 들어가나요?'); // 혼합 스크립트도 강등
  });

  it('P-052 ③: 직접 81종 코드는 기존 동작 유지', () => {
    expect(ownerQuestionKo('김치찌개', 'SHRIMP')).toBe('김치찌개에 새우가 들어가나요?');
  });

  // P-109(KB-281): BE ko 동의어(계란 vs FE 달걀)가 역인덱스에 없어 계란만 일반
  // 폴백되던 버그 — 순한글 실명칭은 그대로 채용(받침 조사 포함).
  it('P-109: 순한글 동의어는 실명칭 채용 — 계란(받침)·오이(무받침)', () => {
    expect(ownerQuestionKo('계란찜', 'ing:0:계란')).toBe('계란찜에 계란이 들어가나요?');
    expect(ownerQuestionKo('무침', 'ing:0:오이')).toBe('무침에 오이가 들어가나요?');
  });
});

// P-109 회귀 스팟: 81종 전 재료 — ko 라벨·en 카탈로그명 어느 쪽으로 와도 구체 질문
describe('P-109: 전 재료 라운드트립 (계란 특이 아님을 잠금)', () => {
  it('81종 전부 — ko 라벨 주입 시 일반 폴백 0', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { INGREDIENTS } = require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients');
    for (const ing of INGREDIENTS) {
      const ko = ingredientLabelKo(ing.code);
      expect(ownerQuestionKo('테스트', `ing:0:${ko}`)).not.toContain('못 먹는 재료');
      expect(ownerQuestionKo('테스트', `ing:0:${ing.name}`)).not.toContain('못 먹는 재료'); // en 카탈로그명
    }
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

  it('81종 카탈로그 밖 코드는 무시 — 미지 코드만이면 null (P-033: 평면 81종 정본)', () => {
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

