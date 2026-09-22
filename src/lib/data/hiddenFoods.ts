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
 * - 쓰고 푸는 곳: `trackReadyFood` **한 곳** — FOOD-001 원천(상세·리뷰 목록·북마크 추가/복원·리뷰 작성)은
 *   전부 이걸로 요청한다. 푸는 건 **성공**(음식이 다시 READY)뿐 — 재조회 실패로는 풀리지 않는다
 * - 읽는 곳: `useIsFoodHidden(foodId)`
 * - 저장소는 **요청을 만들지 않는다** — 해제에 필요한 "거부 이후 출발한 요청"은 소비처가 스케줄한다
 *   (`useFoodDetail`이 숨김 중 주기 재조회 — #185 6R). 저장소가 네트워크를 알면 원천·순서 규약이 섞인다.
 *
 * ⚠️ **순서**(Codex #185 3R): 요청이 겹치면 **거부보다 먼저 출발한 옛 성공**이 거부 뒤에 도착할 수 있다
 * (음식이 READY일 때 나간 리뷰 요청이 늦게 오는 사이 북마크가 FOOD-001을 받는 경우). 그 성공이 신호를
 * 풀면 캐시 SAFE 판정이 다시 드러난다. 그래서 **거부를 받은 뒤에 출발한 요청의 성공만** 신호를 푼다 —
 * `trackReadyFood`가 요청 직전에 출발 시각을 찍고, 성공 시 그 값으로 비교한다.
 * 반대 방향(옛 요청의 거부가 늦게 도착)은 **더 보수적인 쪽**(숨김)으로 떨어지므로 그대로 둔다 — 다음
 * 성공이 푼다. 숨김 쪽 오판은 판정을 가릴 뿐 SAFE를 만들지 않는다.
 */
import { useSyncExternalStore } from 'react';
import { isFoodHidden } from '@/lib/api/client';

/** 단조 증가 시계 — 요청 출발과 거부 수신의 선후만 비교한다(벽시계 아님). */
let clock = 0;
/** foodId → 가장 최근 거부를 받은 시각. 있으면 숨김. */
const hiddenSince = new Map<string, number>();
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

/**
 * FOOD-001을 줄 수 있는 요청(서버 `getReadyFood` — 상세·리뷰 목록(foodId)·북마크 추가·리뷰 작성)은
 * **전부 이 함수로** 보낸다. 부기는 엔드포인트 단위라 호출자마다 복사하면 하나씩 빠진다(#185 2R~5R).
 * - `run`이 끝나면(적응·검증까지 `run` 안에서) 해제 — 출발이 마지막 거부보다 뒤일 때만
 * - FOOD-001이면 설정 · 그 외 에러는 신호 무관 · 에러는 그대로 다시 던진다
 * 토스트·롤백 같은 화면 정책은 호출자 몫.
 */
export async function trackReadyFood<T>(foodId: string, run: () => Promise<T>): Promise<T> {
  const startedAt = ++clock; // 거부보다 먼저 나간 옛 성공이 신호를 풀지 못하게(#185 3R)
  try {
    const result = await run();
    markFoodVisible(foodId, startedAt); // run 뒤 = 적응 끝난 페이로드(#185 4R)
    return result;
  } catch (e) {
    if (isFoodHidden(e)) markFoodHidden(foodId);
    throw e;
  }
}

/** FOOD-001을 받은 자리에서 호출 — 이 음식의 캐시된 판정을 즉시 가린다. 이미 숨김이면 시각만 갱신
 *  (더 최근 거부 이후에 출발한 성공만 풀 수 있게). */
export function markFoodHidden(foodId: string) {
  if (!foodId) return;
  const wasHidden = hiddenSince.has(foodId);
  hiddenSince.set(foodId, ++clock);
  if (!wasHidden) emit();
}

/** 성공 해제 — `trackReadyFood` 전용(원천이 직접 부르지 않는다). 마지막 거부 이후 출발한 요청만 푼다. */
function markFoodVisible(foodId: string, requestStartedAt: number) {
  const since = hiddenSince.get(foodId);
  if (since === undefined || requestStartedAt <= since) return; // 거부 전에 나간 옛 성공은 무시
  hiddenSince.delete(foodId);
  emit();
}

export function useIsFoodHidden(foodId: string): boolean {
  const snap = () => hiddenSince.has(foodId);
  return useSyncExternalStore(subscribe, snap, snap);
}

/** 테스트 전용 — 원천이 **저장소에 썼는지**를 React 렌더를 거치지 않고 직접 본다. 원천 테스트에서 프로브
 *  컴포넌트로 읽으면 앞선 비동기 act와 얽혀 렌더가 늦게 반영돼, 저장소는 숨김인데 false를 읽는 일이
 *  있었다(KB-626 3R 실측: 파일 전체 실행에서만 재현). React 경로(화면이 읽는지)는 화면 테스트가 본다. */
export function __isFoodHiddenForTest(foodId: string): boolean {
  return hiddenSince.has(foodId);
}

/** 테스트 격리 전용 — 모듈 상태가 테스트 사이에 새지 않게. */
export function __resetHiddenFoodsForTest() {
  hiddenSince.clear();
  emit();
}
