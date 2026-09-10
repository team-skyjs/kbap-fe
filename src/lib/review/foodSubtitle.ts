/** P-352(KB-514): 리뷰 작성 음식 카드 부제 — count 0 = 리뷰 수 숨김(한글명 없으면
 *  null = 줄 생략), n≥1 = "한글명 | n reviews"(" | " 구분, 예진 결정 — 구 P-196
 *  공백 구분 대체). */
export function foodSubtitle(
  food: { name?: string; nameKo?: string | null; overall?: { count?: number } } | undefined,
  t: (k: string, o?: Record<string, unknown>) => string,
): string | null {
  const ko = food?.nameKo && food.nameKo !== food.name ? food.nameKo : null;
  const count = food?.overall?.count ?? 0;
  const parts = [ko, count >= 1 ? t('reviews.subtitle', { count }) : null].filter(Boolean);
  return parts.length === 0 ? null : parts.join(' | ');
}
