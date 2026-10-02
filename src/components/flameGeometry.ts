/**
 * KB-706(P-445) 불꽃 뱃지 2차 — 모양·색·일렁임 데이터(렌더와 분리 — 순수 숫자·워클릿만).
 * 레퍼런스 = spec `refs/countdown-badge-1002-flame-ref.mp4`(1.1초·60fps). 다른 앱의 그림이라 **추출·자동 추적 없이 같은 구성으로 직접 그린 path**:
 * 바깥 불꽃(왼쪽 큰 봉우리 + 오른쪽 작은 봉우리, 사이 V 홈, 둥근 아래) · 안쪽 불꽃(봉우리 둘) · 바닥 노란 빛 · 불티 2개.
 *
 * 좌표 = 가라앉은(rest) 불꽃이 x 0..100 · y 4..136에 들어가는 단위계. 일렁임으로 위(음수 y)·옆으로 자라고 불티는 더 위로 날아가므로
 * 캔버스는 FLAME_VIEWBOX(여유 포함)로 그린다.
 * 일렁임 = 같은 명령 구조(M + C×6)의 키프레임 사이 좌표 보간 → `d` 문자열(UI 스레드 — 아래 함수는 전부 'worklet').
 */

/** 뱃지 전용 색(영상 가라앉은 프레임 실측 — DS 토큰 아님, 다른 데서 쓰지 않는다). 스펙 countdown-badge 2차 절 그대로. */
export const FLAME_COLORS = {
  /** 바깥 세로 그라데이션 위(끝) → 아래 가장자리 */
  outer: ['#FEDC33', '#FBAF27', '#F57F18', '#F57C0E'],
  /** 안쪽 불꽃 봉우리(두 값 사이) → 가운데 → 아래(바닥 빛으로 녹아듦) */
  innerPeak: ['#F47233', '#F57638'],
  innerMid: '#F68A30',
  innerBottom: '#F7AC20',
  /** 바닥 빛: 가운데 → 가장자리 */
  glow: ['#FDDC13', '#FAD014'],
  /** 숫자 그림자 — 흰 숫자가 주황·노랑 위에서 또렷하게(불꽃의 어두운 주황을 더 어둡게 — 제안값, KB-701 재발 방지. 3/2/1/0 확대 비교는 PR) */
  numberShadow: 'rgba(138, 58, 6, 0.8)',
} as const;

/** 캔버스(단위) — rest 불꽃 + 위쪽 일렁임·불티 여유 */
export const FLAME_VIEWBOX = { x: -22, y: -64, w: 144, h: 206 } as const;

type Pt = [number, number];
/** M P0 · C (P1 P2 P3) · C (P4 P5 P6=오른쪽 봉우리 끝) · C (P7 P8 P9=V 홈) · C (P10 P11 P12=왼쪽 봉우리 끝) · C (P13 P14 P15) · C (P16 P17 P18=P0) */
const OUTER_REST: Pt[] = [
  [50, 136],
  [76, 136], [100, 120], [100, 92],
  [100, 66], [88, 46], [76, 30],
  [73, 40], [67, 46], [62, 52],
  [61, 34], [55, 16], [44, 4],
  [34, 24], [4, 56], [0, 92],
  [0, 120], [24, 136], [50, 136],
];
/** 같은 구조 — P6 오른쪽 안 봉우리 · P9 안쪽 홈 · P12 왼쪽 안 봉우리 */
const INNER_REST: Pt[] = [
  [54, 128],
  [72, 128], [89, 118], [89, 99],
  [89, 87], [70, 78], [63, 70],
  [62, 74], [59, 76], [57, 77],
  [55, 68], [47, 64], [43, 56],
  [40, 66], [21, 80], [21, 100],
  [21, 118], [36, 128], [54, 128],
];
const TIP_R = 6;
const TIP_L = 12;
const ANCHOR_Y = 136; // 아래가 바닥에 붙은 채 위로 자란다

interface Pose {
  sx: number; // 가로 배율(가운데 기준)
  sy: number; // 세로 배율(바닥 기준)
  lean: number; // 위로 갈수록 오른쪽으로 기울기(맨 위에서 lean 단위)
  left: Pt; // 왼쪽 봉우리 끝 이동
  right: Pt; // 오른쪽 봉우리 끝 이동
}

function posed(base: Pt[], p: Pose, amp: number): number[] {
  const sx = 1 + (p.sx - 1) * amp;
  const sy = 1 + (p.sy - 1) * amp;
  const pts = base.map(([x, y]) => {
    const yy = ANCHOR_Y - (ANCHOR_Y - y) * sy;
    const up = (ANCHOR_Y - yy) / ANCHOR_Y; // 0(바닥) … 1(맨 위)
    return [50 + (x - 50) * sx + p.lean * amp * up, yy] as Pt;
  });
  const move = (i: number, [dx, dy]: Pt) => {
    for (const [j, w] of [[i, 1], [i - 1, 0.6], [i + 1, 0.6]] as const) {
      pts[j] = [pts[j][0] + dx * amp * w, pts[j][1] + dy * amp * w];
    }
  };
  move(TIP_R, p.right);
  move(TIP_L, p.left);
  return pts.flat();
}

/** 영상 동작(60fps 67프레임): 살짝 눌림 → 왼쪽 봉우리가 자라며 오른쪽으로 기움 → 크게 부풂(오른쪽 혀가 길어져 불티로 떨어짐) → 가라앉음 → rest */
const POSES: { t: number; pose: Pose }[] = [
  { t: 0, pose: { sx: 1, sy: 1, lean: 0, left: [0, 0], right: [0, 0] } },
  { t: 0.12, pose: { sx: 1.04, sy: 0.95, lean: 0, left: [0, 3], right: [0, 3] } },
  { t: 0.3, pose: { sx: 1.05, sy: 1.07, lean: 5, left: [6, -6], right: [2, -6] } },
  { t: 0.48, pose: { sx: 1.15, sy: 1.25, lean: 7, left: [10, -12], right: [6, -18] } },
  { t: 0.62, pose: { sx: 1.08, sy: 1.12, lean: 2, left: [2, -6], right: [-4, 6] } },
  { t: 0.8, pose: { sx: 0.96, sy: 1.02, lean: -1, left: [-1, 0], right: [0, -2] } },
  { t: 1, pose: { sx: 1, sy: 1, lean: 0, left: [0, 0], right: [0, 0] } },
];
export const FLAME_TIMES: number[] = POSES.map((k) => k.t);
export const OUTER_FRAMES: number[][] = POSES.map((k) => posed(OUTER_REST, k.pose, 1));
/** 안쪽 불꽃은 같은 리듬, 작은 폭(바깥보다 덜 흔들림) */
export const INNER_FRAMES: number[][] = POSES.map((k) => posed(INNER_REST, k.pose, 0.6));
/** 일렁임 한 바퀴(영상 길이) */
export const FLAME_LOOP_MS = 1100;

/** 키프레임 보간 — t ∈ [0,1], 구간마다 부드럽게(smoothstep) */
export function lerpFrames(frames: number[][], times: number[], t: number): number[] {
  'worklet';
  let i = 0;
  while (i < times.length - 2 && t >= times[i + 1]) i++;
  const span = times[i + 1] - times[i];
  const u0 = span > 0 ? Math.min(1, Math.max(0, (t - times[i]) / span)) : 0;
  const u = u0 * u0 * (3 - 2 * u0);
  const a = frames[i];
  const b = frames[i + 1];
  const out: number[] = [];
  for (let k = 0; k < a.length; k++) out.push(a[k] + (b[k] - a[k]) * u);
  return out;
}

/** M + C×6 숫자 배열 → path `d` (dx·dy 평행 이동) */
export function toPathD(n: number[], dx = 0, dy = 0): string {
  'worklet';
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${f(n[0] + dx)} ${f(n[1] + dy)}`;
  for (let k = 2; k < n.length; k += 6) {
    d += `C${f(n[k] + dx)} ${f(n[k + 1] + dy)} ${f(n[k + 2] + dx)} ${f(n[k + 3] + dy)} ${f(n[k + 4] + dx)} ${f(n[k + 5] + dy)}`;
  }
  return `${d}Z`;
}

/** 불티(휘어진 불꽃 조각 — 영상의 떨어져 나가는 혀 끝) — 원점 기준, 위가 뾰족 */
const SPARK: number[] = [3, -16, 12, -6, 10, 8, 0, 14, 5, 4, 6, -6, 3, -16];
function sparkD(n: number[], dx: number, dy: number): string {
  'worklet';
  const f = (v: number) => Math.round(v * 10) / 10;
  return `M${f(n[0] + dx)} ${f(n[1] + dy)}C${f(n[2] + dx)} ${f(n[3] + dy)} ${f(n[4] + dx)} ${f(n[5] + dy)} ${f(n[6] + dx)} ${f(n[7] + dy)}C${f(n[8] + dx)} ${f(n[9] + dy)} ${f(n[10] + dx)} ${f(n[11] + dy)} ${f(n[12] + dx)} ${f(n[13] + dy)}Z`;
}

/** 불티 두 개 — 부푼 정점에서 오른쪽 혀가, 가라앉을 때 왼쪽 끝이 떨어져 위로 날아가며 사라짐 */
export const SPARKS = [
  { born: 0.44, die: 0.86, from: [84, -6] as Pt, to: [96, -58] as Pt },
  { born: 0.56, die: 0.96, from: [42, -16] as Pt, to: [30, -60] as Pt },
] as const;

export function sparkFrame(i: number, t: number): { d: string; opacity: number } {
  'worklet';
  const s = SPARKS[i];
  if (t < s.born || t > s.die) return { d: sparkD(SPARK, -999, -999), opacity: 0 };
  const u = (t - s.born) / (s.die - s.born);
  const x = s.from[0] + (s.to[0] - s.from[0]) * u;
  const y = s.from[1] + (s.to[1] - s.from[1]) * u;
  const scale = 1 - u * 0.5;
  const n: number[] = [];
  for (let k = 0; k < SPARK.length; k++) n.push(SPARK[k] * scale);
  return { d: sparkD(n, x, y), opacity: u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 };
}

/** 가라앉은 모양(동작 줄이기·꺼진 불꽃·정지) */
export const OUTER_REST_D = toPathD(OUTER_FRAMES[0]);
export const INNER_REST_D = toPathD(INNER_FRAMES[0]);
