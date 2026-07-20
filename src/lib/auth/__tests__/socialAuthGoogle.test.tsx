/**
 * P-020(KB-196): Android 구글 로그인 자격증명에 accessToken이 포함되는지 잠근다.
 * Android 네이티브는 google credential에 idToken+accessToken 둘 다 요구 —
 * accessToken 누락 시 "accessToken cannot be empty"로 실패(iOS만 동작해왔음).
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

const mockSignIn = jest.fn();
const mockGetTokens = jest.fn();
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: (...a: unknown[]) => mockSignIn(...a),
    getTokens: (...a: unknown[]) => mockGetTokens(...a),
  },
  isErrorWithCode: () => false,
  statusCodes: { SIGN_IN_CANCELLED: 'CANCELLED' },
}));

const mockCredential = jest.fn((id: string, access?: string) => ({ id, access }));
const mockSignInWithCredential = jest.fn().mockResolvedValue(undefined);
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'u1', getIdToken: jest.fn().mockResolvedValue('fbIdToken') } }),
  GoogleAuthProvider: { credential: (...a: [string, string?]) => mockCredential(...a) },
  AppleAuthProvider: { credential: jest.fn() },
  signInWithCredential: (...a: unknown[]) => mockSignInWithCredential(...a),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'n', digestStringAsync: jest.fn(), CryptoDigestAlgorithm: {}, }));
jest.mock('../beAuth', () => ({ exchangeLogin: jest.fn().mockResolvedValue({ newMember: false }) }));

import { useSocialAuth } from '../useSocialAuth';

function Harness({ onDone }: { onDone: () => void }) {
  const { signInWithGoogle } = useSocialAuth(() => onDone());
  React.useEffect(() => {
    void signInWithGoogle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

beforeEach(() => jest.clearAllMocks());

it('구글 로그인 credential에 idToken + accessToken 둘 다 (getTokens 병행 — KB-196)', async () => {
  mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'gIdToken' } });
  mockGetTokens.mockResolvedValue({ idToken: 'gIdToken', accessToken: 'gAccessToken' });

  let done!: () => void;
  const signedIn = new Promise<void>((r) => (done = r));
  await act(async () => {
    renderer.create(<Harness onDone={done} />);
  });
  await act(async () => {
    await signedIn;
  });

  expect(mockGetTokens).toHaveBeenCalled();
  expect(mockCredential).toHaveBeenCalledWith('gIdToken', 'gAccessToken');
});
