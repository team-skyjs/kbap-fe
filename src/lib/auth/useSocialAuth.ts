/**
 * useSocialAuth — social sign-in via Firebase Auth (KB-109, 2026-07-10 결정).
 *
 *   google → @react-native-google-signin (webClientId) → idToken
 *            → signInWithCredential(GoogleAuthProvider)
 *   apple  → expo-apple-authentication (EMAIL scope ONLY — 실명 미수집 정책)
 *            with a SHA-256 hashed nonce → identityToken
 *            → signInWithCredential(AppleAuthProvider(identityToken, rawNonce))
 *
 * Success = a Firebase session exists (onAuthStateChanged / getIdToken feed the
 * API layer — see auth/session.ts). No BE hand-off here: the BE only verifies
 * the ID token per request with the Admin SDK.
 *
 * Cancel is NOT an error: closing either sheet returns to idle silently. Real
 * failures set `error` ('network' vs 'generic' — the login screen's copy).
 * ⚠️ NATIVE ONLY (Firebase/google-signin native modules) — 재빌드 필요.
 */
import { useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { EVENTS, setUserProps, track } from '@/lib/analytics';
import * as Crypto from 'expo-crypto';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { AppleAuthProvider, getAuth, GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { exchangeLogin } from './beAuth';

// Firebase 프로젝트(k-bap-eb032)의 웹 클라이언트 ID (google-services.json
// oauth_client client_type:3) — 시크릿 아님, 커밋 OK.
const WEB_CLIENT_ID = '44799256321-aol4uv551nfis3308bl9447prbpeffvp.apps.googleusercontent.com';

// configure는 첫 로그인 시도 시 1회 — import 시점에 네이티브를 건드리지 않는다
// (웹 번들이 이 모듈을 포함해도 렌더까지는 안전).
let googleConfigured = false;
function ensureGoogleConfigured() {
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    googleConfigured = true;
  }
}

export type AuthErrorKind = 'network' | 'generic';
export type AuthPhase = 'idle' | 'google' | 'apple';

export function useSocialAuth(onSignedIn: (newMember: boolean) => void) {
  const [phase, setPhase] = useState<AuthPhase>('idle');
  const [error, setError] = useState<AuthErrorKind | null>(null);

  // Firebase 세션 → BE 토큰 교환 (KB-67): POST /auth/login {idToken} →
  // access/refresh 저장. newMember로 온보딩/홈 분기.
  const exchange = async (): Promise<boolean> => {
    const idToken = await getAuth().currentUser?.getIdToken();
    if (!idToken) throw new Error('no firebase id token after sign-in');
    const { newMember } = await exchangeLogin(idToken);
    return newMember;
  };

  const signInWithGoogle = async () => {
    setError(null);
    setPhase('google');
    try {
      ensureGoogleConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }); // iOS no-op
      const res = await GoogleSignin.signIn();
      if (res.type === 'cancelled') {
        setPhase('idle'); // sheet closed — not an error
        return;
      }
      const idToken = res.data?.idToken;
      if (!idToken) throw new Error('google sign-in returned no idToken');
      // KB-196: Android 네이티브는 google credential에 accessToken도 요구
      // ("accessToken cannot be empty"). signIn() 반환엔 없어 getTokens()로 받는다.
      // iOS는 idToken만으로 통과하지만 accessToken 병행이 무해(회귀 없음).
      const { accessToken } = await GoogleSignin.getTokens();
      await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken, accessToken));
      console.log('[auth] firebase session (google) uid =', getAuth().currentUser?.uid);
      const newMember = await exchange();
      track(EVENTS.login_success, { provider: 'GOOGLE' }); // P-083
      setUserProps({ is_registered: true }); // P-144: NRU 기준(false→true 전환)
      setPhase('idle');
      onSignedIn(newMember);
    } catch (e) {
      setPhase('idle');
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return; // silent
      console.log('[auth] google error', e);
      setError(/network|NETWORK|fetch|connect/i.test(String((e as Error)?.message ?? e)) ? 'network' : 'generic');
    }
  };

  const signInWithApple = async () => {
    setError(null);
    setPhase('apple');
    try {
      // Firebase requires a nonce round-trip: Apple gets the SHA-256 hash,
      // Firebase gets the raw value to verify the identityToken binding.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      // EMAIL only — 실명은 수집하지 않는다 (2026-07-09 정책; 표시명은 온보딩 닉네임)
      const c = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      if (!c.identityToken) throw new Error('apple sign-in returned no identityToken');
      await signInWithCredential(getAuth(), AppleAuthProvider.credential(c.identityToken, rawNonce));
      console.log('[auth] firebase session (apple) uid =', getAuth().currentUser?.uid);
      const newMember = await exchange();
      track(EVENTS.login_success, { provider: 'APPLE' }); // P-083
      setUserProps({ is_registered: true }); // P-144
      setPhase('idle');
      onSignedIn(newMember);
    } catch (e) {
      setPhase('idle');
      const code = (e as { code?: string })?.code ?? '';
      if (code === 'ERR_REQUEST_CANCELED') return; // sheet closed — silent
      console.log('[auth] apple error', e);
      setError(/network|NETWORK/i.test(String((e as Error)?.message ?? e)) ? 'network' : 'generic');
    }
  };

  return {
    phase, // which provider is mid-flight (drives per-button spinners)
    error,
    clearError: () => setError(null),
    // Apple sign-in exists on iOS only; the login screen hides the button elsewhere.
    appleAvailable: Platform.OS === 'ios',
    signInWithGoogle,
    signInWithApple,
  };
}
