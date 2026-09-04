/**
 * freshInstall — 신규 설치 잔존 세션 정리 (앱 삭제 후 재설치 로그인 유지 버그).
 * 센티널 부재 = 정리+기록 / 센티널 존재 = 무손대(오탐 로그아웃 금지)를 잠근다.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(async () => {}) },
}));
jest.mock('../beTokens', () => ({ clearTokens: jest.fn(async () => {}), bumpSessionGen: jest.fn(), currentGen: jest.fn(() => 0), loadTokens: jest.fn(async () => null), saveTokens: jest.fn(async () => true) }));
jest.mock('../session', () => ({
  currentUser: jest.fn(() => ({ uid: 'u1' })),
  logOut: jest.fn(async () => {}),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { clearTokens } = require('../beTokens');
const session = require('../session');
const { cleanupIfFreshInstall } = require('../freshInstall') as typeof import('../freshInstall');
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => jest.clearAllMocks());

describe('cleanupIfFreshInstall', () => {
  it('센티널 없음(신규 설치/재설치) → 토큰·Firebase 세션 정리 후 센티널 기록', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await cleanupIfFreshInstall();

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(session.logOut).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('kbap.installed.v1', '1');
  });

  it('센티널 있음(일반 재실행) → 아무것도 지우지 않음 (오탐 로그아웃 없음)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');

    await cleanupIfFreshInstall();

    expect(clearTokens).not.toHaveBeenCalled();
    expect(session.logOut).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('스토리지 판독 불능 → 정리하지 않음 (기존 사용자 보호가 기본)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('io'));

    await cleanupIfFreshInstall();

    expect(clearTokens).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  // KB-421: 구 "미로그인이면 signOut 생략" 잠금 반전 — RNFB 세션 복원이 비동기라
  // 부트 초입 currentUser()=null이어도 잔존 세션이 있을 수 있다 → 무조건 signOut
  // (미로그인 signOut은 무해·resolve — P-205 mina Firebase 잔존 경로 봉쇄).
  it('Firebase currentUser()=null(복원 전)이어도 signOut을 무조건 시도한다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (session.currentUser as jest.Mock).mockReturnValue(null);

    await cleanupIfFreshInstall();

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(session.logOut).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('kbap.installed.v1', '1');
  });
});
