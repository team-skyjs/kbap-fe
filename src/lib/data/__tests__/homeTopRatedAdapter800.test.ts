/**
 * KB-800: 홈 1.3 `topRatedFoods` → HomeResponse.topRated. 실제 client 를 통과시켜 헤더·래퍼(payload)까지 잠근다.
 * 계약 C-01(01_cto_plan.md) JSON 예시 그대로 — 부재/null = [], 세부 평점 null 유지(0 으로 바꾸면 화면이 "0.0" 을 그린다).
 */
process.env.EXPO_PUBLIC_BE_BASE = 'https://dev.kbap.site';

jest.mock('@/lib/installationId', () => ({ getInstallationId: () => Promise.resolve('test-install-id') }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.1' } } }));
jest.mock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => false }));

/* eslint-disable @typescript-eslint/no-require-imports */
const { fetchHome } = require('../useHome') as typeof import('../useHome');
const { adaptMenuSummary } = require('@/lib/api/foodAdapter') as typeof import('@/lib/api/foodAdapter');
/* eslint-enable @typescript-eslint/no-require-imports */

const respond = (payload: unknown) => {
  const m = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ success: true, payload, message: null, code: null })) } as unknown as Response),
  );
  global.fetch = m as unknown as typeof fetch;
  return m;
};

const base = { authenticated: true, avoidedSubstances: [], popularFoods: [], mostReviewedFoods: [], recentScans: [] };
const stew = {
  foodId: 205, name: 'Kimchi Stew', koreanName: '김치찌개', imageRef: 'https://img.kbap.app/foods/205.jpg', spiciness: 6,
  overallRiskStatus: 'SAFE', publishedAt: '2026-08-20T09:30:00Z', bookmarked: true, review: { averageRating: 4.7, count: 23 },
  taste: 4.7, servingSpeed: 4.4, staffKindness: 4.6, overallRating: 4.6,
};
const japchae = {
  foodId: 412, name: 'Japchae', koreanName: '잡채', imageRef: 'https://img.kbap.app/foods/412.jpg', spiciness: 0,
  overallRiskStatus: 'UNKNOWN', publishedAt: '2026-09-12T00:00:00Z', bookmarked: false, review: { averageRating: 4.0, count: 3 },
  taste: 4.0, servingSpeed: null, staffKindness: null, overallRating: 4.0,
};

it('X-API-Version 1.3 전송 + 계약 예시 2건을 순서대로 어댑트(요약 필드 = adaptMenuSummary 와 동일)', async () => {
  const m = respond({ ...base, topRatedFoods: [stew, japchae] });
  const res = await fetchHome();
  expect((m.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers['X-API-Version']).toBe('1.3');
  expect(res.topRated.map((f) => f.foodId)).toEqual(['205', '412']);
  expect(res.topRated[0]).toEqual({
    ...adaptMenuSummary(stew as never),
    taste: 4.7, servingSpeed: 4.4, staffKindness: 4.6, overallRating: 4.6,
  });
  expect(res.topRated[0].overall).toEqual({ average: 4.7, count: 23 });
});

it('세부 평점 null 은 null 그대로(0 아님)', async () => {
  respond({ ...base, topRatedFoods: [japchae] });
  const [f] = (await fetchHome()).topRated;
  expect(f.servingSpeed).toBeNull();
  expect(f.staffKindness).toBeNull();
  expect(f.taste).toBe(4.0);
});

it('필드 부재(1.2 서버)·null·세부 키 부재 → 빈 배열 / null', async () => {
  respond(base);
  expect((await fetchHome()).topRated).toEqual([]);
  respond({ ...base, topRatedFoods: null });
  expect((await fetchHome()).topRated).toEqual([]);
  const { taste: _t, servingSpeed: _s, staffKindness: _k, overallRating: _o, ...bare } = stew;
  respond({ ...base, topRatedFoods: [bare] });
  expect((await fetchHome()).topRated[0]).toMatchObject({ taste: null, servingSpeed: null, staffKindness: null, overallRating: null });
});
