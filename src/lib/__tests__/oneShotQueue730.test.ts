/** KB-730 — 화면 일회성 모달 큐: 순서대로 하나씩, present=false는 건너뜀, 닫힌 뒤(done) 다음, throw = 건너뜀, clear = 대기 폐기. */
import { createOneShotQueue, type QueueStep } from '@/lib/oneShotQueue';

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
