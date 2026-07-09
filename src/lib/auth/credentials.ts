/**
 * auth/credentials.ts — what happens AFTER a social sheet succeeds (KB-109).
 *
 * Scope (2026-07-08 회의): the BE auth contract (code hand-off / JWT exchange)
 * is NOT decided, so this module goes exactly as far as "credential acquired":
 *   - console.log the payload (device verification, DoD)
 *   - park it in SecureStore so the values survive a reload while testing
 *   - submitAuthCredential(): STUB — the single seam the real BE exchange will
 *     fill in. Callers already await it, so wiring the contract later means
 *     changing THIS file only (then setAuthToken() with the returned JWT).
 */
import * as SecureStore from 'expo-secure-store';

export type AuthProvider = 'google' | 'apple';

/** What each provider's client flow yields. All fields optional except provider —
 *  google gives code/idToken/accessToken depending on flow; apple gives
 *  identityToken + authorizationCode (+ name/email on FIRST grant only). */
export interface AuthCredential {
  provider: AuthProvider;
  authorizationCode?: string | null;
  idToken?: string | null; // google id_token / apple identityToken
  accessToken?: string | null;
  /** Apple sends fullName/email only on the very first authorization — forward
   *  them to the BE on first sign-in or they're gone for good. */
  fullName?: string | null;
  email?: string | null;
}

const STORE_KEY = 'kbap.auth.pendingCredential.v1';

/**
 * STUB — BE hand-off (contract TBD). When the auth endpoints land this becomes:
 *   POST /auth/{provider} { …payload } → { jwt } → setAuthToken(jwt).
 * Until then: log + park locally so device testing can verify acquisition.
 */
export async function submitAuthCredential(credential: AuthCredential): Promise<void> {
  // DoD: 실기기에서 코드/토큰 획득 확인용 로그 (BE 계약 확정 전까지 유지)
  console.log('[auth] credential acquired', {
    provider: credential.provider,
    authorizationCode: credential.authorizationCode?.slice(0, 12).concat('…') ?? null,
    idToken: credential.idToken?.slice(0, 12).concat('…') ?? null,
    accessToken: credential.accessToken ? '(present)' : null,
    email: credential.email ?? null,
  });
  try {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(credential));
  } catch {
    // SecureStore unavailable (web) — memory-only is fine for the stub.
  }
}

/** Testing helper: read back the parked credential (device verification). */
export async function peekPendingCredential(): Promise<AuthCredential | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    return raw ? (JSON.parse(raw) as AuthCredential) : null;
  } catch {
    return null;
  }
}
