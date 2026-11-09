/**
 * KB-1019 장면 1: 자체 탐지 모델 v1(KB-1020, et_coreml_o2o.pte) 후처리.
 * 정본 = kbap-bbq-vision-lab/docs/handoff-to-app.md 2~5절. 워크릿·jest 양쪽에서 도는 순수 함수.
 * 실기에서 다시 맞출 수치는 전부 TUNING 한곳에 둔다.
 */

/** 출력 클래스 번호 순서(0~9). 모델과 묶여 있어 바꾸면 안 된다. */
export const LABELS = [
  'grill',
  'raw_meat',
  'cooked_meat',
  'leaf',
  'ssamjang',
  'tongs',
  'scissors',
  'leaf_on_hand',
  'topped_leaf',
  'wrapped_ssam',
] as const;
export type BbqLabel = (typeof LABELS)[number];
export const RAW_MEAT = 1;
export const COOKED_MEAT = 2;
export const GRILL = 0;

export type GrillGateConfig =
  | { mode: 'window'; window: number; need: number }
  | { mode: 'consecutive'; ms: number };

export const TUNING = {
  input: 640,
  padValue: 114,
  /** 클래스별 임계값(LABELS 순서, 검증 F1 최댓값). 실기 재조정 대상 */
  thresholds: [0.3, 0.2, 0.15, 0.15, 0.3, 0.25, 0.5, 0.35, 0.65, 0.5] as readonly number[],
  /** 같은 클래스 중복 박스 제거 겹침 */
  nmsIou: 0.6,
  /** 이름표 유지(0.3~0.5초) */
  holdMs: 400,
  /** 프레임 사이 같은 물체로 잇는 겹침 */
  linkIou: 0.3,
  /** 날고기·익은 고기 다수결 창 */
  meatVoteMs: 1000,
  /** 불판 띠: 기본 최근 10프레임 중 7, 대안 { mode: 'consecutive', ms: 2000 } */
  grill: { mode: 'window', window: 10, need: 7 } as GrillGateConfig,
};

export type Box = { x1: number; y1: number; x2: number; y2: number };
export type Det = Box & { cls: number; score: number };
export type Letterbox = { r: number; padX: number; padY: number };

/** executorch cv.resize 'letterbox'와 같은 계산(C++ int 나눗셈 = 버림). */
export function letterbox(srcW: number, srcH: number, size: number): Letterbox {
  'worklet';
  const r = Math.min(size / srcW, size / srcH);
  const newW = Math.round(srcW * r);
  const newH = Math.round(srcH * r);
  return { r, padX: Math.trunc((size - newW) / 2), padY: Math.trunc((size - newH) / 2) };
}

/**
 * (1, rows, cols) 출력 해석: 행마다 최고 점수 클래스 → 클래스 임계값 미만 버림.
 * 열 0~3 = x1,y1,x2,y2(640 기준 픽셀), 열 4~ = 클래스 점수(시그모이드 적용됨).
 */
export function decodeO2O(out: ArrayLike<number>, rows: number, cols: number, thresholds: readonly number[]): Det[] {
  'worklet';
  const res: Det[] = [];
  for (let i = 0; i < rows; i++) {
    const o = i * cols;
    let best = -1;
    let s = 0;
    for (let c = 4; c < cols; c++) {
      const v = out[o + c]!;
      if (v > s) {
        s = v;
        best = c - 4;
      }
    }
    if (best < 0 || s < thresholds[best]!) continue;
    res.push({ cls: best, score: s, x1: out[o]!, y1: out[o + 1]!, x2: out[o + 2]!, y2: out[o + 3]! });
  }
  return res;
}

export function iou(a: Box, b: Box): number {
  'worklet';
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return union > 0 ? inter / union : 0;
}

/** 같은 클래스끼리만, 겹침이 thr를 넘으면 점수 낮은 쪽을 버린다. */
export function nmsSameClass(dets: Det[], thr: number): Det[] {
  'worklet';
  const sorted = dets.slice().sort((a, b) => b.score - a.score);
  const keep: Det[] = [];
  for (const d of sorted) {
    if (!keep.some((k) => k.cls === d.cls && iou(k, d) > thr)) keep.push(d);
  }
  return keep;
}

/** 640 입력 좌표 → 레터박스 전 원본 좌표(원본 범위로 자름). */
export function unletterbox(d: Det, lb: Letterbox, srcW: number, srcH: number): Det {
  'worklet';
  const cx = (v: number, max: number) => Math.min(max, Math.max(0, v));
  return {
    ...d,
    x1: cx((d.x1 - lb.padX) / lb.r, srcW),
    y1: cx((d.y1 - lb.padY) / lb.r, srcH),
    x2: cx((d.x2 - lb.padX) / lb.r, srcW),
    y2: cx((d.y2 - lb.padY) / lb.r, srcH),
  };
}

/**
 * (1, rows, 6) e2e 출력 해석(et_xnnpack_e2e — 전달 문서 4절): 열 x1,y1,x2,y2,점수,클래스 번호. 300행이 늘 채워져 온다 — 클래스 임계값 미만·
 * 번호가 범위 밖인 행은 버린다.
 */
export function decodeE2E(out: ArrayLike<number>, rows: number, thresholds: readonly number[]): Det[] {
  'worklet';
  const res: Det[] = [];
  for (let i = 0; i < rows; i++) {
    const o = i * 6;
    const s = out[o + 4]!;
    const cls = Math.round(out[o + 5]!);
    if (!(cls >= 0 && cls < thresholds.length) || !(s >= thresholds[cls]!)) continue;
    res.push({ cls, score: s, x1: out[o]!, y1: out[o + 1]!, x2: out[o + 2]!, y2: out[o + 3]! });
  }
  return res;
}

export type ModelKind = 'o2o' | 'e2e';
/** 모델별 출력 모양: Core ML o2o = (1, 8400, 14), XNNPACK e2e = (1, 300, 6) */
export const OUTPUT_SHAPE: Record<ModelKind, readonly [number, number, number]> = { o2o: [1, 8400, 14], e2e: [1, 300, 6] };

/** 해석 결과(중복 제거 전) — 진단용 통계까지 */
export function decode(kind: ModelKind, out: ArrayLike<number>, thresholds: readonly number[]): Det[] {
  'worklet';
  return kind === 'o2o' ? decodeO2O(out, 8400, 14, thresholds) : decodeE2E(out, 300, thresholds);
}

/**
 * 전달 문서 4절 처리 순서 1~4를 한 번에. srcW·srcH = 레터박스 전 이미지 크기.
 * P-637: 워크릿에서 기본 인자로 모듈 상수를 쓰면 안 된다 — 기본 인자는 클로저를 풀기 전(매개변수 스코프)에 평가돼
 * 워크릿 런타임에선 ReferenceError(실기 추론 0의 원인). 튜닝은 본문에서 읽는다.
 */
export function postprocess(kind: ModelKind, out: ArrayLike<number>, srcW: number, srcH: number): Det[] {
  'worklet';
  const lb = letterbox(srcW, srcH, TUNING.input);
  return nmsSameClass(decode(kind, out, TUNING.thresholds), TUNING.nmsIou).map((d) => unletterbox(d, lb, srcW, srcH));
}

/** 진단 줄: 전체 행의 최고 점수·클래스(임계값 무관) */
export function topScore(kind: ModelKind, out: ArrayLike<number>): { score: number; cls: number } {
  'worklet';
  let score = -1;
  let cls = -1;
  if (kind === 'e2e') {
    for (let i = 0; i < 300; i++) if (out[i * 6 + 4]! > score) { score = out[i * 6 + 4]!; cls = Math.round(out[i * 6 + 5]!); }
    return { score, cls };
  }
  for (let i = 0; i < 8400; i++) for (let c = 4; c < 14; c++) if (out[i * 14 + c]! > score) { score = out[i * 14 + c]!; cls = c - 4; }
  return { score, cls };
}

/** 똑바로 선 원본 좌표 → 화면(프리뷰 cover) 좌표. 리사이저가 회전·거울을 이미 적용하므로 mirror는 보정 토글용. */
export function coverMap(b: Box, srcW: number, srcH: number, viewW: number, viewH: number, mirror: boolean) {
  const s = Math.max(viewW / srcW, viewH / srcH);
  const px = (viewW - srcW * s) / 2;
  const py = (viewH - srcH * s) / 2;
  const xa = px + b.x1 * s;
  const xb = px + b.x2 * s;
  const x = mirror ? viewW - xb : xa;
  return { x, y: py + b.y1 * s, w: xb - xa, h: (b.y2 - b.y1) * s };
}

/** 리사이저 출력 크기: 똑바로 선 프레임 비율 그대로 긴 변 640(검은 여백 없이) → 회색 레터박스는 executorch가. */
export function resizeDims(uw: number, uh: number, long = TUNING.input) {
  return uh >= uw ? { w: Math.round((long * uw) / uh), h: long } : { w: long, h: Math.round((long * uh) / uw) };
}

/**
 * P-636 버그 1: expo-asset localUri는 인코딩된 file URL(`Application%20Support`) — 그대로 넘기면 AccessFailed.
 * file:// 제거 + 퍼센트 디코딩한 파일 경로.
 */
export function fileUriToPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

/**
 * P-636 버그 2: executorch 내장 탐지기 박스는 { xmin, ymin, xmax, ymax }(xyxy) — x1~y2로 읽으면 NaN(사각형 0·라벨 (0,0) 겹침).
 * 숫자가 아니면 버린다(null).
 */
export function fromXyxy(b: { xmin?: unknown; ymin?: unknown; xmax?: unknown; ymax?: unknown }): Box | null {
  const v = [b.xmin, b.ymin, b.xmax, b.ymax];
  if (!v.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const [x1, y1, x2, y2] = v as number[];
  return { x1: x1!, y1: y1!, x2: x2!, y2: y2! };
}

/**
 * COCO 측정 경로: 리사이저가 회전·거울까지 적용한 똑바로 선 프레임(uw×uh)을 가운데 정사각형으로 cover 자른 size×size 입력 →
 * 똑바로 선 원본 좌표. 이후 coverMap으로 화면에(회전 추가 없음).
 */
export function squareCropToUpright(b: Box, size: number, uw: number, uh: number): Box {
  const s = Math.min(uw, uh);
  const k = s / size;
  const ox = (uw - s) / 2;
  const oy = (uh - s) / 2;
  return { x1: ox + b.x1 * k, y1: oy + b.y1 * k, x2: ox + b.x2 * k, y2: oy + b.y2 * k };
}
