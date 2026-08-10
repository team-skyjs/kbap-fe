/**
 * appleRevoke.ts — KB-162 탈퇴 시 애플 재인증 + 토큰 revoke (경로 A, 심사 요건).
 *
 * App Store 심사: "Sign in with Apple" 계정은 삭제 시 토큰 revoke 가 필수.
 * 흐름: 애플 시트 재호출(로그인과 같은 expo-apple-authentication 경로)
 *   → credential.user(sub)를 현재 Firebase apple.com providerData.uid 와 대조
 *   → 일치할 때만 authorizationCode(수명 5분)로 즉시 revokeToken
 *   → 성공해야 탈퇴 API 로 진행. **revoke 없는 탈퇴를 만들지 않는다** —
 *     취소/타계정/실패는 전부 탈퇴 중단 (호출부 delete-account.tsx).
 *
 * 로그인과 달리 Firebase credential 을 만들지 않으므로 nonce/scope 불필요 —
 * signInWithCredential 호출 금지 (타계정이면 앱 세션이 갈아타진다).
 * ⚠️ NATIVE ONLY (iOS) — 웹 번들에서 import 금지 (RNFB·apple-auth 네이티브).
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import { getAuth, revokeToken } from '@react-native-firebase/auth';

/** 애플 링크 존재 여부 — providerData 기준. */
export function isAppleUser(providerData: ReadonlyArray<{ providerId: string }>): boolean {
  return providerData.some((p) => p.providerId === 'apple.com');
}

/**
 * ⚠️ 폐기(P-147, 8/10 실사례) — **게이트 판별에 쓰지 말 것**: 탈퇴가 Firebase
 * 유저를 안 지워 과거 애플 링크가 잔존 + 같은 이메일 구글 재가입 시 동일 계정
 * 재결합 → 구글 회원을 애플로 오판. 게이트 정본 = 서버 profile.provider
 * (delete-account.tsx). 이 함수는 provider drift 진단 로그 전용으로만 남긴다.
 */
export function currentIsAppleUser(): boolean {
  return isAppleUser(getAuth().currentUser?.providerData ?? []);
}

export type AppleReauthCheck = { ok: true; code: string } | { ok: false; reason: 'mismatch' | 'no-code' };

/**
 * 재인증 credential 검증 — 타계정 거부(user/sub 대조) 후 code 추출.
 * 어느 쪽이든 식별자가 없어 대조 불가면 거부 — 불확실하면 진행하지 않는다.
 */
export function checkAppleReauth(
  c: { user?: string | null; authorizationCode?: string | null },
  currentSub: string | null | undefined,
): AppleReauthCheck {
  if (!c.user || !currentSub || c.user !== currentSub) return { ok: false, reason: 'mismatch' };
  if (!c.authorizationCode) return { ok: false, reason: 'no-code' };
  return { ok: true, code: c.authorizationCode };
}

export type AppleRevokeResult = 'revoked' | 'cancelled' | 'mismatch' | 'failed';

/** 애플 시트 재호출 → 본인 대조 → revoke. 'revoked' 일 때만 탈퇴 진행할 것. */
export async function reauthAndRevokeApple(): Promise<AppleRevokeResult> {
  let c: AppleAuthentication.AppleAuthenticationCredential;
  try {
    c = await AppleAuthentication.signInAsync();
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return 'cancelled'; // 시트 닫음
    console.log('[auth] apple reauth error', e);
    return 'failed';
  }
  const currentSub = getAuth().currentUser?.providerData.find((p) => p.providerId === 'apple.com')?.uid;
  const check = checkAppleReauth(c, currentSub);
  if (!check.ok) {
    console.log('[auth] apple reauth rejected:', check.reason);
    return check.reason === 'mismatch' ? 'mismatch' : 'failed';
  }
  try {
    await revokeToken(getAuth(), check.code); // code 수명 5분 — 검증 직후 즉시
    console.log('[auth] apple token revoked');
    return 'revoked';
  } catch (e) {
    console.log('[auth] apple revoke failed', e);
    return 'failed';
  }
}
