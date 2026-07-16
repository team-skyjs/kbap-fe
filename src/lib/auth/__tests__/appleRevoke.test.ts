/**
 * P-005(KB-162): 애플 재인증 + revoke 게이트의 안전 규칙을 잠근다.
 * - provider 판별(isAppleUser) — 구글 회원이 게이트에 걸리면 안 되고(무변),
 *   애플 회원이 게이트를 우회해도 안 된다 (심사 요건).
 * - 엣지 3종: 시트 취소 / 타계정 인증 / revoke 실패 → 전부 탈퇴 중단 신호,
 *   revoke 는 본인 대조를 통과했을 때만 호출된다.
 */
const mockSignInAsync = jest.fn();
jest.mock('expo-apple-authentication', () => ({ signInAsync: (...a: unknown[]) => mockSignInAsync(...a) }));

const mockRevokeToken = jest.fn();
let mockUser: { providerData: { providerId: string; uid: string }[] } | null = null;
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockUser }),
  revokeToken: (...a: unknown[]) => mockRevokeToken(...a),
}));

import { checkAppleReauth, isAppleUser, currentIsAppleUser, reauthAndRevokeApple } from '../appleRevoke';

const APPLE_SUB = '001234.abcdef.5678';

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { providerData: [{ providerId: 'apple.com', uid: APPLE_SUB }] };
  mockRevokeToken.mockResolvedValue(undefined);
});

describe('isAppleUser — provider 분기 판별 (구글 회원 무변 게이트)', () => {
  it('apple.com 프로바이더가 있어야만 true', () => {
    expect(isAppleUser([{ providerId: 'apple.com' }])).toBe(true);
    expect(isAppleUser([{ providerId: 'google.com' }])).toBe(false);
    expect(isAppleUser([{ providerId: 'google.com' }, { providerId: 'apple.com' }])).toBe(true);
    expect(isAppleUser([])).toBe(false);
  });

  it('currentIsAppleUser — 미로그인(currentUser null)은 false (크래시 없음)', () => {
    mockUser = null;
    expect(currentIsAppleUser()).toBe(false);
  });
});

describe('checkAppleReauth — 타계정 거부 (user/sub 대조)', () => {
  it('sub 일치 + code 존재 → ok', () => {
    expect(checkAppleReauth({ user: APPLE_SUB, authorizationCode: 'c0de' }, APPLE_SUB)).toEqual({ ok: true, code: 'c0de' });
  });

  it('다른 애플 계정 → mismatch', () => {
    expect(checkAppleReauth({ user: 'other.sub', authorizationCode: 'c0de' }, APPLE_SUB)).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('대조 불가(식별자 없음)도 거부 — 불확실하면 진행 금지', () => {
    expect(checkAppleReauth({ user: null, authorizationCode: 'c0de' }, APPLE_SUB).ok).toBe(false);
    expect(checkAppleReauth({ user: APPLE_SUB, authorizationCode: 'c0de' }, null).ok).toBe(false);
    expect(checkAppleReauth({ user: APPLE_SUB, authorizationCode: 'c0de' }, undefined).ok).toBe(false);
  });

  it('code 없음 → no-code', () => {
    expect(checkAppleReauth({ user: APPLE_SUB, authorizationCode: null }, APPLE_SUB)).toEqual({ ok: false, reason: 'no-code' });
  });
});

describe('reauthAndRevokeApple — 엣지 3종은 전부 탈퇴 중단 신호', () => {
  it('본인 대조 통과 → revokeToken(code) 호출 → revoked', async () => {
    mockSignInAsync.mockResolvedValue({ user: APPLE_SUB, authorizationCode: 'c0de' });
    await expect(reauthAndRevokeApple()).resolves.toBe('revoked');
    expect(mockRevokeToken).toHaveBeenCalledWith(expect.anything(), 'c0de');
  });

  it('시트 취소 → cancelled, revoke 미호출', async () => {
    mockSignInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    await expect(reauthAndRevokeApple()).resolves.toBe('cancelled');
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  it('다른 애플 계정으로 인증 → mismatch, revoke 미호출', async () => {
    mockSignInAsync.mockResolvedValue({ user: 'other.sub', authorizationCode: 'c0de' });
    await expect(reauthAndRevokeApple()).resolves.toBe('mismatch');
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  it('revoke 실패(네트워크 등) → failed (탈퇴 진행 금지 신호)', async () => {
    mockSignInAsync.mockResolvedValue({ user: APPLE_SUB, authorizationCode: 'c0de' });
    mockRevokeToken.mockRejectedValue(new Error('network'));
    await expect(reauthAndRevokeApple()).resolves.toBe('failed');
  });

  it('시트가 다른 에러로 실패 → failed, revoke 미호출', async () => {
    mockSignInAsync.mockRejectedValue(new Error('boom'));
    await expect(reauthAndRevokeApple()).resolves.toBe('failed');
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });
});
