/**
 * KB-732(P-453) — Amplitude 회원 식별 배선(행동 테스트):
 * members/me 성공 = setUserId(회원 번호 문자열) 1회 · 게스트 = 호출 0 · 세션 경계(로그아웃·만료·탈퇴·재설치 정리) = reset ·
 * 부팅에 토큰 없음 = 잔존 정리 · 로그아웃 경합 = 옛 응답 식별 0 · 계정 생애주기(A 로그아웃→B 로그인 · 탈퇴→재가입 · 재설치).
 */
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));
const mockSentry = jest.fn();
jest.mock('@/lib/sentry', () => ({ setSentryUser: (id: unknown) => mockSentry(id), reportProfileContractDrift: jest.fn() }));
const calls: string[] = []; // 식별 API 호출 순서(생애주기 단언용)
const mockSetUser = jest.fn((id: string) => { calls.push(`set:${id}`); });
const mockReset = jest.fn(() => { calls.push('reset'); });
const mockClearStale = jest.fn(() => { calls.push('stale'); return true; });
jest.mock('@/lib/analytics', () => ({
  setAnalyticsUser: (id: string) => mockSetUser(id),
  resetAnalyticsIdentity: () => mockReset(),
  clearStaleAnalyticsIdentity: () => mockClearStale(),
  track: jest.fn(), setUserProps: jest.fn(), EVENTS: {},
}));
const mockTokens: { cur: { access: string; refresh: string } | null } = { cur: null };
const mockGen = { n: 1 };
jest.mock('@/lib/auth/beTokens', () => ({
  loadTokens: async () => mockTokens.cur,
  clearTokens: async () => { mockTokens.cur = null; },
  saveTokens: async () => true,
  revertTokensIf: () => {},
  bumpSessionGen: () => { mockGen.n += 1; },
  currentGen: () => mockGen.n,
}));
jest.mock('@/lib/auth/useSession', () => ({ getSessionState: () => null, initSessionState: jest.fn(), setSessionState: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn(), removeQueries: jest.fn(), invalidateQueries: jest.fn(), resetQueries: jest.fn() } }));
jest.mock('@/lib/net/inflight', () => ({ track: <T,>(p: T) => p }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn(async () => ({})), patch: jest.fn(async () => ({})) },
  apiLang: () => 'en', ApiError: class extends Error {},
  setAuthTokenProvider: jest.fn(), setOnUnauthorized: jest.fn(), setSessionGenerationProvider: jest.fn(), setOnMemberMissing: jest.fn(),
}));
jest.mock('@/lib/onboarding/submit', () => ({ loadLocalSpice: async () => null, SPICE_KEY: 'kbap.profile.spice.v1', spiceChoiceToWire: () => null }));
jest.mock('@/lib/onboarding/draft', () => ({ clearOnboardingDraft: jest.fn(async () => {}) }));
jest.mock('@/lib/auth/session', () => ({ logOut: jest.fn(async () => {}) }));

/* eslint-disable import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례 */
import { fetchMe } from '@/lib/data/useMe';
import { endSessionBoundary, initSessionFromStorage, logoutLocalFirst, withdrawBe } from '@/lib/auth/beAuth';
import { cleanupIfFreshInstall } from '@/lib/auth/freshInstall';
import { clearMemberLocalState } from '@/lib/auth/clearMemberLocal';
/* eslint-enable import/first */

const wire = (memberId: number) => ({ memberId, nickname: 'Mina', countryCode: 'US', readerLanguage: 'en', spiceTolerance: null, avoidanceSubstanceCodes: [], rank: null });
const login = (memberId: number) => { mockTokens.cur = { access: 'a', refresh: 'r' }; mockGet.mockResolvedValue(wire(memberId)); };

// eslint-disable-next-line @typescript-eslint/no-require-imports -- 목 스토리지 초기화(설치 센티널이 테스트 간 남지 않게)
const AsyncStorageMock = (require('@react-native-async-storage/async-storage') as { default?: { clear: () => Promise<void> }; clear?: () => Promise<void> });
beforeEach(async () => { jest.clearAllMocks(); calls.length = 0; mockTokens.cur = null; mockGen.n = 1; await (AsyncStorageMock.default ?? AsyncStorageMock).clear!(); });

it('members/me 성공(로그인 직후·세션 복원 공통 지점) → setUserId 1회 · 값 = 회원 번호 문자열 · reset 0', async () => {
  login(7);
  const me = await fetchMe();
  expect(me.id).toBe('7');
  expect(mockSetUser).toHaveBeenCalledTimes(1);
  expect(mockSetUser).toHaveBeenCalledWith('7');
  expect(mockReset).not.toHaveBeenCalled();
});

it('게스트(세션 없음) → 식별 호출 0(회원 번호도, reset도)', async () => {
  await fetchMe();
  expect(mockGet).not.toHaveBeenCalled();
  expect(mockSetUser).not.toHaveBeenCalled();
  expect(mockReset).not.toHaveBeenCalled();
});

it('세션 종료 경계 — 로그아웃·탈퇴·재설치 정리 각각 reset 1회(단일 경계) · 저장소 소거(clearMemberLocalState)는 식별을 건드리지 않음', async () => {
  mockTokens.cur = { access: 'a', refresh: 'r' };
  await logoutLocalFirst();
  expect(mockReset).toHaveBeenCalledTimes(1);
  mockTokens.cur = { access: 'a', refresh: 'r' };
  await withdrawBe();
  expect(mockReset).toHaveBeenCalledTimes(2);
  await cleanupIfFreshInstall(); // 센티널 없음 = 재설치 → 경계
  expect(mockReset).toHaveBeenCalledTimes(3);
  await clearMemberLocalState();
  expect(mockReset).toHaveBeenCalledTimes(3);
  expect(mockSetUser).not.toHaveBeenCalled();
});

it('경계가 reset에서 throw해도 완주한다(토큰 소거·세대 bump) — 계측은 안전 기능이 아님', async () => {
  mockTokens.cur = { access: 'a', refresh: 'r' };
  mockReset.mockImplementationOnce(() => { throw new Error('sdk'); });
  const before = mockGen.n;
  await expect(endSessionBoundary()).resolves.toBeUndefined();
  expect(mockTokens.cur).toBeNull();
  expect(mockGen.n).toBe(before + 1);
});

it('부팅: 로컬 토큰 없음 → 잔존 정리 1회 · 토큰 있음 → 호출 0', async () => {
  await initSessionFromStorage();
  expect(mockClearStale).toHaveBeenCalledTimes(1);
  mockTokens.cur = { access: 'a', refresh: 'r' };
  await initSessionFromStorage();
  expect(mockClearStale).toHaveBeenCalledTimes(1);
});

it('로그아웃 도중 도착한 옛 members/me 응답(세대 바뀜) → 식별 0(Sentry·Amplitude) · 값은 반환', async () => {
  login(7);
  mockGet.mockImplementation(async () => { mockGen.n += 1; return wire(7); }); // 응답 전에 경계(세대 bump)
  const me = await fetchMe();
  expect(me.id).toBe('7');
  expect(mockSetUser).not.toHaveBeenCalled();
  expect(mockSentry).not.toHaveBeenCalled();
});

describe('계정 생애주기(CLAUDE.md 상비 유닛)', () => {
  it('같은 기기 A 로그아웃 → B 로그인: set A → reset → set B(두 user_id가 서로 다른 기기 id로 분리)', async () => {
    login(7); await fetchMe();
    await logoutLocalFirst();
    login(9); await fetchMe();
    expect(calls).toEqual(['set:7', 'reset', 'set:9']);
  });
  it('탈퇴 → 재가입: set → reset(탈퇴 경계) → set 새 번호(옛 번호 재등장 0)', async () => {
    login(7); await fetchMe();
    await withdrawBe();
    await clearMemberLocalState();
    login(10); await fetchMe();
    expect(calls).toEqual(['set:7', 'reset', 'set:10']);
    expect(calls.filter((c) => c === 'set:7')).toHaveLength(1);
  });
  it('재설치: 잔존 세션 정리 경계 → reset → 게스트 부팅 정리(토큰 없음)', async () => {
    mockTokens.cur = { access: 'a', refresh: 'r' }; // Keychain 잔존
    await cleanupIfFreshInstall();
    await initSessionFromStorage();
    expect(calls).toEqual(['reset', 'stale']);
  });
});
