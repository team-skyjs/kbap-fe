/**
 * KB-434 후속(9/5 프로필 탭 전체 에러) — adaptProfile 계약 드리프트 방어 잠금.
 * 필수 필드 부재가 어댑터 throw → useMe error → 화면 전체 QueryErrorBlock이 되던
 * 경로 차단: 회피 부재 = [](personalRisk unable 강등 — false-safe) · ranking 부재 =
 * null(랭킹 표면 미렌더) + 드리프트 경고 1회(console.warn + Sentry 태그, PII 0).
 */
const mockCapture = jest.fn();
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  captureMessage: (...a: unknown[]) => mockCapture(...a),
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.1' } } }));

import { adaptProfile, type MyProfileWire } from '../memberAdapter';

const BASE: MyProfileWire = {
  memberId: 1, nickname: 'A', countryCode: 'US', appLanguage: 'en',
  spicinessPreference: 'SKIP', profileImageUrl: null, provider: 'GOOGLE', currency: null,
  avoidanceSubstanceCodes: ['EGG'], ranking: { tier: 'newcomer', level: 1, score: 0 },
  onboardingCompleted: true,
} as unknown as MyProfileWire;

let warnSpy: jest.SpyInstance;
beforeEach(() => {
  mockCapture.mockClear();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

it('정상 wire — 드리프트 캡처 0, 기존 매핑 무변', () => {
  const u = adaptProfile(BASE, null);
  expect(u.restrictions).toEqual([{ kind: 'allergy', code: 'EGG' }]);
  expect(u.rank?.tier).toBe('newcomer');
  expect(mockCapture).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
});

it('avoidanceSubstanceCodes 부재 — throw 0 · restrictions [](false-safe) · 드리프트 1회', () => {
  const u = adaptProfile({ ...BASE, avoidanceSubstanceCodes: undefined } as unknown as MyProfileWire, null);
  expect(u.restrictions).toEqual([]); // hasR=false → personalRisk unable 강등 방향
  expect(u.rank?.tier).toBe('newcomer'); // 나머지 필드 정상 매핑
  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(mockCapture).toHaveBeenCalledWith('profile_contract_drift', {
    level: 'warning',
    tags: { missing: 'avoidanceSubstanceCodes' },
  });
  expect(warnSpy).toHaveBeenCalledTimes(1);
});

it('ranking 부재 — throw 0 · rank null(랭킹 표면 미렌더) · 드리프트 태그에 필드명', () => {
  const u = adaptProfile({ ...BASE, ranking: undefined } as unknown as MyProfileWire, null);
  expect(u.rank).toBeNull();
  expect(mockCapture).toHaveBeenCalledWith('profile_contract_drift', {
    level: 'warning',
    tags: { missing: 'ranking' },
  });
});

it('복수 부재 — 태그에 콤마 나열(단일 캡처)', () => {
  adaptProfile({ ...BASE, avoidanceSubstanceCodes: undefined, ranking: undefined } as unknown as MyProfileWire, null);
  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(mockCapture).toHaveBeenCalledWith('profile_contract_drift', {
    level: 'warning',
    tags: { missing: 'avoidanceSubstanceCodes,ranking' },
  });
});
