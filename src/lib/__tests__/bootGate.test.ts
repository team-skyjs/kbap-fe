/**
 * P-018(KB-194): 스플래시 게이트 타이밍 규칙을 잠근다.
 * min(1200) 전엔 절대 hide 없음 / min~cap 사이 settle→즉시 / cap(4000) 초과→강제 /
 * 프리페치 reject→지연 없음 (오프라인이 스플래시를 붙잡지 않는다).
 */
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', changeLanguage: jest.fn() } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ resolveInitialLang: jest.fn() }));
jest.mock('@/lib/data/useHome', () => ({ fetchHome: jest.fn() }));
jest.mock('@/lib/data/useFoods', () => ({ fetchFoodsPage: jest.fn() }));
jest.mock('@/lib/data/useMe', () => ({ fetchMe: jest.fn() }));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { prefetchQuery: jest.fn(), prefetchInfiniteQuery: jest.fn() } }));

import { gateSplash } from '../bootGate';

jest.useFakeTimers();

const flush = () => Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());

function track(p: Promise<void>) {
  const state = { done: false };
  void p.then(() => { state.done = true; });
  return state;
}

it('조기 완료 → min(1200)까지 대기 후 hide', async () => {
  const s = track(gateSplash({ ready: Promise.resolve(), prefetch: Promise.resolve() }));
  await flush();
  jest.advanceTimersByTime(1199);
  await flush();
  expect(s.done).toBe(false); // min 전엔 절대 hide 없음
  jest.advanceTimersByTime(1);
  await flush();
  expect(s.done).toBe(true);
});

it('min~cap 사이 완료 → settle 직후 hide', async () => {
  let settle!: () => void;
  const pending = new Promise<void>((r) => (settle = r));
  const s = track(gateSplash({ ready: Promise.resolve(), prefetch: pending }));
  jest.advanceTimersByTime(2000); // min 지남, settle 전
  await flush();
  expect(s.done).toBe(false);
  settle();
  await flush();
  expect(s.done).toBe(true); // 추가 타이머 없이 즉시
});

it('cap(4000) 초과 → 프리페치 대기 중단하고 강제 hide', async () => {
  const never = new Promise<void>(() => {});
  const s = track(gateSplash({ ready: Promise.resolve(), prefetch: never }));
  jest.advanceTimersByTime(3999);
  await flush();
  expect(s.done).toBe(false);
  jest.advanceTimersByTime(1);
  await flush();
  expect(s.done).toBe(true);
});

it('프리페치 reject → hide 지연 없음 (min에 정확히 hide)', async () => {
  const s = track(gateSplash({ ready: Promise.resolve(), prefetch: Promise.reject(new Error('offline')) }));
  await flush();
  jest.advanceTimersByTime(1200);
  await flush();
  expect(s.done).toBe(true);
});
