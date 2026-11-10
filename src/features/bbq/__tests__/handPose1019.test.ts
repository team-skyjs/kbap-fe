/**
 * P-643 손 인식: 방향 표(Vision에 넘길 CGImagePropertyOrientation) · 좌표 변환 · 쌈 코칭 신호(손 겹침, 손끝 모임, 위쪽 진입 뒤 사라짐).
 */
import { readFileSync } from 'fs';
import type { Shown } from '../bbqTracker';
import { HAND_TUNING, JOINT_COUNT, createHandSignals, palmBox, parseHands, pickHand, tipSpread, vnOrientation, type Hand, type Joint } from '../handPose';
import { NO_SIGNALS, createCoach, currentStep, finishedByAuto, isDone, step, type Signals } from '../wrapCoach';

type O = 'up' | 'right' | 'down' | 'left';

/** VisionCamera 정답 좌표계: 버퍼 정규 좌표 → 똑바로 선 좌표(orientation1019의 bufferToUpright + up·down) */
function bufferToUpright(px: number, py: number, o: O, mirrored: boolean): [number, number] {
  const x = mirrored ? 1 - px : px;
  if (o === 'left') return [1 - py, x];
  if (o === 'right') return [py, 1 - x];
  if (o === 'down') return [1 - x, 1 - py];
  return [x, py];
}

/** CGImagePropertyOrientation 정의(EXIF): 저장 이미지의 0행·0열이 표시 이미지의 어느 변에 있는가 → 저장 좌표 → 표시 좌표 */
const CG: Record<number, [row0: 'top' | 'bottom' | 'left' | 'right', col0: 'top' | 'bottom' | 'left' | 'right']> = {
  1: ['top', 'left'],
  2: ['top', 'right'],
  3: ['bottom', 'right'],
  4: ['bottom', 'left'],
  5: ['left', 'top'],
  6: ['right', 'top'],
  7: ['right', 'bottom'],
  8: ['left', 'bottom'],
};
function cgDisplay(sx: number, sy: number, code: number): [number, number] {
  const [row0, col0] = CG[code]!;
  if (row0 === 'top' || row0 === 'bottom') return [col0 === 'left' ? sx : 1 - sx, row0 === 'top' ? sy : 1 - sy];
  return [row0 === 'left' ? sy : 1 - sy, col0 === 'top' ? sx : 1 - sx];
}

describe('Vision 방향 표 = VisionCamera 좌표계', () => {
  const pts: [number, number][] = [[0.1, 0.2], [0.8, 0.3], [0.4, 0.9]];
  it.each([
    ['up', false], ['up', true], ['right', false], ['right', true], ['down', false], ['down', true], ['left', false], ['left', true],
  ] as const)('%s 거울=%s', (o, m) => {
    const code = vnOrientation(o, m);
    for (const [x, y] of pts) {
      const [ex, ey] = bufferToUpright(x, y, o, m);
      const [gx, gy] = cgDisplay(x, y, code);
      expect(gx).toBeCloseTo(ex);
      expect(gy).toBeCloseTo(ey);
    }
  });
  it('실기 두 경우: 후면 = left → right(6), 전면 거울 = right → leftMirrored(5)', () => {
    expect(vnOrientation('left', false)).toBe(6);
    expect(vnOrientation('right', true)).toBe(5);
  });
});

/** 똑바로 선 픽셀 좌표의 손 하나: 손목(cx, cy+60), MCP 4개는 cy 줄, 손끝은 spread만큼 벌어짐 */
function hand(cx: number, cy: number, spread = 40, c = 0.9): Hand {
  const joints: Joint[] = Array.from({ length: JOINT_COUNT }, () => ({ x: cx, y: cy, c }));
  joints[0] = { x: cx, y: cy + 60, c }; // wrist
  joints[1] = { x: cx - 30, y: cy + 40, c }; // thumb CMC
  [5, 9, 13, 17].forEach((i, k) => (joints[i] = { x: cx - 30 + k * 20, y: cy, c }));
  [4, 8, 12, 16, 20].forEach((i, k) => (joints[i] = { x: cx + (k - 2) * spread, y: cy - 50, c }));
  return { joints };
}
const box = (cls: number, cx: number, cy: number, held = false): Shown => ({ id: cls, cls, score: 0.5, held, x1: cx - 60, y1: cy - 60, x2: cx + 60, y2: cy + 60 });

describe('좌표·손 모양', () => {
  it('parseHands: Vision 정규(원점 왼쪽 아래) → w x h 픽셀(원점 왼쪽 위), 손 2개', () => {
    const flat = new Array(JOINT_COUNT * 3 * 2).fill(0);
    flat.splice(0, 3, 0.25, 0.75, 0.9); // 손 1 손목
    flat.splice(JOINT_COUNT * 3, 3, 0.5, 0.1, 0.8); // 손 2 손목
    const hs = parseHands(flat, 360, 640);
    expect(hs).toHaveLength(2);
    expect(hs[0]!.joints[0]).toEqual({ x: 90, y: 160, c: 0.9 });
    expect(hs[1]!.joints[0]!.y).toBeCloseTo(576);
    expect(parseHands([], 360, 640)).toEqual([]);
  });

  it('손바닥 상자 = 손목·엄지 CMC·MCP, 믿을 관절 3개 미만이면 없음', () => {
    expect(palmBox(hand(100, 100))).toEqual({ x1: 70, y1: 100, x2: 130, y2: 160 });
    expect(palmBox(hand(100, 100, 40, 0.1))).toBeNull();
  });

  it('손끝 모임 값은 크기 무관, 모으면 줄어듦', () => {
    const open = tipSpread(hand(100, 100, 40))!;
    const closed = tipSpread(hand(100, 100, 10))!;
    expect(closed).toBeLessThan(open * HAND_TUNING.gatherRatio);
    const big: Hand = { joints: hand(100, 100, 40).joints.map((j) => ({ ...j, x: j.x * 2, y: j.y * 2 })) };
    expect(tipSpread(big)).toBeCloseTo(open);
  });

  it('손이 둘이면 손 위 박스와 겹친 손이 주 손', () => {
    const a = hand(100, 400);
    const b = hand(300, 400);
    expect(pickHand([a, b], [box(7, 300, 420)])?.hand).toBe(b);
    expect(pickHand([a, b], [box(7, 600, 420)])).toBeNull();
  });
});

describe('쌈 코칭 신호(손)', () => {
  const H = 640;
  const sig = (p: Partial<Signals>) => ({ ...NO_SIGNALS, ...p });

  it('손 없음 = P-641 매핑 그대로(바닥 동작)', () => {
    const s = createHandSignals();
    expect(s([box(7, 100, 400)], [], H)).toEqual(sig({ leafOnHand: true }));
    expect(s([box(9, 100, 400)], [], H)).toEqual(sig({ leafOnHand: true, wrapped: true }));
  });

  it('손 겹침: 잎이 손바닥에 있으면 leafOnHand, 손은 있는데 안 겹치면 꺼짐', () => {
    const s = createHandSignals();
    expect(s([box(7, 100, 420)], [hand(100, 400)], H).leafOnHand).toBe(true);
    expect(s([box(7, 300, 120)], [hand(100, 400)], H)).toEqual(sig({}));
  });

  it('S4: 9가 손과 겹침 = wrapped, 손과 안 겹친 9는 아님', () => {
    const s = createHandSignals();
    expect(s([box(9, 100, 420)], [hand(100, 400)], H).wrapped).toBe(true);
    expect(s([box(9, 300, 120)], [hand(100, 400)], H).wrapped).toBe(false);
  });

  it('S4: 8을 든 뒤 손끝이 모이면 wrapped(클래스가 7로 흔들려도), 덜 모이면 아님', () => {
    const s = createHandSignals();
    expect(s([box(8, 100, 420)], [hand(100, 400, 40)], H).wrapped).toBe(false);
    expect(s([box(8, 100, 420)], [hand(100, 400, 30)], H).wrapped).toBe(false); // 0.75배
    expect(s([box(7, 100, 420)], [hand(100, 400, 20)], H).wrapped).toBe(true); // 0.5배
  });

  it('손끝 모임 기준은 손 위 박스가 사라지면 초기화', () => {
    const s = createHandSignals();
    s([box(8, 100, 420)], [hand(100, 400, 40)], H);
    s([], [hand(100, 400, 40)], H);
    expect(s([box(7, 100, 420)], [hand(100, 400, 20)], H).wrapped).toBe(false);
  });

  it('S5: 손이 위쪽 25%로 올라간 뒤 손 위 박스가 사라지면 gone, 아래에서 사라지면 아님', () => {
    const s = createHandSignals();
    s([box(9, 100, 420)], [hand(100, 400)], H);
    s([box(9, 100, 60)], [hand(100, 40)], H); // 손바닥 중심 y 70 < 160
    expect(s([box(9, 100, 60, true)], [hand(100, 40)], H).gone).toBe(true); // 트래커 유지(held)는 본 것으로 안 침
    expect(s([], [], H).gone).toBe(true); // 손까지 화면 밖이어도
    const low = createHandSignals();
    low([box(9, 100, 420)], [hand(100, 400)], H);
    expect(low([], [hand(100, 400)], H).gone).toBe(false);
  });

  it('사라졌다 다시 보이면 gone 꺼짐', () => {
    const s = createHandSignals();
    s([box(9, 100, 60)], [hand(100, 40)], H);
    expect(s([], [], H).gone).toBe(true);
    expect(s([box(7, 100, 420)], [hand(100, 400)], H).gone).toBe(false);
  });

  it('손 신호로 끝까지 자동 → Nice wrap(쌈장 못 봄 = S3 건너뜀)', () => {
    const s = createHandSignals();
    let c = createCoach({ sawSsamjang: false, avoidSsamjang: false }, 0);
    let t = 0;
    const feed = (shown: Shown[], hands: Hand[], n: number) => {
      for (let i = 0; i < n; i++, t += 100) c = step(c, s(shown, hands, H), t);
    };
    feed([box(7, 100, 420)], [hand(100, 400)], 6);
    expect(currentStep(c)).toBe('meat');
    feed([box(8, 100, 420)], [hand(100, 400, 40)], 6);
    expect(currentStep(c)).toBe('wrap');
    feed([box(8, 100, 420)], [hand(100, 400, 15)], 6); // 손끝 모음
    expect(currentStep(c)).toBe('eat');
    feed([box(9, 100, 60)], [hand(100, 40)], 2);
    feed([], [], 6);
    expect(isDone(c)).toBe(true);
    expect(finishedByAuto(c)).toBe(true);
  });
});

it('사용처 잠금: 쌈 코칭 = 손 신호, 장면 2 훅만 손 인식, runFrame이 방향 표로 네이티브 호출', () => {
  const wrap = readFileSync('src/features/bbq/WrapScreen.tsx', 'utf8');
  expect(wrap).toContain('const sig = handSignals(shown, hands, frameH);');
  expect(wrap).not.toContain('signalsFromClasses');
  const hook = readFileSync('src/features/bbq/useBbqDetection.ts', 'utf8');
  expect(hook).toContain("useState(() => (scene === 'hand' ? tryCreateHandPose() : undefined))");
  expect(hook).toContain('hand.pose.detect(frame, vnOrientation(frame.orientation, frame.isMirrored))');
});
