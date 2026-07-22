/**
 * useOwnerConfirmation — place-language (ko) phrase to show restaurant staff
 * (FR-017/018/019).
 *
 * P-045(KB-215): mock PHRASES 사전(2개 음식만 실명, 나머지 '이 음식') 폐기 —
 * **실데이터 클라 조립**: 상세 캐시의 koreanName(nameKo) + 81종 코드→ko 라벨로
 * 질문 생성(ownerQuestionKo). BE 엔드포인트 불요 — 전부 기존 데이터.
 * explanationKo는 정적 유지(개인 사유는 노출 최소화).
 */
import type { OwnerConfirmation } from '@/lib/api/types';
import { useFoodDetail } from '@/lib/data/useFoods';
import { ownerQuestionKo } from '@/lib/order/orderCard';

const EXPLANATION_KO = '저는 음식 알레르기가 있어서 확인이 필요해요.';

export function useOwnerConfirmation(foodId: string, ingredientCode?: string) {
  const { data: food } = useFoodDetail(foodId);
  const nameKo = food?.nameKo;
  const data: OwnerConfirmation | undefined = nameKo
    ? {
        questionKo: ownerQuestionKo(nameKo, ingredientCode),
        explanationKo: EXPLANATION_KO,
        menuNameKo: nameKo,
        placeLanguage: 'ko',
      }
    : undefined;
  return { data };
}
