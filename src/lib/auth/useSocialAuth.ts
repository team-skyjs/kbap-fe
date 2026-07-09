/**
 * useSocialAuth — client-side OAuth acquisition for the two providers (KB-109).
 *
 *   google → expo-auth-session Google provider (system sheet → PKCE exchange
 *            handled by the provider) → id_token/access_token (+ raw code)
 *   apple  → expo-apple-authentication → identityToken + authorizationCode
 *
 * Both funnel into submitAuthCredential() (BE stub — KB-109 scope ends at
 * acquisition). Cancel is NOT an error: the user closing the sheet returns the
 * screen to idle silently. Real failures set `error` for the login screen's
 * error line ('network' vs 'generic' so the copy can differ).
 *
 * ⚠️ Google needs an iOS OAuth client ID (Google Cloud Console, bundle id
 * com.rocher.kbap) provided as EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. Missing →
 * the button reports a generic error and logs the reason (블락 — KB-109).
 */
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { submitAuthCredential } from './credentials';

// Completes a pending auth session when the app is reopened via redirect (web/
// dismissed-sheet edge). No-op on native cold paths.
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export type AuthErrorKind = 'network' | 'generic';
export type AuthPhase = 'idle' | 'google' | 'apple';

export function useSocialAuth(onSignedIn: () => void) {
  const [phase, setPhase] = useState<AuthPhase>('idle');
  const [error, setError] = useState<AuthErrorKind | null>(null);
  // onSignedIn fires from a response effect; keep the latest callback without
  // re-running the effect when the parent re-renders.
  const signedInRef = useRef(onSignedIn);
  signedInRef.current = onSignedIn;

  const [googleRequest, googleResponse, googlePrompt] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    // The provider hook THROWS at render if the current platform has no client
    // id — give it a placeholder so screens render before credentials exist.
    // signInWithGoogle() still hard-guards on the real env id before prompting.
    clientId: GOOGLE_IOS_CLIENT_ID || 'unset.apps.googleusercontent.com',
    scopes: ['openid', 'profile', 'email'],
  });

  // Google resolves via response object (the sheet is out-of-process).
  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'success') {
      const auth = googleResponse.authentication;
      void submitAuthCredential({
        provider: 'google',
        authorizationCode: googleResponse.params?.code ?? null,
        idToken: auth?.idToken ?? null,
        accessToken: auth?.accessToken ?? null,
      }).then(() => {
        setPhase('idle');
        signedInRef.current();
      });
    } else if (googleResponse.type === 'cancel' || googleResponse.type === 'dismiss') {
      setPhase('idle'); // user closed the sheet — not an error
    } else if (googleResponse.type === 'error') {
      console.log('[auth] google error', googleResponse.error?.message);
      setPhase('idle');
      setError(/network|fetch|connect/i.test(googleResponse.error?.message ?? '') ? 'network' : 'generic');
    }
  }, [googleResponse]);

  const signInWithGoogle = async () => {
    setError(null);
    if (!GOOGLE_IOS_CLIENT_ID) {
      // 블락(KB-109): iOS OAuth 클라이언트 ID 미발급 — Google Cloud Console에서
      // bundle id com.rocher.kbap로 생성 후 EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID 주입.
      console.log('[auth] google blocked: EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is not set');
      setError('generic');
      return;
    }
    setPhase('google');
    try {
      await googlePrompt();
      // outcome lands in the googleResponse effect above
    } catch (e) {
      console.log('[auth] google prompt failed', e);
      setPhase('idle');
      setError('network');
    }
  };

  const signInWithApple = async () => {
    setError(null);
    setPhase('apple');
    try {
      // EMAIL only — 실명은 수집하지 않는다 (2026-07-09 정책; 표시명은 온보딩 닉네임)
      const c = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      await submitAuthCredential({
        provider: 'apple',
        authorizationCode: c.authorizationCode,
        idToken: c.identityToken,
        email: c.email ?? null,
      });
      setPhase('idle');
      signedInRef.current();
    } catch (e) {
      setPhase('idle');
      const code = (e as { code?: string })?.code ?? '';
      if (code === 'ERR_REQUEST_CANCELED') return; // sheet closed — silent
      console.log('[auth] apple error', e);
      setError('generic');
    }
  };

  return {
    phase, // which provider is mid-flight (drives per-button spinners)
    error,
    clearError: () => setError(null),
    // Apple sign-in exists on iOS only; the login screen hides the button elsewhere.
    appleAvailable: Platform.OS === 'ios',
    googleReady: !!googleRequest,
    signInWithGoogle,
    signInWithApple,
  };
}
