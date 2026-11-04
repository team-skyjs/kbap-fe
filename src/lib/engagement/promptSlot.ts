/**
 * KB-986 — 실행(JS 런타임) 당 일회성 안내 시트 자리 하나. 스토어 리뷰 유도·광고성 동의·코치마크·스캔 종료 넛지가
 * **띄우기로 결정한 순간** markPromptShown()을 부르고, 재방문 피드백 시트는 이미 찍혔으면 다음 실행으로 미룬다.
 * (각 시트의 빈도 규칙은 그대로 — 이 자리는 피드백만 본다.)
 */
let shownThisRun = false;

export function markPromptShown(): void {
  shownThisRun = true;
}

export function promptShownThisRun(): boolean {
  return shownThisRun;
}

/** 테스트 전용 — 새 실행 흉내 */
export function _resetPromptSlotForTest(): void {
  shownThisRun = false;
}
