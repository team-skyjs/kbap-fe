/**
 * KB-421(P-205): 부트 토큰 레이스 — 재설치 후 이전 계정(mina) 부활 사고.
 *
 * 시퀀스(실기 9/5): 모듈 스코프 installBeAuth의 loadTokens()가 Keychain 읽기
 * **시작** → freshInstall cleanup이 clearTokens() → 늦게 resolve한 읽기가
 * 삭제 전 값으로 cached를 **재대입**(부활) + 세션 스토어 true 고착(cleanup이
 * setSessionState 경계 미경유). 이 스위트가 그 레이스를 재현·봉쇄한다.
 */
import AsyncStorageMock from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// SecureStore — resolve 시점을 테스트가 쥔다(지연 읽기 재현)
const mockStore = new Map<string, string>();
let mockPendingReads: Array<() => void> = [];
let mockDelayReads = false;
jest.mock('expo-secure-store', () => ({
  getItemAsync: (k: string) =>
    new Promise<string | null>((resolve) => {
      const fire = () => resolve(mockStore.get(k) ?? null); // ⚠️ resolve 시점의 mockStore가 아니라
      // 읽기 "시작" 시점 값을 캡처해야 실기와 같다 — Keychain은 호출 시점에 읽는다.
      const captured = mockStore.get(k) ?? null;
      const fireCaptured = () => resolve(captured);
      void fire; // (미사용 — 캡처 방식 사용)
      if (mockDelayReads) mockPendingReads.push(fireCaptured);
      else fireCaptured();
    }),
  setItemAsync: (k: string, v: string) => {
    mockStore.set(k, v);
    return Promise.resolve();
  },
  deleteItemAsync: (k: string) => {
    mockStore.delete(k);
    return Promise.resolve();
  },
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
const mockLogOut = jest.fn(async () => {});
jest.mock('../session', () => ({ currentUser: () => null, logOut: mockLogOut }));
// beAuth(logoutLocalFirst) 케이스용 — 서버 logout은 영원히 pending: 로컬 경계가
// 네트워크를 기다리지 않음을 그 자체로 실측
const mockPost = jest.fn(() => new Promise(() => {}));
const mockSetOnUnauthorized = jest.fn(); // 401 핸들러 캡처 — refresh 흐름 구동용
jest.mock('@/lib/api/client', () => ({
  api: { post: (...a: unknown[]) => mockPost(...a), get: jest.fn(), patch: jest.fn() },
  ApiError: class extends Error {},
  setAuthTokenProvider: jest.fn(),
  setOnUnauthorized: (...a: unknown[]) => mockSetOnUnauthorized(...a),
}));

const flushReads = () => {
  mockPendingReads.forEach((f) => f());
  mockPendingReads = [];
};

beforeEach(async () => {
  jest.resetModules();
  mockStore.clear();
  mockPendingReads = [];
  mockDelayReads = false;
  mockLogOut.mockClear();
  mockSetOnUnauthorized.mockClear(); // 테스트별 최신 install의 핸들러만 참조
  mockPost.mockClear();
  // resetModules 이후의 레지스트리 인스턴스를 비워야 한다(상단 import 인스턴스 아님)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await (require('@react-native-async-storage/async-storage') as typeof AsyncStorageMock).clear();
});

/* eslint-disable @typescript-eslint/no-require-imports */
const tokens = () => require('../beTokens') as typeof import('../beTokens');
const fresh = () => require('../freshInstall') as typeof import('../freshInstall');
const sess = () => require('../useSession') as typeof import('../useSession');
/* eslint-enable @typescript-eslint/no-require-imports */

it('🔴 레이스 재현: 읽기 시작 → clearTokens → 늦은 resolve — 지운 토큰이 부활하면 안 된다', async () => {
  mockStore.set('kbap.auth.access.v1', 'mina-access');
  mockStore.set('kbap.auth.refresh.v1', 'mina-refresh');
  const t = tokens();
  mockDelayReads = true;
  const inflight = t.loadTokens(); // 부트(installBeAuth) 읽기 시작 — pending
  await t.clearTokens(); // freshInstall 정리(삭제가 이긴다 — 세대 가드)
  mockDelayReads = false;
  flushReads();
  await inflight; // 삭제 전 캡처값으로 resolve — 결과는 버려져야 한다
  await expect(t.loadTokens()).resolves.toBeNull(); // 부활 금지
});

it('정상 부트(정리 없음): 읽기 결과가 캐시로 유지된다', async () => {
  mockStore.set('kbap.auth.access.v1', 'a');
  mockStore.set('kbap.auth.refresh.v1', 'r');
  const t = tokens();
  await expect(t.loadTokens()).resolves.toEqual({ access: 'a', refresh: 'r' });
});

it('freshInstall: 마커 없음+토큰 잔존 → 전부 wipe + 세션 스토어 게스트 확정 + Firebase 무조건 signOut', async () => {
  mockStore.set('kbap.auth.access.v1', 'mina-access');
  mockStore.set('kbap.auth.refresh.v1', 'mina-refresh');
  sess().initSessionState(true); // 부트 레이스가 회원으로 선고착한 상황
  await expect(fresh().cleanupIfFreshInstall()).resolves.toBe(true);
  await expect(tokens().loadTokens()).resolves.toBeNull();
  expect(sess().getSessionState()).toBe(false); // 경계 통과 — true 고착 해소
  expect(mockLogOut).toHaveBeenCalled(); // currentUser() 널 레이스 무관 무조건 시도
});

it('freshInstall: 마커 있음 → 토큰·세션 유지(정리 미실행)', async () => {
  const AS = require('@react-native-async-storage/async-storage') as { setItem: (k: string, v: string) => Promise<void> };
  await AS.setItem('kbap.installed.v1', '1');
  mockStore.set('kbap.auth.access.v1', 'a');
  mockStore.set('kbap.auth.refresh.v1', 'r');
  await expect(fresh().cleanupIfFreshInstall()).resolves.toBe(false);
  await expect(tokens().loadTokens()).resolves.toEqual({ access: 'a', refresh: 'r' });
  expect(mockLogOut).not.toHaveBeenCalled();
});

it('게스트 진입(logoutLocalFirst) — 로컬 경계 먼저, 서버 logout은 백그라운드(pending이어도 resolve)', async () => {
  mockStore.set('kbap.auth.access.v1', 'mina-access');
  mockStore.set('kbap.auth.refresh.v1', 'mina-refresh');
  sess().initSessionState(true); // 반쪽 세션(회원 고착) 상황
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const be = require('../beAuth') as typeof import('../beAuth');
  await be.logoutLocalFirst(); // mockPost는 영원히 pending — 이 await가 통과 = 네트워크 비대기 실증
  await expect(tokens().loadTokens()).resolves.toBeNull();
  expect(sess().getSessionState()).toBe(false);
  expect(mockPost).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'mina-refresh' }); // 서버 폐기는 발사됨
});

it('진행 중 refresh가 로그아웃 경계 이후 resolve해도 재부활 금지 (세션 세대 가드)', async () => {
  mockStore.set('kbap.auth.access.v1', 'mina-access');
  mockStore.set('kbap.auth.refresh.v1', 'mina-refresh');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const be = require('../beAuth') as typeof import('../beAuth');
  be.installBeAuth();
  const handle = mockSetOnUnauthorized.mock.calls[0][0] as (c: string | null) => Promise<boolean>;
  let resolveRefresh!: (v: unknown) => void;
  mockPost.mockImplementationOnce(() => new Promise((r) => (resolveRefresh = r))); // /auth/refresh 유예
  const refreshP = handle('AUTH-004'); // 401 → tryRefresh 출발(pending)
  await new Promise((r) => setTimeout(r, 0)); // loadTokens 완료 → post 도달
  await be.logoutLocalFirst(); // "세션 끝" 경계 — 이후 도착 응답은 폐기돼야 한다
  resolveRefresh({ accessToken: 'revived-a', refreshToken: 'revived-r' });
  await expect(refreshP).resolves.toBe(false); // 폐기 — 재시도 신호도 없음
  await expect(tokens().loadTokens()).resolves.toBeNull(); // saveTokens 미실행(재부활 금지)
  expect(sess().getSessionState()).toBe(false);
});

it('logoutBe 서버 대기 창에서 시작한 refresh도 부활 금지 — 경계 = 로컬 정리 선행 통일', async () => {
  mockStore.set('kbap.auth.access.v1', 'mina-access');
  mockStore.set('kbap.auth.refresh.v1', 'mina-refresh');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const be = require('../beAuth') as typeof import('../beAuth');
  be.installBeAuth();
  const handle = mockSetOnUnauthorized.mock.calls[0][0] as (c: string | null) => Promise<boolean>;
  const deferred: Array<(v: unknown) => void> = [];
  mockPost.mockImplementation(() => new Promise((r) => deferred.push(r))); // 전 호출 유예
  const logoutP = be.logoutBe(); // 서버 /auth/logout 대기 창(구현에 따라 pending일 수 있음)
  await new Promise((r) => setTimeout(r, 0));
  const refreshP = handle('AUTH-004'); // 그 창에서 **시작**한 refresh
  await new Promise((r) => setTimeout(r, 0));
  deferred.forEach((r) => r({ accessToken: 'revived-a', refreshToken: 'revived-r' })); // 전부 늦게 응답
  await refreshP;
  await logoutP;
  await expect(tokens().loadTokens()).resolves.toBeNull(); // 어느 창이든 부활 금지
  expect(sess().getSessionState()).toBe(false);
});

it('낡은 refresh의 finally가 새 뮤텍스를 지우지 않는다 — 자기 프라미스일 때만 해제', async () => {
  mockStore.set('kbap.auth.access.v1', 'a1');
  mockStore.set('kbap.auth.refresh.v1', 'r1');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const be = require('../beAuth') as typeof import('../beAuth');
  be.installBeAuth();
  const handle = mockSetOnUnauthorized.mock.calls[0][0] as (c: string | null) => Promise<boolean>;
  const refreshCalls = () => mockPost.mock.calls.filter((c: unknown[]) => c[0] === '/auth/refresh').length;
  const deferred: Array<(v: unknown) => void> = [];
  mockPost.mockImplementation((path: string) =>
    path === '/auth/refresh' ? new Promise((r) => deferred.push(r)) : new Promise(() => {}),
  );
  const a = handle('AUTH-004'); // A 출발(pending)
  await new Promise((r) => setTimeout(r, 0));
  await be.logoutLocalFirst(); // 경계 — A 무효화 + 뮤텍스 해제
  await tokens().saveTokens('b-a', 'b-r'); // 재로그인 시뮬(새 세션)
  const b = handle('AUTH-004'); // B 출발(pending) — 새 뮤텍스 점유
  await new Promise((r) => setTimeout(r, 0));
  expect(refreshCalls()).toBe(2);
  deferred[0]({ accessToken: 'x', refreshToken: 'y' }); // A 늦은 응답 → finally 실행
  await a;
  void handle('AUTH-004'); // C — 뮤텍스가 살아 있으면 B의 진행분 공유(3번째 post 없음)
  await new Promise((r) => setTimeout(r, 0));
  // A의 finally가 B 뮤텍스를 지웠다면 C가 새 refresh를 쏴 3이 된다(Red 근거).
  // (핸들러가 async 래퍼라 프라미스 참조 동일성 대신 네트워크 호출 수로 판정.)
  expect(refreshCalls()).toBe(2);
  void b; // B는 pending 유지 — 워커 릭 방지용 명시 no-op
});

it('pending 로그인 교환 중 게스트 진입 → 교환 응답 폐기(cancelled) — 회원 복귀 금지', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const be = require('../beAuth') as typeof import('../beAuth');
  let resolveLogin!: (v: unknown) => void;
  mockPost.mockImplementation((path: string) =>
    path === '/auth/login' ? new Promise((r) => (resolveLogin = r)) : new Promise(() => {}),
  );
  const exch = be.exchangeLogin('firebase-idtoken'); // 소셜 성공 → 교환 pending
  await new Promise((r) => setTimeout(r, 0));
  await be.logoutLocalFirst(); // 그 사이 "Start K-Bap"(게스트 진입 경계)
  resolveLogin({ newMember: false, accessToken: 'mina-a', refreshToken: 'mina-r' });
  const res = await exch;
  expect(res.cancelled).toBe(true); // 호출측 내비게이션 스킵 신호
  await expect(tokens().loadTokens()).resolves.toBeNull(); // saveTokens 미실행
  expect(sess().getSessionState()).toBe(false); // resetServerCache(true) 미실행
});

it('정상 refresh(경계 무개입) = 저장·true 회귀', async () => {
  mockStore.set('kbap.auth.access.v1', 'old-a');
  mockStore.set('kbap.auth.refresh.v1', 'old-r');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const be = require('../beAuth') as typeof import('../beAuth');
  be.installBeAuth();
  const handle = mockSetOnUnauthorized.mock.calls[0][0] as (c: string | null) => Promise<boolean>;
  mockPost.mockImplementationOnce(async () => ({ accessToken: 'new-a', refreshToken: 'new-r' }));
  await expect(handle('AUTH-004')).resolves.toBe(true);
  await expect(tokens().loadTokens()).resolves.toEqual({ access: 'new-a', refresh: 'new-r' });
});

it('배선 소스 잠금 — 부트 세션 초기화는 cleanup 직렬화 이후(installBeAuth에 부트 읽기 없음)', () => {
  const fs = require('fs') as typeof import('fs');
  const beAuth = fs.readFileSync('src/lib/auth/beAuth.ts', 'utf8') as string;
  // installBeAuth 본문에 부트 읽기 금지 — 초기화는 initSessionFromStorage(직렬 전용)만
  const installBody = beAuth.split('export function installBeAuth')[1].split('export ')[0];
  expect(installBody).not.toContain('hasBeSession');
  expect(beAuth).toContain('export function initSessionFromStorage');
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
  expect(layout).toMatch(/cleanupDone\.then\(\(\) => initSessionFromStorage\(\)\)/); // 정리 후 초기화(직렬화)
  // ⑶ 게스트 진입(Start K-Bap) = 명시적 세션 클리어 — 스토어 신뢰 금지
  const login = fs.readFileSync('src/app/login.tsx', 'utf8') as string;
  // Codex #19 P1: 로컬 정리를 **await한 뒤** 이동 — fire-and-forget이면 replace
  // 시점에 잔존 세션 그대로 회원 UI 진입(막으려던 상태)
  expect(login).toContain('await logoutLocalFirst()');
  expect(login.indexOf('await logoutLocalFirst()')).toBeLessThan(login.indexOf("router.replace('/(tabs)'"));
});
