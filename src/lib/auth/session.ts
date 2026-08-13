/**
 * auth/session.ts — Firebase Auth session (KB-109, 2026-07-10 결정).
 *
 * 자체 BE JWT 대신 Firebase Authentication이 인증의 원천: 로그인 상태는
 * onAuthStateChanged, API 요청의 Authorization 헤더는 currentUser.getIdToken()
 * (SDK가 만료 갱신을 자동 처리). BE는 Admin SDK로 검증만 한다.
 *
 * ⚠️ NATIVE ONLY — @react-native-firebase has no web runtime here. The token
 * provider is installed from the root layout behind a Platform guard; the web
 * export never executes this module.
 */
import { getAuth, onAuthStateChanged, signOut } from '@react-native-firebase/auth';
import { setSentryUser } from '@/lib/sentry';

/** Firebase user, derived from the modular API (namespaced types mismatch it). */
export type AuthUser = NonNullable<ReturnType<typeof getAuth>['currentUser']>;

// NOTE (KB-67): API Authorization은 이제 BE accessToken(auth/beAuth.ts) —
// Firebase ID토큰을 요청마다 부착하던 KB-109 구조는 제거됨. 이 모듈은
// Firebase 세션 유틸(구독/로그아웃)만 담당한다.

/** Subscribe to sign-in state. Returns the unsubscribe function. */
export function subscribeAuth(cb: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(getAuth(), cb);
}

/** Current Firebase user (null when signed out). */
export function currentUser(): AuthUser | null {
  return getAuth().currentUser;
}

/** 로그아웃 — Firebase 세션 종료. (탈퇴 revoke는 추후 BE와 — KB-109) */
export async function logOut(): Promise<void> {
  setSentryUser(null); // P-197: 식별 해제 — 로그아웃 후 이벤트에 memberId 잔존 방지
  await signOut(getAuth());
}
