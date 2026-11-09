import { readFileSync } from 'fs';
import { NO_SIGNALS, STEPS, createCoach, currentStep, finishedByAuto, isDone, signalsFromClasses, step, type CoachState, type Signals } from '../wrapCoach';

const S = (p: Partial<Signals> = {}): Signals => ({ ...NO_SIGNALS, ...p });
const base = (o: Partial<{ sawSsamjang: boolean; avoidSsamjang: boolean }> = {}) =>
  createCoach({ sawSsamjang: true, avoidSsamjang: false, ...o }, 0);
/** t0부터 dt 간격으로 같은 신호를 n틱 */
function run(s: CoachState, sig: Signals, t0: number, n: number, dt = 100): CoachState {
  for (let i = 0; i < n; i++) s = step(s, sig, t0 + i * dt);
  return s;
}

describe('KB-1019 쌈 코칭 상태 머신', () => {
  it('신호 0.5초 유지해야 전환(0.4초는 안 됨), 끊기면 처음부터', () => {
    let s = run(base(), S({ leafOnHand: true }), 0, 5); // 0~400
    expect(currentStep(s)).toBe('leaf');
    s = step(s, S(), 450);
    s = run(s, S({ leafOnHand: true }), 500, 5); // 500~900 → 400ms
    expect(currentStep(s)).toBe('leaf');
    s = step(s, S({ leafOnHand: true }), 1000);
    expect(currentStep(s)).toBe('meat');
    expect(s.marks.leaf).toBe('auto');
  });

  it('P-640 현행 동작 잠금: 9만 계속 = 단계마다 0.5초씩 S1→S2→(쌈장 누락 안내)→S5, 고기 누락 안내는 모델 신호로 안 나옴', () => {
    const nine = signalsFromClasses(new Set([9]));
    let s = run(base(), nine, 0, 6); // 500
    expect(currentStep(s)).toBe('meat');
    expect(s.tip).toBeNull();
    s = run(s, nine, 600, 5); // 1000
    expect(currentStep(s)).toBe('ssamjang');
    s = run(s, nine, 1100, 5); // 1500
    expect(currentStep(s)).toBe('eat');
    expect(s.tip).toBe('noSsamjang');
    expect(s.marks).toMatchObject({ leaf: 'auto', meat: 'auto', ssamjang: 'missed', wrap: 'auto' });
  });

  it('S1 = leaf_on_hand 또는 topped_leaf, 한 틱에 연쇄 없음(S2는 진입 뒤 다시 0.5초)', () => {
    let s = run(base(), S({ toppedLeaf: true }), 0, 6); // 500에 S1 완료
    expect(currentStep(s)).toBe('meat');
    s = run(s, S({ toppedLeaf: true }), 600, 4); // 진입 500 기준 400ms
    expect(currentStep(s)).toBe('meat');
    s = step(s, S({ toppedLeaf: true }), 1000);
    expect(currentStep(s)).toBe('ssamjang');
  });

  it('전체 자동 경로 → 완료, S5 자동이면 칭찬', () => {
    let s = base();
    s = run(s, S({ leafOnHand: true }), 0, 6);
    s = run(s, S({ toppedLeaf: true }), 600, 6);
    s = run(s, S({ ssamjangOnLeaf: true }), 1200, 6);
    s = run(s, S({ wrapped: true }), 1800, 6);
    expect(currentStep(s)).toBe('eat');
    s = run(s, S({ gone: true }), 2400, 6);
    expect(isDone(s)).toBe(true);
    expect(finishedByAuto(s)).toBe(true);
    expect(Object.values(s.marks)).toEqual(['auto', 'auto', 'auto', 'auto', 'auto']);
  });

  it('Next = 즉시 넘김(manual), 수동으로 끝나면 칭찬 없음', () => {
    let s = base();
    for (let i = 0; i < 5; i++) s = step(s, S({ manualNext: true }), i * 10);
    expect(isDone(s)).toBe(true);
    expect(Object.values(s.marks)).toEqual(['manual', 'manual', 'manual', 'manual', 'manual']);
    expect(finishedByAuto(s)).toBe(false);
    expect(step(s, S({ manualNext: true }), 100)).toBe(s); // 완료 뒤 무변
  });

  it('고기 없이 쌈 → "noMeat" 안내, 단계 유지', () => {
    let s = run(base(), S({ wrapped: true }), 0, 6);
    expect(s.tip).toBe('noMeat');
    expect(currentStep(s)).toBe('leaf');
  });

  it('쌈장 없이 쌈 → 안내 한 번, S3 missed, S4 인식', () => {
    let s = base();
    s = step(s, S({ manualNext: true }), 0);
    s = step(s, S({ manualNext: true }), 10); // → ssamjang
    s = run(s, S({ wrapped: true }), 100, 6);
    expect(s.tip).toBe('noSsamjang');
    expect(s.marks).toMatchObject({ ssamjang: 'missed', wrap: 'auto' });
    expect(currentStep(s)).toBe('eat');
    // 같은 세션에서 다시 오면 안내 없음
    const again = { ...s, idx: STEPS.indexOf('ssamjang'), marks: { ...s.marks, ssamjang: 'todo' as const }, enteredAt: 2000, since: {} };
    expect(run(again, S({ wrapped: true }), 2000, 6).tip).toBeNull();
  });

  it('테이블에서 쌈장 못 봄 = S3 건너뜀', () => {
    let s = base({ sawSsamjang: false });
    expect(s.marks.ssamjang).toBe('skipped');
    s = step(step(s, S({ manualNext: true }), 0), S({ manualNext: true }), 10);
    expect(currentStep(s)).toBe('wrap');
  });

  it('대두·밀 회피 = S3 권하지 않음(avoid), 쌈장 누락 안내 없음', () => {
    let s = base({ avoidSsamjang: true });
    expect(s.marks.ssamjang).toBe('avoid');
    s = step(step(s, S({ manualNext: true }), 0), S({ manualNext: true }), 10);
    expect(currentStep(s)).toBe('wrap');
    s = run(s, S({ wrapped: true }), 100, 6);
    expect(s.tip).toBeNull();
    expect(currentStep(s)).toBe('eat');
  });

  it('P-635: 너무 큰 쌈 판정 없음 — 신호 자리도 없음, S4 문구에 크기 당부', () => {
    expect(Object.keys(NO_SIGNALS)).not.toContain('tooBig');
    expect(Object.keys(NO_SIGNALS).sort()).toEqual(['gone', 'leafOnHand', 'manualNext', 'ssamjangOnLeaf', 'toppedLeaf', 'wrapped']);
  });

  it('P-640 신호 매핑: 잎 = 7·8·9 아무거나, 고기 = 8 또는 9, 싸기 = 9 단독, 빈 자리는 false', () => {
    expect(signalsFromClasses(new Set([0, 4, 7, 8, 9]))).toEqual(S({ leafOnHand: true, toppedLeaf: true, wrapped: true }));
    expect(signalsFromClasses(new Set([7]))).toEqual(S({ leafOnHand: true })); // 7만 = S2로 넘기지 않음
    expect(signalsFromClasses(new Set([8]))).toEqual(S({ leafOnHand: true, toppedLeaf: true }));
    expect(signalsFromClasses(new Set([9]))).toEqual(S({ leafOnHand: true, toppedLeaf: true, wrapped: true }));
    expect(signalsFromClasses(new Set([4]))).toEqual(S());
    expect(signalsFromClasses(new Set([0, 1, 2, 3, 4, 5, 6]))).toEqual(S()); // 테이블 7종은 신호 없음
  });

  it('P-640: 7만 계속 잡히면 S1만 넘고 S2에서 멈춤', () => {
    const s = run(base(), signalsFromClasses(new Set([7])), 0, 20);
    expect(currentStep(s)).toBe('meat');
    expect(s.marks.leaf).toBe('auto');
  });

  it('기획안 문구 그대로(en)', () => {
    const en = JSON.parse(readFileSync('src/lib/i18n/en.json', 'utf8')).bbqWrap;
    expect(en.tip).toEqual({
      noMeat: 'Add meat before you wrap',
      noSsamjang: 'Try a little ssamjang next time',
    });
    expect(en.step).toMatchObject({ leaf: 'Lay a leaf on your palm', wrap: 'Fold it into a bundle you can eat in one bite', eat: 'Eat it in one bite. Do not bite it in half.' });
    expect(en.niceWrap).toBe('Nice wrap');
    expect(en.prop).toBe('Prop your phone and face the camera');
    expect(JSON.stringify(en)).not.toContain('·');
  });
});
