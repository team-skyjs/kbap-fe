/** KB-730 — 화면 일회성 모달 큐: 순서대로 하나씩, present=false는 건너뜀, 닫힌 뒤(done) 다음, throw = 건너뜀, clear = 대기 폐기. */
import { createOneShotQueue, waitStep, type QueueStep } from '@/lib/oneShotQueue';

const tick = () => new Promise((r) => setTimeout(r, 0));

it('뜬 모달이 완전히 닫히기(done) 전엔 다음 스텝을 시작하지 않는다 · 안 뜨는 스텝은 즉시 다음', async () => {
  const q = createOneShotQueue();
  const log: string[] = [];
  let doneA!: () => void;
  const a: QueueStep = { key: 'a', present: (done) => { log.push('a'); doneA = done; return true; } };
  const skip: QueueStep = { key: 'skip', present: () => { log.push('skip'); return false; } };
  const c: QueueStep = { key: 'c', present: async () => { log.push('c'); return false; } };
  q.add(a); q.add(skip); q.add(c);
  await tick();
  expect(log).toEqual(['a']); // a가 열려 있는 동안 skip·c 미시작
  doneA(); doneA(); // 두 번 불러도 한 번
  await tick(); await tick();
  expect(log).toEqual(['a', 'skip', 'c']);
  expect(q.size()).toBe(0);
});

it('present가 throw하면 건너뛰고 다음 · clear는 대기 스텝만 버린다', async () => {
  const q = createOneShotQueue();
  const log: string[] = [];
  let doneA!: () => void;
  q.add({ key: 'a', present: (done) => { doneA = done; return true; } });
  q.add({ key: 'boom', present: () => { throw new Error('x'); } });
  q.add({ key: 'b', present: () => { log.push('b'); return false; } });
  await tick();
  q.clear(); // boom·b 폐기, a는 진행 중
  doneA();
  await tick(); await tick();
  expect(log).toEqual([]);
  q.add({ key: 'boom2', present: () => { throw new Error('x'); } });
  q.add({ key: 'c', present: () => { log.push('c'); return false; } });
  await tick(); await tick();
  expect(log).toEqual(['c']);
});

/* ---- KB-733 /review 3·2: clear는 판정 전 대기 중인 스텝에 abort · waitStep = 약속/취소/상한 중 먼저 ---- */

it('clear() = 판정 전 대기 중인 스텝에 abort(signal) → 스텝이 false로 끝나 큐가 running에 고정되지 않는다 · 이미 띄운 모달은 그대로', async () => {
  const q = createOneShotQueue();
  const log: string[] = [];
  const never = new Promise<void>(() => {});
  q.add({ key: 'wait', present: async (_done, signal) => { const r = await waitStep(never, signal, 60_000); log.push(`wait:${r.ok ? 'ok' : r.reason}`); return false; } });
  await tick();
  expect(log).toEqual([]);
  q.clear();
  await tick();
  expect(log).toEqual(['wait:aborted']);
  q.add({ key: 'next', present: () => { log.push('next'); return false; } }); // 큐가 살아 있다
  await tick();
  expect(log).toEqual(['wait:aborted', 'next']);

  let doneA!: () => void; let abortedA = false;
  q.add({ key: 'a', present: (done, signal) => { doneA = done; signal.addEventListener('abort', () => { abortedA = true; }); return true; } });
  await tick();
  q.clear(); // a는 present가 끝났다(모달 열림) — abort 없음
  expect(abortedA).toBe(false);
  doneA();
  await tick();
});

it('waitStep: 약속 → ok · 상한 → timeout · 이미 abort된 signal → aborted 즉시 · 약속 거부 → error', async () => {
  jest.useFakeTimers();
  try {
    const ac = new AbortController();
    const p = waitStep(Promise.resolve(7), ac.signal, 1000);
    await Promise.resolve(); await Promise.resolve();
    await expect(p).resolves.toEqual({ ok: true, value: 7 });
    const t = waitStep(new Promise<void>(() => {}), ac.signal, 1000);
    jest.advanceTimersByTime(1000);
    await expect(t).resolves.toEqual({ ok: false, reason: 'timeout' });
    ac.abort();
    await expect(waitStep(Promise.resolve(1), ac.signal, 1000)).resolves.toEqual({ ok: false, reason: 'aborted' });
    await expect(waitStep(Promise.reject(new Error('x')), new AbortController().signal, 1000)).resolves.toEqual({ ok: false, reason: 'error' });
  } finally {
    jest.useRealTimers();
  }
});
