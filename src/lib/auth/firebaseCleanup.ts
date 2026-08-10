/**
 * firebaseCleanup.ts (P-147) — 탈퇴 성공 후 Firebase 계정 잔재 정리 (best effort).
 *
 * 배경(8/10 실사례): 탈퇴가 BE 계정만 지우고 Firebase 유저를 남겨, 과거 애플
 * 로그인 링크(providerData apple.com)가 잔존 → 같은 이메일 구글 재가입 시
 * Firebase가 동일 계정에 재결합 → 탈퇴 게이트가 구글 회원을 애플로 오판.
 *
 * 정리: currentUser.delete() 시도 → recent-auth 요구 등으로 실패하면
 * apple.com/google.com unlink 폴백 → (signOut은 기존 session.logOut 몫).
 * **실패해도 탈퇴 흐름은 막지 않는다** — 로그만 남긴다.
 * ⚠️ NATIVE ONLY — 웹 번들에서 import 금지 (호출부 lazy require 관례).
 */
import { getAuth, unlink } from '@react-native-firebase/auth';

export async function cleanupFirebaseAccount(): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) return;
  try {
    await user.delete();
    console.log('[auth] firebase user deleted (탈퇴 클린업)');
    return;
  } catch (e) {
    console.log('[auth] firebase delete 실패(recent-auth 요구 등) — unlink 폴백:', (e as Error)?.message ?? e);
  }
  for (const pid of ['apple.com', 'google.com']) {
    if (!user.providerData.some((p) => p.providerId === pid)) continue;
    try {
      await unlink(user, pid);
      console.log('[auth] firebase unlink:', pid);
    } catch (e) {
      console.log('[auth] firebase unlink 실패:', pid, (e as Error)?.message ?? e);
    }
  }
}
