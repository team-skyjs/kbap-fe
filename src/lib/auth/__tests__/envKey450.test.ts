/**
 * P-322(KB-450) v2 — 저장 세션 단일 레코드(kbap.auth.session.v2, env 동승).
 * dev 토큰이 prod 빌드에 실리는 재사용 차단: 부팅 최초 로드에서 발급 환경 ≠ 현재
 * BE_BASE(레코드 부재·파손 포함)면 조용히 폐기 → 게스트 시작(refresh 미발신).
 * 단일 키 JSON 쓰기 = 원자(Codex #86 2R — 부분 저장/혼합 마커 구조적 불가).
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
const S = 'kbap.auth.session.v2';
const V1A = 'kbap.auth.access.v1';
const V1R = 'kbap.auth.refresh.v1';
const seed = (access: string, refresh: string, env: string = HOST) =>
  mockStore.set(S, JSON.stringify({ access, refresh, env }));

beforeEach(() => {
  jest.resetModules();
  mockStore.clear();
});

/* eslint-disable @typescript-eslint/no-require-imports */
const tokens = () => require('../beTokens') as typeof import('../beTokens');
const flush = () => new Promise((r) => setTimeout(r, 0));

it('환경 일치 = 세션 유지(현행)', async () => {
  seed('a', 'r');
  expect(await tokens().loadTokens()).toEqual({ access: 'a', refresh: 'r' });
});

it('환경 불일치 = 조용히 폐기 — 게스트 시작 + 레코드 삭제(체인 경유)', async () => {
  seed('dev-a', 'dev-r', 'https://dev.kbap.site');
  const t = tokens();
  expect(await t.loadTokens()).toBeNull();
  await flush(); // serialized 체인 소진
  expect(mockStore.has(S)).toBe(false);
  // 재로드도 게스트 유지(캐시 null 고정 — refresh 발신 경로 자체 없음)
  expect(await t.loadTokens()).toBeNull();
});

it('레코드 파손(JSON 아님) = 게스트(부활 금지)', async () => {
  mockStore.set(S, 'not-json');
  expect(await tokens().loadTokens()).toBeNull();
});

it('구 v1 키 잔존(기존 저장분) = 읽지 않고 삭제, 게스트 시작', async () => {
  mockStore.set(V1A, 'old-a');
  mockStore.set(V1R, 'old-r');
  const t = tokens();
  expect(await t.loadTokens()).toBeNull(); // v2 부재 = 게스트(1회 로그아웃)
  await flush();
  expect(mockStore.has(V1A)).toBe(false);
  expect(mockStore.has(V1R)).toBe(false);
});

it('saveTokens = 단일 레코드 1회 쓰기(env 동승) · clearTokens = v2+v1 전부 삭제', async () => {
  const t = tokens();
  expect(await t.saveTokens('a', 'r')).toBe(true);
  expect(JSON.parse(mockStore.get(S)!)).toEqual({ access: 'a', refresh: 'r', env: HOST });
  expect(mockStore.has(V1A)).toBe(false); // v1 신규 기록 0
  mockStore.set(V1A, 'stray');
  await t.clearTokens();
  expect(mockStore.has(S)).toBe(false);
  expect(mockStore.has(V1A)).toBe(false);
});

it('세대 경계 개입 시 자가 되돌림(KB-421 유지) — 레코드 폐기, 커밋 false', async () => {
  const t = tokens();
  const p = t.saveTokens('a1', 'r1');
  t.bumpSessionGen();
  expect(await p).toBe(false);
  expect(await t.loadTokens()).toBeNull();
  expect(mockStore.has(S)).toBe(false);
});

it('저장소 부재(전체 쓰기 실패) = 메모리 온리 현행 유지(true) — web/jest', async () => {
  const SS = require('expo-secure-store') as { setItemAsync: unknown };
  const realSet = SS.setItemAsync as (k: string, v: string) => Promise<void>;
  (SS as { setItemAsync: () => Promise<void> }).setItemAsync = () => Promise.reject(new Error('no store'));
  const t = tokens();
  expect(await t.saveTokens('a', 'r')).toBe(true);
  expect(await t.loadTokens()).toEqual({ access: 'a', refresh: 'r' });
  (SS as { setItemAsync: typeof realSet }).setItemAsync = realSet;
});
