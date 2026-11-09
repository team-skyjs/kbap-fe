/**
 * KB-1019 시연 관문: 탐지 박스(리사이저 정사각형 입력 좌표) → 화면(프리뷰 cover) 좌표.
 * 리사이저는 프레임 버퍼(회전 전)를 가운데 정사각형으로 cover 자른다고 본다 —
 * 실기에서 틀리면 화면의 회전·거울 토글로 맞춘다(ponytail: 실측 보정 노브).
 */
export type Orientation = 'up' | 'right' | 'down' | 'left';
export type Box = { x1: number; y1: number; x2: number; y2: number };
export type Rect = { x: number; y: number; w: number; h: number };

type MapArgs = {
  box: Box;
  inputSize: number; // 모델 입력 정사각형 한 변(예: 384)
  frameW: number; // 회전 전 버퍼 크기
  frameH: number;
  orientation: Orientation; // 버퍼를 똑바로 세우려면 시계 방향으로 돌릴 양
  viewW: number;
  viewH: number;
  mirror: boolean;
};

function rotate(x: number, y: number, w: number, h: number, o: Orientation): [number, number] {
  'worklet';
  if (o === 'right') return [h - y, x];
  if (o === 'down') return [w - x, h - y];
  if (o === 'left') return [y, w - x];
  return [x, y];
}

export function mapBox({ box, inputSize, frameW, frameH, orientation, viewW, viewH, mirror }: MapArgs): Rect {
  const s = Math.min(frameW, frameH);
  const k = s / inputSize;
  const ox = (frameW - s) / 2;
  const oy = (frameH - s) / 2;
  const sideways = orientation === 'right' || orientation === 'left';
  const uw = sideways ? frameH : frameW;
  const uh = sideways ? frameW : frameH;
  const scale = Math.max(viewW / uw, viewH / uh);
  const px = (viewW - uw * scale) / 2;
  const py = (viewH - uh * scale) / 2;
  const pts = [
    rotate(ox + box.x1 * k, oy + box.y1 * k, frameW, frameH, orientation),
    rotate(ox + box.x2 * k, oy + box.y2 * k, frameW, frameH, orientation),
  ].map(([x, y]) => {
    const vx = px + x * scale;
    return [mirror ? viewW - vx : vx, py + y * scale] as const;
  });
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const ORDER: Orientation[] = ['up', 'right', 'down', 'left'];
/** 보정 토글: 측정된 방향에 시계 방향 90° 단위 추가 회전. */
export function addTurns(o: Orientation, turns: number): Orientation {
  return ORDER[(ORDER.indexOf(o) + turns) % 4]!;
}
