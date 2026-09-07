/**
 * P-322(KB-450) — 저장 세션 API 환경 키(kbap.auth.env.v1).
 * dev 토큰이 prod 빌드에 실리는 재사용 차단: 부팅 최초 로드에서 발급 환경 ≠ 현재
 * BE_BASE(키 없음 = 기존 저장분 포함)면 3종 조용히 폐기 → 게스트 시작(refresh 미발신).
 */
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: (k: string) => Promise.resolve(mockStore.get(k) ?? null),
  setItemAsync: (k: string, v: string) => {
    mockStore.set(k, v);
    return Promise.resolve();
  },
  deleteItemAsync: (k: string) => {
    mockStore.delete(k);
    return Promise.resolve();
  },
}));

const HOST = 'https://prod.kbap.site'; // 테스트 env: EXPO_PUBLIC_BE_BASE 부재 → config 기본값
const A = 'kbap.auth.access.v1';
const R = 'kbap.auth.refresh.v1';
const E = 'kbap.auth.env.v1';

beforeEach(() => {
  jest.resetModules();
  mockStore.clear();
});

/* eslint-disable @typescript-eslint/no-require-imports */
const tokens = () => require('../beTokens') as typeof import('../beTokens');
const flush = () => new Promise((r) => setTimeout(r, 0));

it('환경 일치 = 세션 유지(현행)', async () => {
  mockStore.set(A, 'a');
  mockStore.set(R, 'r');
  mockStore.set(E, HOST);
  expect(await tokens().loadTokens()).toEqual({ access: 'a', refresh: 'r' });
});

it('환경 불일치 = 조용히 폐기 — 게스트 시작 + 저장소 3종 삭제(체인 경유)', async () => {
  mockStore.set(A, 'dev-a');
  mockStore.set(R, 'dev-r');
  mockStore.set(E, 'https://dev.kbap.site');
  const t = tokens();
  expect(await t.loadTokens()).toBeNull();
  await flush(); // serialized 체인 소진
  expect(mockStore.has(A)).toBe(false);
  expect(mockStore.has(R)).toBe(false);
  expect(mockStore.has(E)).toBe(false);
  // 재로드도 게스트 유지(캐시 null 고정 — refresh 발신 경로 자체 없음)
  expect(await t.loadTokens()).toBeNull();
});

it('키 없음(기존 저장분) = 동일 폐기', async () => {
  mockStore.set(A, 'old-a');
  mockStore.set(R, 'old-r');
  const t = tokens();
  expect(await t.loadTokens()).toBeNull();
  await flush();
  expect(mockStore.has(A)).toBe(false);
});

it('saveTokens = 3종 동시 저장(환경 동승) · clearTokens = 3종 삭제', async () => {
  const t = tokens();
  expect(await t.saveTokens('a', 'r')).toBe(true);
  expect(mockStore.get(A)).toBe('a');
  expect(mockStore.get(E)).toBe(HOST);
  await t.clearTokens();
  expect(mockStore.has(A)).toBe(false);
  expect(mockStore.has(E)).toBe(false);
});

it('세대 경계 개입 시 자가 되돌림(KB-421 유지) — 토큰 폐기, 커밋 false', async () => {
  const t = tokens();
  // 쓰기 도중 경계: setItem은 동기 mock이라 체인 진입 전 bump로 재현
  const p = t.saveTokens('a1', 'r1');
  t.bumpSessionGen();
  expect(await p).toBe(false);
  expect(await t.loadTokens()).toBeNull();
});
