/** Codex #291 R4 P2: overlapping fetchMe responses feed the unlock store in request order (late older response dropped). */
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));
jest.mock('@/lib/sentry', () => ({ setSentryUser: jest.fn(), reportProfileContractDrift: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ setAnalyticsUser: jest.fn(), track: jest.fn(), setUserProps: jest.fn(), EVENTS: {} }));
jest.mock('@/lib/airbridge', () => ({ observeScanQuota: jest.fn(), setAirbridgeUser: jest.fn() }));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: async () => true }));
jest.mock('@/lib/auth/beTokens', () => ({ currentGen: () => 0 }));
jest.mock('@/lib/onboarding/submit', () => ({ loadLocalSpice: async () => null, SPICE_KEY: 'k' }));
const mockGet = jest.fn();
jest.mock('@/lib/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) }, apiLang: () => 'en' }));

/* eslint-disable import/first -- jest.mock 선언 뒤 */
import { fetchMe } from '@/lib/data/useMe';
import { getUnlockSnapshot, hasUnlockPending, resetUnlockSession } from '@/features/scan/unlockCelebrationStore';
/* eslint-enable import/first */

const wire = (unlocked: boolean) => ({ memberId: 7, nickname: 'M', countryCode: 'US', readerLanguage: 'en', spiceTolerance: null, avoidanceSubstanceCodes: [], rank: null, scanCount: 3, freeScanLimit: 3, scanUnlocked: unlocked, scanRemaining: unlocked ? null : 0 });
function deferred() { let resolve!: (v: unknown) => void; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }
beforeEach(() => { resetUnlockSession(0); mockGet.mockReset(); });

it('a late older false does not erase the newer celebration', async () => {
  mockGet.mockResolvedValueOnce(wire(false)); await fetchMe(); // baseline false
  const older = deferred(); const newer = deferred();
  mockGet.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  const a = fetchMe(); const b = fetchMe();
  newer.resolve(wire(true)); await b;
  expect(hasUnlockPending()).toBe(true);
  older.resolve(wire(false)); await a;
  expect(hasUnlockPending()).toBe(true);
  expect(getUnlockSnapshot().event?.memberId).toBe('7');
});

it('a late older false cannot plant a stale baseline that causes a spurious celebration', async () => {
  const older = deferred(); const newer = deferred();
  mockGet.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  const a = fetchMe(); const b = fetchMe();
  newer.resolve(wire(true)); await b; // first observation = unlocked baseline, no event
  older.resolve(wire(false)); await a;
  mockGet.mockResolvedValueOnce(wire(true)); await fetchMe();
  expect(hasUnlockPending()).toBe(false);
});
