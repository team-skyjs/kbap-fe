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
import { useMe } from '@/lib/data/useMe';
import { avoidLabelsKo, ownerQuestionKo } from '@/lib/order/orderCard';

const EXPLANATION_KO = '저는 음식 알레르기가 있어서 확인이 필요해요.';
/** P-163: 회피 나열 케이스 — 회피≠알레르기(종교·비건 포함)라 단정 금지. K-큐 검수 대상. */
const EXPLANATION_AVOID_KO = '저는 이 재료들을 먹지 못해요. 확인 부탁드려요.';

export function useOwnerConfirmation(foodId: string, ingredientCode?: string) {
  const { data: food } = useFoodDetail(foodId);
  const { data: me } = useMe();
  const nameKo = food?.nameKo;
  // P-163: 특정 재료 질문(ingredient 파라미터)은 무변. 폴백은 프로필 회피 실나열 —
  // 나열이 성립할 때(해석 가능한 라벨 ≥1)만 서브라인도 무단정 문구로 교체.
  const avoidCodes = (me?.restrictions ?? []).map((r) => r.code);
  const listing = !ingredientCode && avoidLabelsKo(avoidCodes).length > 0;
  const data: OwnerConfirmation | undefined = nameKo
    ? {
        questionKo: ownerQuestionKo(nameKo, ingredientCode, listing ? avoidCodes : undefined),
        explanationKo: listing ? EXPLANATION_AVOID_KO : EXPLANATION_KO,
        menuNameKo: nameKo,
        placeLanguage: 'ko',
      }
    : undefined;
  return { data };
}
