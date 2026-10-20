/**
 * KB-785: GET /home 만 X-API-Version 1.2 — 실제 client를 통과시켜 fetch 헤더로 잠근다.
 * 다른 엔드포인트(/foods·/members/me/profile)는 전역 기본(1.1) 유지. 부트 프리페치는
 * 같은 fetchHome을 queryFn으로 쓰므로 소스 잠금 1줄. 1.2 = popularFoods 소스만 변경(조회 수 →
 * 운영 풀 food_marketing_popular 무작위 ≤10, dev Swagger /home 설명) — 응답 형태 1.1과 동일,
 * 구 응답(mostReviewedFoods 부재) 호환 유지.
 */
process.env.EXPO_PUBLIC_BE_BASE = 'https://dev.kbap.site';

jest.mock('@/lib/installationId', () => ({ getInstallationId: () => Promise.resolve('test-install-id') }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.1' } } }));
jest.mock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => false }));

const envelope = (payload: unknown) => () =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ success: true, payload, message: null })),
  } as unknown as Response);

type Call = [string, { headers: Record<string, string> }];

const legacyHome = { authenticated: true, avoidedSubstances: [{ code: 'EGG', name: 'Egg' }], popularFoods: [], recentScans: [] }; // 구 서버: mostReviewedFoods 부재

/* eslint-disable @typescript-eslint/no-require-imports */
const { fetchHome } = require('../useHome') as typeof import('../useHome');
const { api } = require('@/lib/api/client') as typeof import('@/lib/api/client');
/* eslint-enable @typescript-eslint/no-require-imports */

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn(envelope(legacyHome));
  global.fetch = fetchMock as unknown as typeof fetch;
});

it('GET /home 요청 헤더 X-API-Version = 1.3(KB-800 — 1.2 동작 포함) (lang 파라미터 유지) + 구 응답(mostReviewedFoods 부재) 호환', async () => {
  const res = await fetchHome();
  const [url, init] = fetchMock.mock.calls[0] as Call;
  expect(url).toBe('https://dev.kbap.site/api/home?lang=en');
  expect(init.headers['X-API-Version']).toBe('1.3');
  expect(init.headers['X-App-Version']).toBe('1.0.1'); // 병합 — 기본 헤더 3종 유실 0
  expect(res.avoided).toEqual([{ code: 'EGG', name: 'Egg' }]);
  expect(res.mostReviewed).toEqual([]);
  expect(res.topRated).toEqual([]); // KB-800: 구 서버 topRatedFoods 부재 = 빈 배열
});

it('다른 엔드포인트는 전역 기본(1.1) 그대로 — /foods GET · /members/me/profile PATCH', async () => {
  await api.get('/foods');
  await api.patch('/members/me/profile', { nickname: 'x' });
  for (const [, init] of fetchMock.mock.calls as Call[]) expect(init.headers['X-API-Version']).toBe('1.1');
});

it('소스 잠금 — 부트 프리페치가 fetchHome을 queryFn으로 공유(헤더 지정 1곳) · 전역 기본 무변', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  expect(fs.readFileSync('src/lib/bootGate.ts', 'utf8')).toContain('queryFn: fetchHome');
  expect(fs.readFileSync('src/lib/api/client.ts', 'utf8')).toContain("const API_VERSION_HEADER = '1.1'");
});
