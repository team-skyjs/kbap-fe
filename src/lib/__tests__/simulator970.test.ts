/**
 * KB-970: OCR 주입 입력칸 = 시뮬레이터 전용. 실기(isDevice) = 채널 무관 숨김, 시뮬 + 진단 채널·개발 번들 = 표시.
 */
import { Platform } from 'react-native';

const mockReleaseType = jest.fn();
jest.mock('expo-application', () => ({ ApplicationReleaseType: { UNKNOWN: 0, SIMULATOR: 1, ENTERPRISE: 2, DEVELOPMENT: 3, AD_HOC: 4, APP_STORE: 5 }, getIosApplicationReleaseTypeAsync: () => mockReleaseType() }), { virtual: false });
let mockDiag = false;
jest.mock('@/lib/flags', () => ({ ...jest.requireActual('@/lib/flags'), isDiagnosticChannel: () => mockDiag }));

/* eslint-disable-next-line import/first -- jest.mock 뒤 */
import { _resetSimulatorForTest, isAndroidEmulator, isSimulator, showOcrDebug } from '../simulator';

const prevOS = Platform.OS;
const setOS = (os: 'ios' | 'android') => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
afterEach(() => { setOS(prevOS as 'ios' | 'android'); _resetSimulatorForTest(); jest.clearAllMocks(); });

describe('시뮬 판정', () => {
  it('iOS: 릴리스 유형 SIMULATOR = 시뮬 · TestFlight·스토어(APP_STORE)·개발 실기 = 실기 · 오류 = 실기', async () => {
    setOS('ios');
    mockReleaseType.mockResolvedValueOnce(1);
    expect(await isSimulator()).toBe(true);
    for (const v of [5, 3, 4, 0]) {
      _resetSimulatorForTest();
      mockReleaseType.mockResolvedValueOnce(v);
      expect(await isSimulator()).toBe(false);
    }
    _resetSimulatorForTest();
    mockReleaseType.mockRejectedValueOnce(new Error('native'));
    expect(await isSimulator()).toBe(false);
  });

  it('Android: 에뮬레이터 빌드 상수 = 시뮬 · 실기 지문 = 실기', () => {
    expect(isAndroidEmulator({ Fingerprint: 'google/sdk_gphone64_arm64/emu64a:15/AE3A.240806.036/12592187:userdebug/dev-keys', Model: 'sdk_gphone64_arm64' })).toBe(true);
    expect(isAndroidEmulator({ Fingerprint: 'generic/sdk/generic:9/PSR1/1:user/test-keys', Model: 'Android SDK built for x86' })).toBe(true);
    expect(isAndroidEmulator({ Fingerprint: 'samsung/b0qksx/b0q:14/UP1A.231005.007/S908NKSU4DXA1:user/release-keys', Model: 'SM-S908N', Brand: 'samsung' })).toBe(false);
    expect(isAndroidEmulator({ Fingerprint: 'google/husky/husky:15/AP3A.241005.015/12366759:user/release-keys', Model: 'Pixel 8 Pro', Brand: 'google' })).toBe(false);
    expect(isAndroidEmulator(undefined)).toBe(false);
  });
});

describe('입력칸 노출', () => {
  it('실기 = 진단 채널이어도 숨김 · 시뮬 + 진단 채널 = 표시', () => {
    mockDiag = true;
    expect(showOcrDebug(false)).toBe(false);
    expect(showOcrDebug(true)).toBe(true);
  });
  it('시뮬 + 스토어 채널 + 개발 번들 아님 = 숨김', () => {
    mockDiag = false;
    const g = global as { __DEV__?: boolean };
    const prev = g.__DEV__;
    g.__DEV__ = false;
    try {
      expect(showOcrDebug(true)).toBe(false);
    } finally {
      g.__DEV__ = prev;
    }
  });
});
