/**
 * hiddenFoods (KB-626) — 음식별 "서버가 지금 거부했다(FOOD-001)" 신호. 동기 메모리 저장소 +
 * `useSyncExternalStore` 구독(useSession과 같은 문법).
 *
 * 왜 따로 두나: FOOD-001(음식이 READY가 아님 — 숨김·삭제)은 **네 호출 중 어디서든** 먼저 올 수 있다
 * (상세 · 리뷰 목록 · 북마크 추가 · 리뷰 작성 — 서버 `getReadyFood`). 상세 화면이 **자기 쿼리 에러만**
 * 보면, 리뷰나 북마크가 먼저 거부를 받아도 캐시된 상세(SAFE 판정일 수 있음)가 **상세 재조회가 끝날
 * 때까지** 보이고, 그 재조회가 네트워크로 실패하면 영영 남는다 — false-safe(헌법 III, Codex #185).
 * 재조회는 게이트가 아니다. 거부를 받은 **그 자리**에서 표시하고, 화면은 이 신호 **하나**로 가린다.
 *
 * - 쓰는 곳: FOOD-001을 받는 원천 — `useFoodDetail`·`fetchFoodReviewsPage` queryFn, 북마크 `onError`
 * - 푸는 곳: 같은 원천의 **성공** 응답(음식이 다시 READY) — 재조회 실패로는 풀리지 않는다
 * - 읽는 곳: `useIsFoodHidden(foodId)`
 */
import { useSyncExternalStore } from 'react';

const hidden = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** FOOD-001을 받은 자리에서 호출 — 이 음식의 캐시된 판정을 즉시 가린다. */
export function markFoodHidden(foodId: string) {
  if (!foodId || hidden.has(foodId)) return;
  hidden.add(foodId);
  emit();
}

/** 같은 원천이 **성공**하면 호출 — 음식이 돌아왔다. */
export function markFoodVisible(foodId: string) {
  if (hidden.delete(foodId)) emit();
}

export function useIsFoodHidden(foodId: string): boolean {
  const snap = () => hidden.has(foodId);
  return useSyncExternalStore(subscribe, snap, snap);
}

/** 테스트 격리 전용 — 모듈 상태가 테스트 사이에 새지 않게. */
export function __resetHiddenFoodsForTest() {
  hidden.clear();
  emit();
}
