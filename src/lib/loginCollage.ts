/** KB-433(Codex #32 P2): 로그인 콜라주 높이 — 시안 812 프레임 기준 430pt를 화면
 *  높이에 비례 축소(최소 220). 순수 함수 — 유닛이 소형 기기 비중첩을 잠근다. */
export const COLLAGE_BASE = 430;

export function collageHeight(winH: number): number {
  return Math.max(220, Math.min(COLLAGE_BASE, Math.round(winH * (COLLAGE_BASE / 812))));
}
