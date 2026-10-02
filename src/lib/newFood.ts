import { useEffect, useState } from 'react';

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

/** 화면이 열려 있는 동안 24시간 경계를 넘으면 배지를 내린다(렌더 시각 고정 판정의 만료 누락 방지). */
export function useIsNewFood(publishedAt: string | null | undefined): boolean {
  // KB-695: "지금"을 state로 든다. `isNewFood(publishedAt)`(기본 인자 Date.now)를 렌더에서 그냥 부르면 React Compiler가
  // [publishedAt]로 메모이즈해 만료 타이머의 재렌더가 재계산하지 못했다(열어 둔 화면에서 24h 지나도 NEW 유지).
  // now가 의존에 보이면 타이머가 now를 바꿀 때 다시 계산된다. publishedAt이 바뀌면(재조회로 다른 음식) 그 시점으로 now 갱신 —
  // 렌더 중 전환 비교(KB-603, 값 키 아님). 마운트 시각에 고정된 now로 그 뒤 공개된 음식을 "미래"(→ NEW 아님)로 보는 것 방지.
  const [now, setNow] = useState(() => Date.now());
  const [prevPublishedAt, setPrevPublishedAt] = useState(publishedAt);
  if (publishedAt !== prevPublishedAt) {
    setPrevPublishedAt(publishedAt);
    setNow(() => Date.now()); // 업데이터 — 렌더 본문에서 비순수 함수 직접 호출 금지(react-hooks/purity)
  }
  const isNew = isNewFood(publishedAt, now);
  useEffect(() => {
    if (!isNew) return;
    const boundary = Date.parse(publishedAt!) + NEW_FOOD_WINDOW_MS;
    // 타이머는 벽시계와 다른 축이라 경계보다 조금 일찍 발화할 수 있다 → now를 경계 이상으로(일찍 깨도 내려감 — 재등록 없이 고착 방지, #226 공부)
    const id = setTimeout(() => setNow(Math.max(Date.now(), boundary)), Math.max(0, boundary - Date.now()));
    return () => clearTimeout(id);
  }, [isNew, publishedAt]);
  return isNew;
}
