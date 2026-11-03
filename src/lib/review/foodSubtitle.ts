/** P-352(KB-514): 리뷰 작성 음식 카드 부제 — count 0 = 리뷰 수 숨김(한글명 없으면
 *  [] = 줄 생략), n≥1 = [한글명, n reviews]. KB-907(T-107): 세로 막대 구분자 노출 제거 — 조각을 돌려주고 화면이 간격으로 나눈다. */
export function foodSubtitle(
  food: { name?: string; nameKo?: string | null; overall?: { count?: number } } | undefined,
  t: (k: string, o?: Record<string, unknown>) => string,
): string[] {
  const ko = food?.nameKo && food.nameKo !== food.name ? food.nameKo : null;
  const count = food?.overall?.count ?? 0;
  const reviews = count >= 1 ? t('reviews.subtitle', { count }) : null;
  return [ko, reviews].filter((x): x is string => x != null);
}
