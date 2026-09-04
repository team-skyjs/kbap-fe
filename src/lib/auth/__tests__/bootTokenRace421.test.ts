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
  expect(login).toContain('logoutBe()');
});
