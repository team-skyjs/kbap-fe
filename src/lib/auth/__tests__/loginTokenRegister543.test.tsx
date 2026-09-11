/**
 * KB-543 — 로그인(세션 교환) 성공 직후 푸시 토큰 등록 1회. 게스트 등록 경로는 폐기되었으므로
 * 이 호출이 없으면 회원이 로그인해도 기기 토큰이 서버에 연결되지 않는다.
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
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'u1', getIdToken: jest.fn().mockResolvedValue('fbIdToken') } }),
  GoogleAuthProvider: { credential: jest.fn(() => ({})) },
  AppleAuthProvider: { credential: jest.fn() },
  signInWithCredential: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'n', digestStringAsync: jest.fn(), CryptoDigestAlgorithm: {} }));
const mockExchange = jest.fn();
jest.mock('../beAuth', () => ({ exchangeLogin: (...a: unknown[]) => mockExchange(...a) }));
const mockRegister = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/push/pushAdapter', () => ({ registerPushToken: (...a: unknown[]) => mockRegister(...a) }));

import { useSocialAuth } from '../useSocialAuth';

function Harness({ onDone }: { onDone: () => void }) {
  const { signInWithGoogle } = useSocialAuth(() => onDone());
  React.useEffect(() => {
    void signInWithGoogle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

async function login() {
  let done!: () => void;
  const signedIn = new Promise<void>((r) => (done = r));
  await act(async () => { renderer.create(<Harness onDone={done} />); });
  await act(async () => { await signedIn; });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'gIdToken' } });
  mockGetTokens.mockResolvedValue({ idToken: 'gIdToken', accessToken: 'gAccessToken' });
});

it('세션 교환 성공 → registerPushToken 정확히 1회 (SC-011)', async () => {
  mockExchange.mockResolvedValue({ newMember: false });
  await login();
  expect(mockExchange).toHaveBeenCalledTimes(1);
  expect(mockRegister).toHaveBeenCalledTimes(1);
});

it('세션 교환 취소(cancelled, KB-421 게스트 선행) → 등록 0회 (onSignedIn도 미호출)', async () => {
  mockExchange.mockResolvedValue({ newMember: false, cancelled: true });
  const onDone = jest.fn();
  await act(async () => { renderer.create(<Harness onDone={onDone} />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  expect(mockExchange).toHaveBeenCalledTimes(1);
  expect(mockRegister).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});

it('소스 잠금: 등록은 exchange 헬퍼 한 곳(구글·애플 공통), onSignedIn 앞', () => {
  const fs = require('fs') as typeof import('fs');
  const src = fs.readFileSync('src/lib/auth/useSocialAuth.ts', 'utf8');
  expect(src.match(/registerPushToken\(\)/g)).toHaveLength(1);
  expect(src).toContain("import { registerPushToken } from '@/lib/push/pushAdapter'");
});
