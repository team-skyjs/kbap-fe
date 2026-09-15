/**
 * isNewFood (P-385/KB-363) — 음식 NEW 배지 규칙은 이 한 곳에만 둔다.
 *
 * 9/15 예진 결정: **서버 공개 시각(`publishedAt`) 기준 24시간 이내만** NEW.
 * (9/5 "항상 표시" 결정은 폐기 — 판별 데이터가 없던 시절의 임시안이었다.)
 *
 * - `publishedAt` 부재·null(미공개 이력)·파싱 실패 → false
 * - 미래 시각(서버·기기 시계 어긋남) → false. 모르면 NEW라고 주장하지 않는다
 * - 기기 시계에 의존한다 — 서버 `Date` 헤더 보정은 범위 밖(발주 명시)
 */
export const NEW_FOOD_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isNewFood(publishedAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!publishedAt) return false;
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return false;
  const age = now - published;
  return age >= 0 && age < NEW_FOOD_WINDOW_MS;
}
