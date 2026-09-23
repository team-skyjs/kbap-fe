/**
 * P-389(KB-576) — 계측용 회원 판정 3값(true/false/모름).
 *
 * `loadTokens()`는 저장소 오류를 내부에서 삼키고 null(게스트)을 돌려준다. 그 값만 보면
 * SecureStore 일시 오류가 **회원을 게스트로** 찍어 세그먼트를 오염시킨다(Codex #165).
 * 여기서 잠그는 건 "모름을 게스트로 접지 않는다" 하나다.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockStore = new Map<string, string>();
let mockReadThrows = false;
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => {
    if (mockReadThrows) throw new Error('keychain unavailable');
    return mockStore.get(k) ?? null;
  },
  setItemAsync: async (k: string, v: string) => { mockStore.set(k, v); },
  deleteItemAsync: async (k: string) => { mockStore.delete(k); },
}));

jest.mock('@/lib/data/config', () => ({ BE_BASE: 'https://dev.kbap.site' }));

type Tokens = typeof import('../beTokens');
const load = (): Tokens => {
  let mod!: Tokens;
  jest.isolateModules(() => { mod = require('../beTokens') as Tokens; });
  return mod;
};

beforeEach(() => {
  mockStore.clear();
  mockReadThrows = false;
});

it('회원 = true · 게스트(저장분 없음) = false', async () => {
  const guest = load();
  expect(await guest.isRegisteredForAnalytics()).toBe(false);

  const member = load();
  await member.saveTokens('a', 'r');
  expect(await member.isRegisteredForAnalytics()).toBe(true);
});

it('저장소 읽기 실패 = **null(모름)** — 게스트로 접지 않는다', async () => {
  mockReadThrows = true;
  const t = load();
  expect(await t.loadTokens()).toBeNull(); // 세션 취급은 종전대로(게스트 시작)
  expect(await t.isRegisteredForAnalytics()).toBeNull(); // 계측은 모름
});

it('실패 뒤 저장·삭제가 일어나면 모름이 풀린다', async () => {
  mockReadThrows = true;
  const t = load();
  expect(await t.isRegisteredForAnalytics()).toBeNull();

  mockReadThrows = false;
  await t.saveTokens('a', 'r');
  expect(await t.isRegisteredForAnalytics()).toBe(true); // 쓰기 성공 = 저장소 정상

  await t.clearTokens();
  expect(await t.isRegisteredForAnalytics()).toBe(false); // 명시적 삭제 = 게스트 확정
});
