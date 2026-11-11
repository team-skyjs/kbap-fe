/**
 * KB-1019 장면 2 쌈 코칭 상태 머신(P-632). 순수 함수 — 신호원은 밖에서 주입한다(모델 v1·수동 Next, 이후 손·얼굴·재학습 모델).
 * S1 잎 → S2 고기 → S3 쌈장 → S4 싸기 → S5 먹기 → 완료.
 * - 자동 전환 = 해당 신호가 "그 단계에 들어온 뒤" HOLD_MS 이상 계속 켜져 있을 때(한 틱에 여러 단계 연쇄 없음).
 * - manualNext = 현재 단계를 즉시 넘김(표시는 체크만, 칭찬 없음). "Nice wrap"은 S5가 자동으로 끝났을 때만.
 * - S3: 테이블에서 쌈장을 못 봤으면 건너뜀, 대두·밀 회피(또는 회피 목록 미확인)면 권하지 않고 주의 표시·누락 안내 없음.
 * - 실수 안내 2종(고기 없이 쌈 · 쌈장 없이 쌈). "너무 큰 쌈" 판정은 없다(P-635 예진 11/9) — 크기 당부는 S4 문구에.
 */

export const HOLD_MS = 500;
/** P-641: "고기 없이 쌈" 안내만 더 길게 — 손 위 임계값 0.20의 9 오탐으로 깜빡이지 않게 */
export const NO_MEAT_HOLD_MS = 1000;

export const STEPS = ['leaf', 'meat', 'ssamjang', 'wrap', 'eat'] as const;
export type StepId = (typeof STEPS)[number];
/** todo 대기 · auto 자동 인식 · manual 수동 넘김 · skipped 쌈장 미발견 · avoid 회피라 권하지 않음 · missed 쌈장 없이 쌈 */
export type Mark = 'todo' | 'auto' | 'manual' | 'skipped' | 'avoid' | 'missed';
export type Tip = 'noMeat' | 'noSsamjang';

export type Signals = {
  leafOnHand: boolean;
  toppedLeaf: boolean;
  ssamjangOnLeaf: boolean;
  wrapped: boolean;
  gone: boolean;
  manualNext: boolean;
};
type HeldKey = Exclude<keyof Signals, 'manualNext'>;
export const NO_SIGNALS: Signals = { leafOnHand: false, toppedLeaf: false, ssamjangOnLeaf: false, wrapped: false, gone: false, manualNext: false };

export type CoachState = {
  /** 0~4 = STEPS 위치, 5 = 완료 */
  idx: number;
  marks: Record<StepId, Mark>;
  enteredAt: number;
  since: Partial<Record<HeldKey, number>>;
  tip: Tip | null;
  ssamjangTipUsed: boolean;
};

export function createCoach(opts: { sawSsamjang: boolean; avoidSsamjang: boolean }, now: number): CoachState {
  const s3: Mark = opts.avoidSsamjang ? 'avoid' : opts.sawSsamjang ? 'todo' : 'skipped';
  return {
    idx: 0,
    marks: { leaf: 'todo', meat: 'todo', ssamjang: s3, wrap: 'todo', eat: 'todo' },
    enteredAt: now,
    since: {},
    tip: null,
    ssamjangTipUsed: false,
  };
}

export const isDone = (s: CoachState) => s.idx >= STEPS.length;
export const currentStep = (s: CoachState): StepId | null => STEPS[s.idx] ?? null;
/** 완료 문구: S5가 자동 인식으로 끝났을 때만 칭찬 */
export const finishedByAuto = (s: CoachState) => isDone(s) && s.marks.eat === 'auto';

/** 다음 todo 단계로(skipped·avoid는 건너뜀). */
function advance(s: CoachState, mark: Mark, now: number): CoachState {
  const marks = { ...s.marks, [STEPS[s.idx]!]: mark };
  let idx = s.idx + 1;
  while (idx < STEPS.length && marks[STEPS[idx]!] !== 'todo') idx++;
  return { ...s, marks, idx, enteredAt: now, tip: null };
}

const AUTO: Record<StepId, HeldKey[]> = {
  leaf: ['leafOnHand', 'toppedLeaf'],
  meat: ['toppedLeaf'],
  ssamjang: ['ssamjangOnLeaf'],
  wrap: ['wrapped'],
  eat: ['gone'],
};

export function step(prev: CoachState, sig: Signals, now: number, holdMs = HOLD_MS): CoachState {
  if (isDone(prev)) return prev;
  const since = { ...prev.since };
  for (const k of Object.keys(since) as HeldKey[]) if (!sig[k]) delete since[k];
  for (const k of ['leafOnHand', 'toppedLeaf', 'ssamjangOnLeaf', 'wrapped', 'gone'] as HeldKey[]) if (sig[k]) since[k] ??= now;
  const s = { ...prev, since };
  const held = (k: HeldKey, ms = holdMs) => since[k] != null && now - Math.max(since[k]!, s.enteredAt) >= ms;

  if (sig.manualNext) return advance(s, 'manual', now);

  const cur = STEPS[s.idx]!;
  if (AUTO[cur].some((k) => held(k))) return advance(s, 'auto', now);

  // 실수 안내(전환 없음, 단 쌈장 누락은 S3를 missed로 넘기고 S4 인식까지 처리)
  if ((cur === 'leaf' || cur === 'meat') && held('wrapped', NO_MEAT_HOLD_MS)) return { ...s, tip: 'noMeat' };
  if (cur === 'ssamjang' && held('wrapped')) {
    const tip: Tip | null = s.ssamjangTipUsed ? null : 'noSsamjang';
    const missed = advance(s, 'missed', now); // → wrap
    return { ...advance(missed, 'auto', now), tip, ssamjangTipUsed: true }; // wrap 인식 = auto → eat
  }
  return s;
}

/**
 * 모델 v1 클래스 → 신호. 7 leaf_on_hand, 8 topped_leaf, 9 wrapped_ssam. 나머지 신호는 신호원 없음 = false.
 * P-640: 임계값 0.20에서 단계 구분이 47%라 잎은 묶어 쓴다 — 잎 = 7·8·9 중 아무거나, 싸기 = 9 단독.
 * P-641: 고기 = 8만. 9를 고기에 넣으면 S2에서 "고기 없이 쌈" 안내가 모델 신호로 안 나온다(시연 장면).
 */
export function signalsFromClasses(classes: ReadonlySet<number>): Signals {
  return { ...NO_SIGNALS, leafOnHand: classes.has(7) || classes.has(8) || classes.has(9), toppedLeaf: classes.has(8), wrapped: classes.has(9) };
}
