/**
 * P-639 회귀: 리사이저(vision-camera-resizer 5.2.4 Metal 커널) 출력이 180° 뒤집혀 자체 모델 박스가 반대편에 그려졌다(14 Pro 후면).
 * 커널 샘플링 공식과 VisionCamera FrameCoordinateSystemConverter(정답 좌표계)를 그대로 옮겨, 작은 버퍼로
 * "리사이저 → uprightBgr"가 픽셀 단위로 똑바로 선 이미지와 같은지 본다 — 후면(left)·전면(right, 거울 유무).
 */
import { bufferToUpright as modelB2U, reorient, toView, uprightBgr, uprightInput, uprightToBuffer, type CamOrientation } from '../bbqModel';

type O = 'left' | 'right';
const BW = 6; // 버퍼(센서) 가로 — 가로로 누운 버퍼
const BH = 4;

/** 버퍼 픽셀 = 고유값(R=번호, G=번호+1, B=번호+2 대신 번호 하나로 식별) */
const bufferValue = (bx: number, by: number) => by * BW + bx + 1;

/** VisionCamera 정답: 버퍼 정규 좌표 p → 똑바로 선 좌표(u). 거울이면 먼저 버퍼 x를 뒤집고 회전(converter의 concatenating 순서). */
function bufferToUpright(px: number, py: number, o: O, mirrored: boolean): [number, number] {
  const x = mirrored ? 1 - px : px;
  return o === 'left' ? [1 - py, x] : [py, 1 - x];
}

/** 리사이저 커널(ResizerKernels.metal): 출력 u → 버퍼 샘플 좌표. left = rotationDegrees 270 → 역회전 90, right = 90 → 역회전 270, 그 뒤 거울. */
function kernelSample(ux: number, uy: number, o: O, mirrored: boolean): [number, number] {
  let c: [number, number] = o === 'left' ? [1 - uy, ux] : [uy, 1 - ux];
  if (mirrored) c = [1 - c[0], c[1]];
  return c;
}

/** 출력(똑바로 선 크기 BH x BW)을 커널로 만든 RGB 바이트(채널 3개 모두 같은 값) */
function resizerOutput(o: O, mirrored: boolean): { rgb: Uint8Array; w: number; h: number } {
  const w = BH;
  const h = BW;
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [sx, sy] = kernelSample((x + 0.5) / w, (y + 0.5) / h, o, mirrored);
      const v = bufferValue(Math.floor(sx * BW), Math.floor(sy * BH));
      rgb.set([v, v, v], (y * w + x) * 3);
    }
  }
  return { rgb, w, h };
}

/** 정답 이미지: 버퍼 각 픽셀을 VisionCamera 좌표계로 옮겨 놓는다 */
function truthUpright(o: O, mirrored: boolean): number[] {
  const w = BH;
  const h = BW;
  const img = new Array<number>(w * h).fill(0);
  for (let by = 0; by < BH; by++) {
    for (let bx = 0; bx < BW; bx++) {
      const [ux, uy] = bufferToUpright((bx + 0.5) / BW, (by + 0.5) / BH, o, mirrored);
      img[Math.floor(uy * h) * w + Math.floor(ux * w)] = bufferValue(bx, by);
    }
  }
  return img;
}

const firstChannel = (bytes: Uint8Array) => Array.from({ length: bytes.length / 3 }, (_, i) => bytes[i * 3]!);

describe.each([
  ['후면', 'left', false],
  ['전면(거울)', 'right', true],
  ['전면(거울 없음)', 'right', false],
] as const)('%s 카메라', (_name, o, mirrored) => {
  it('리사이저 출력 그대로는 정답과 180° 어긋남(x·y 둘 다 반대) — 원인 잠금', () => {
    const out = firstChannel(resizerOutput(o, mirrored).rgb);
    const truth = truthUpright(o, mirrored);
    expect(out).not.toEqual(truth);
    expect(out).toEqual([...truth].reverse());
  });

  it('uprightBgr(바이트 역순) = 정답 이미지(픽셀 단위, x 방향 포함)', () => {
    const { rgb } = resizerOutput(o, mirrored);
    expect(firstChannel(uprightBgr(rgb.buffer as ArrayBuffer))).toEqual(truthUpright(o, mirrored));
  });
});

it('uprightBgr: 픽셀 순서 180°·채널 RGB→BGR, 원본 버퍼 무변', () => {
  const src = new Uint8Array([1, 2, 3, 4, 5, 6]); // 픽셀 2개: (1,2,3) (4,5,6)
  expect(Array.from(uprightBgr(src.buffer))).toEqual([6, 5, 4, 3, 2, 1]); // 뒤 픽셀이 앞으로 + BGR
  expect(Array.from(src)).toEqual([1, 2, 3, 4, 5, 6]);
});

it('사용처 잠금: 가이드·쌈 코칭(runFrame)과 측정 화면 COCO 경로 모두 uprightInput(방향별)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('fs') as typeof import('fs');
  const hook = readFileSync('src/features/bbq/useBbqDetection.ts', 'utf8');
  expect(hook).toContain('const inp = uprightInput(r.getPixelBuffer(), frame.orientation);');
  expect(hook).toContain("run({ data: inp.data, width: rd.w, height: rd.h, format: inp.format, layout: 'hwc' })");
  const probe = readFileSync('src/features/bbq/ProbeScreen.tsx', 'utf8');
  expect(probe).toContain('const inp = uprightInput(resized.getPixelBuffer(), frame.orientation);');
  expect(probe).toContain("{ data: inp.data, width: SIZE, height: SIZE, format: inp.format, layout: 'hwc' }");
  expect(probe).toContain('runFrame(frame, bbqResizer, bbqRun, rd, '); // 측정 화면 자체 모델도 같은 runFrame
  expect(`${hook}\n${probe}`).not.toMatch(/new Uint8Array\((r|resized)\.getPixelBuffer\(\)\)/);
});

/** P-644: 커널(ResizerKernels.metal) 그대로 — 역회전(360 - 회전각) 뒤 거울. 회전각 up 0 · right 90 · down 180 · left 270 */
function kernelAny(ux: number, uy: number, o: CamOrientation, mirrored: boolean): [number, number] {
  const deg = { up: 0, right: 90, down: 180, left: 270 }[o];
  const inv = (360 - deg) % 360;
  let c: [number, number] = [ux, uy];
  if (inv === 90) c = [1 - c[1], c[0]];
  else if (inv === 180) c = [1 - c[0], 1 - c[1]];
  else if (inv === 270) c = [c[1], 1 - c[0]];
  if (mirrored) c = [1 - c[0], c[1]];
  return c;
}
const ALL: CamOrientation[] = ['up', 'right', 'down', 'left'];

describe('P-644 가로: 네 방향 리사이저 입력', () => {
  it.each(ALL.flatMap((o) => [[o, false], [o, true]] as const))('%s 거울=%s: uprightInput = 정답 이미지', (o, m) => {
    const side = o === 'left' || o === 'right';
    const w = side ? BH : BW;
    const h = side ? BW : BH;
    const rgb = new Uint8Array(w * h * 3);
    const truth = new Array<number>(w * h).fill(0);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const [sx, sy] = kernelAny((x + 0.5) / w, (y + 0.5) / h, o, m);
        const v = bufferValue(Math.floor(sx * BW), Math.floor(sy * BH));
        rgb.set([v, v, v], (y * w + x) * 3);
      }
    for (let by = 0; by < BH; by++)
      for (let bx = 0; bx < BW; bx++) {
        const [ux, uy] = modelB2U((bx + 0.5) / BW, (by + 0.5) / BH, o, m);
        truth[Math.floor(uy * h) * w + Math.floor(ux * w)] = bufferValue(bx, by);
      }
    const inp = uprightInput(rgb.buffer as ArrayBuffer, o);
    expect(inp.format).toBe(side ? 'bgr' : 'rgb');
    expect(firstChannel(inp.data)).toEqual(truth);
  });

  it('kernelSample(테스트 원래 공식) = kernelAny(left·right)', () => {
    for (const o of ['left', 'right'] as const) for (const m of [false, true]) expect(kernelAny(0.2, 0.7, o, m).map((v) => +v.toFixed(6))).toEqual(kernelSample(0.2, 0.7, o, m).map((v) => +v.toFixed(6)));
  });
});

describe('P-644 가로: 네 기기 방향 x 후면·전면, 박스·관절점이 세로 UI 미리보기 제자리', () => {
  const rot = (o: CamOrientation, k: number) => ALL[(ALL.indexOf(o) + k) % 4]!;
  it('bufferToUpright ∘ uprightToBuffer = 항등', () => {
    for (const o of ALL) for (const m of [false, true]) {
      const [bx, by] = uprightToBuffer(0.3, 0.8, o, m);
      const [ux, uy] = modelB2U(bx, by, o, m);
      expect(ux).toBeCloseTo(0.3);
      expect(uy).toBeCloseTo(0.8);
    }
  });
  it.each([
    ['후면', 'left', false],
    ['전면', 'right', true],
  ] as const)('%s: 세로(base) 기준 네 방향', (_n, base, m) => {
    for (let k = 0; k < 4; k++) {
      const f = rot(base, k); // 세로 · 가로 · 거꾸로 · 반대 가로
      const side = f === 'left' || f === 'right';
      const [fw, fh] = side ? [360, 640] : [640, 360]; // 프레임 방향 리사이즈 크기
      // 버퍼의 한 물체(점 2개)를 프레임 방향 좌표로 → reorient → 세로 UI 정답과 같아야
      const pts: [number, number][] = [[0.1, 0.2], [0.35, 0.6]];
      const inF = pts.map(([bx, by]) => modelB2U(bx, by, f, m));
      const box = { x1: Math.min(inF[0]![0], inF[1]![0]) * fw, y1: Math.min(inF[0]![1], inF[1]![1]) * fh, x2: Math.max(inF[0]![0], inF[1]![0]) * fw, y2: Math.max(inF[0]![1], inF[1]![1]) * fh };
      const r = reorient(box, fw, fh, { f, base, m });
      const truth = pts.map(([bx, by]) => modelB2U(bx, by, base, m));
      expect([r.w, r.h]).toEqual([360, 640]); // 세로 UI 기준 크기
      expect(r.box.x1 / r.w).toBeCloseTo(Math.min(truth[0]![0], truth[1]![0]));
      expect(r.box.y1 / r.h).toBeCloseTo(Math.min(truth[0]![1], truth[1]![1]));
      expect(r.box.x2 / r.w).toBeCloseTo(Math.max(truth[0]![0], truth[1]![0]));
      expect(r.box.y2 / r.h).toBeCloseTo(Math.max(truth[0]![1], truth[1]![1]));
      // 관절점(크기 0 상자)도 같은 변환
      const [jx, jy] = inF[0]!;
      const p = toView({ x1: jx * fw, y1: jy * fh, x2: jx * fw, y2: jy * fh }, fw, fh, { f, base, m }, 360, 640, false);
      expect(p.x / 360).toBeCloseTo(truth[0]![0]);
      expect(p.y / 640).toBeCloseTo(truth[0]![1]);
    }
  });
  it('세로(f = base)는 변환 없음, xf 없음도 그대로', () => {
    const b = { x1: 1, y1: 2, x2: 3, y2: 4 };
    expect(reorient(b, 360, 640, { f: 'left', base: 'left', m: false })).toEqual({ box: b, w: 360, h: 640 });
    expect(toView(b, 360, 640, null, 360, 640, false)).toEqual({ x: 1, y: 2, w: 2, h: 2 });
  });
});
