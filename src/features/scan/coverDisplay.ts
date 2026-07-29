/**
 * coverDisplay.ts — 스캔 결과 사진 cover 표시 rect (P-079/KB-238, 순수 함수 — 유닛 잠금).
 *
 * 결과 화면은 사진을 **컨테이너 가득(cover)** 채운다 — 하단 여백 0. 초과분은
 * 중앙 크롭되므로 rect가 컨테이너 밖으로 확장될 수 있다(x·y 음수). OCR 박스
 * (원본 정규화 좌표) → 화면 투영은 이 rect 기준이라 크롭·스케일이 자동 반영.
 * 캡처 시점 WYSIWYG 크롭(coverCrop.ts)과 별개 — 여기는 표시 계층.
 */
export type DisplayRect = { x: number; y: number; w: number; h: number };

export function coverDisplayRect(contW: number, contH: number, imgW: number, imgH: number): DisplayRect {
  if (!(contW > 0 && contH > 0 && imgW > 0 && imgH > 0)) return { x: 0, y: 0, w: contW || 0, h: contH || 0 };
  const scale = Math.max(contW / imgW, contH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: (contW - w) / 2, y: (contH - h) / 2, w, h };
}

/** 크롭으로 화면 밖에 나간 마커는 숨김 — 앵커(pill 좌상단 기준점)가 컨테이너 안일 때만 표시. */
export function markerVisible(lx: number, ty: number, contW: number, contH: number): boolean {
  return lx >= 0 && lx <= contW && ty >= 0 && ty <= contH;
}
