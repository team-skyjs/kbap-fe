/**
 * KB-433 로그인 콜라주 레이아웃·마퀴 순수 함수 — 소셜 네이티브 그래프 무의존(유닛 잠금용).
 * 9/5 예진 후속: 고정 높이(430 비례) → **남는 공간 전부**(flex 채움 + 행 수 자동 3~5).
 */
export const TILE = 136; // 시안: 136×136 radius 21
export const GAP = 11;
export const MIN_COLLAGE_H = 220; // 발주 최소(상한 없음)
const Y_OFFSET = 24; // 시안 y -24 — 첫 행이 상단 밖으로 물리는 오프셋

/** 측정된 콜라주 높이 → 행 수(3~5 자동) — 세로 잘림 최소화(최근접 반올림). */
export function collageRows(h: number): number {
  return Math.max(3, Math.min(5, Math.round((h + Y_OFFSET + GAP) / (TILE + GAP))));
}

/** 행 1주기 폭 — 타일 4개(시안 열 수) 기준. seamless wrap의 이동 스팬. */
export function marqueeSpan(tilesPerRow = 4): number {
  return tilesPerRow * (TILE + GAP);
}

/** 이동 시간(ms) — 약 20px/s 선형(발주). 저사양 프레임 드롭 시 속도 절반은 실기 판정 후. */
export function marqueeDuration(span: number, pxPerSec = 20): number {
  return (span / pxPerSec) * 1000;
}

/** 프로필 탭 임베드 가용 높이 — 화면 − 헤더(56) − 탭바(콘텐츠+safe-bottom). */
export function embedAvailableH(winH: number, tabContentH: number, insetBottom: number): number {
  return Math.max(MIN_COLLAGE_H + 200, winH - 56 - (tabContentH + insetBottom));
}
