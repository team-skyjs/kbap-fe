/**
 * zoom.ts — 스캔 결과 핀치 줌/팬 클램프 (P-064④, 순수 함수 — 유닛 잠금).
 * 스케일 1~4, 팬은 확대분의 절반(경계 밖 이동 금지). 더블탭 토글 목표 2.5x.
 */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const DOUBLE_TAP_ZOOM = 2.5;

export function clampScale(s: number): number {
  'worklet'; // P-065: 제스처 onUpdate(UI 스레드)에서 호출 — 지시자 필수
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));
}

/** 축 하나의 팬 클램프 — 스케일된 콘텐츠가 컨테이너를 넘는 여분(절반)까지만.
 *  P-248: contain 레터박스 대응 — contentDim(실표시 이미지 치수)과 containerDim을
 *  분리. 콘텐츠가 컨테이너에 다 들어오면 팬 0(레터박스 여백으로 안 끌려간다).
 *  cover(content=container)면 기존 (scale-1)*dim/2와 동일 — 하위호환. */
export function clampPan(t: number, scale: number, contentDim: number, containerDim: number = contentDim): number {
  'worklet'; // P-065: 동상
  const max = Math.max(0, (contentDim * scale - containerDim) / 2);
  return Math.min(max, Math.max(-max, t));
}
