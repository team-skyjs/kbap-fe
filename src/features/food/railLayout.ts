/**
 * P-319(KB-485) — 홈 가로 레일 카드 폭: 화면 폭 기준 "2장 + 3번째 카드 peek".
 * 고정 174는 393pt 화면에서 2장이 딱 맞아 3번째가 1pt만 보였다(가로 레일 인지 불가).
 * 발주 예시값 기준(393→152 · 375→143 · 430→171): 고정분 88 = 좌 패딩 20 + gap 12×2
 * + peek 44. (발주 산식의 PEEK 36과는 8pt 차이 — 예시값 3종을 정본으로 채택, REPORTS 명시.)
 * 최소 폭 140 보장(그 아래는 peek이 줄어드는 셈). 비율은 gphoto aspectRatio가 유지.
 */
export const RAIL_EDGE = 20; // 레일 좌 패딩
export const RAIL_GAP = 12;
export const RAIL_PEEK = 44; // 3번째 카드 노출 폭(예시값 역산)
export const RAIL_MIN_CARD_W = 140;

export function railCardW(windowW: number): number {
  return Math.max(RAIL_MIN_CARD_W, Math.floor((windowW - RAIL_EDGE - RAIL_GAP * 2 - RAIL_PEEK) / 2));
}
