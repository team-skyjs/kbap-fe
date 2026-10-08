/**
 * KB-732(P-453) — Amplitude 회원 식별 배선: members/me 성공 = setUserId(회원 번호 문자열) 1회 · 게스트 = 해제 ·
 * 로그아웃 = 해제 · 탈퇴 정리 = 해제 + 기기 id 재생성. P-197 Sentry 식별과 같은 세 지점.
 */
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));
jest.mock('@/lib/sentry', () => ({ setSentryUser: jest.fn(), reportProfileContractDrift: jest.fn() }));
const mockSetUser = jest.fn();
const mockResetDevice = jest.fn();
jest.mock('@/lib/analytics', () => ({ setAnalyticsUser: (id: unknown) => mockSetUser(id), resetAnalyticsDevice: () => mockResetDevice(), track: jest.fn(), setUserProps: jest.fn(), EVENTS: {} }));
const mockHasSession = jest.fn();
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: () => mockHasSession() }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a), patch: jest.fn() }, apiLang: () => 'en' }));
jest.mock('@/lib/onboarding/submit', () => ({ loadLocalSpice: async () => null, SPICE_KEY: 'kbap.profile.spice.v1', spiceChoiceToWire: () => null }));
jest.mock('@/lib/onboarding/draft', () => ({ clearOnboardingDraft: jest.fn(async () => {}) }));

/* eslint-disable import/first -- jest.mock 선언 뒤(팩토리 호이스팅) — 레포 관례 */
import { readFileSync } from 'fs';
import { fetchMe } from '@/lib/data/useMe';
import { clearMemberLocalState } from '@/lib/auth/clearMemberLocal';
/* eslint-enable import/first */

const WIRE = { memberId: 7, nickname: 'Mina', countryCode: 'US', readerLanguage: 'en', spiceTolerance: null, avoidanceSubstanceCodes: [], rank: null };

beforeEach(() => jest.clearAllMocks());

it('members/me 성공(로그인 직후·앱 시작 세션 복원 공통 지점) → setUserId 1회 · 값은 회원 번호 **문자열**(토큰 클레임 아님)', async () => {
  mockHasSession.mockResolvedValue(true);
  mockGet.mockResolvedValue(WIRE);
  const me = await fetchMe();
  expect(me.id).toBe('7');
  expect(mockSetUser).toHaveBeenCalledTimes(1);
  expect(mockSetUser).toHaveBeenCalledWith('7');
  expect(typeof mockSetUser.mock.calls[0][0]).toBe('string');
  expect(mockResetDevice).not.toHaveBeenCalled();
});

it('게스트(세션 없음) → 회원 번호로 호출 0 · 해제(null) 1회', async () => {
  mockHasSession.mockResolvedValue(false);
  await fetchMe();
  expect(mockGet).not.toHaveBeenCalled();
  expect(mockSetUser).toHaveBeenCalledTimes(1);
  expect(mockSetUser).toHaveBeenCalledWith(null);
});

it('탈퇴 정리 → 해제(null) + 기기 id 재생성 1회', async () => {
  await clearMemberLocalState();
  expect(mockSetUser).toHaveBeenCalledWith(null);
  expect(mockResetDevice).toHaveBeenCalledTimes(1);
});

it('로그아웃(session.logOut) = 해제만 — 기기 id 재생성 없음(소스 잠금: RNFB 없이)', () => {
  const s = readFileSync('src/lib/auth/session.ts', 'utf8');
  const fn = s.slice(s.indexOf('export async function logOut'));
  expect(fn).toContain('setAnalyticsUser(null)');
  expect(fn).not.toContain('resetAnalyticsDevice');
  // 화면 코드에서 식별 API 직접 호출 0 — 세 지점뿐
  const { execSync } = jest.requireActual<typeof import('child_process')>('child_process');
  const callers = execSync("git grep -l 'setAnalyticsUser\\|resetAnalyticsDevice' -- 'src/**/*.ts' 'src/**/*.tsx' ':!src/**/__tests__/**'", { encoding: 'utf8' }).trim().split('\n').sort();
  expect(callers).toEqual(['src/lib/analytics.ts', 'src/lib/auth/clearMemberLocal.ts', 'src/lib/auth/session.ts', 'src/lib/data/useMe.ts']);
});
