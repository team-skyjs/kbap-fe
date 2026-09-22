/**
 * KB-631(Codex P1) — 스플래시 종료 신호: markSplashDone 전엔 대기, 후엔 즉시 resolve · 신호 없으면 캡+1초 폴백.
 */
import { SPLASH_CAP_MS, _resetSplashDoneForTest, markSplashDone, whenSplashDone } from '@/lib/bootGate';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', changeLanguage: jest.fn() } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ resolveInitialLang: jest.fn() }));
jest.mock('@/lib/data/useHome', () => ({ fetchHome: jest.fn() }));
jest.mock('@/lib/data/useFoods', () => ({ fetchFoodsPage: jest.fn() }));
jest.mock('@/lib/data/useMe', () => ({ fetchMe: jest.fn() }));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { prefetchQuery: jest.fn(), prefetchInfiniteQuery: jest.fn() } }));

beforeEach(() => _resetSplashDoneForTest());
const never = () => new Promise<void>(() => {});

it('markSplashDone 전 = pending, 후 = resolve (순서 무관 — 먼저 mark돼도 resolve)', async () => {
  let done = false;
  const p = whenSplashDone(never).then(() => { done = true; });
  await Promise.resolve();
  expect(done).toBe(false);
  markSplashDone();
  await p;
  expect(done).toBe(true);
  _resetSplashDoneForTest();
  markSplashDone(); // 로그인 화면보다 스플래시가 먼저 끝난 경우
  await expect(whenSplashDone(never)).resolves.toBeUndefined();
});

it('신호가 없으면 캡+1초 폴백으로 resolve (오버레이 없는 환경 — 팝업 영구 미노출 방지)', async () => {
  const delays: number[] = [];
  await expect(whenSplashDone((ms) => { delays.push(ms); return Promise.resolve(); })).resolves.toBeUndefined();
  expect(delays).toEqual([SPLASH_CAP_MS + 1000]);
});
