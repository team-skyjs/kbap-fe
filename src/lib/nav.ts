/**
 * nav.ts — 온보딩 진입 스택 리셋 (P-088④/KB-261).
 *
 * 실기 재현: 탈퇴→재가입 온보딩 중 iOS 스와이프 백으로 탈퇴 전 화면 스택에
 * 복귀했다 — 온보딩 진입은 **항상 스택 리셋**(dismissAll + replace)으로, push
 * 잔여 스택을 남기지 않는다. (스와이프 백 제스처 자체는 _layout의
 * gestureEnabled:false가 차단 — 이중 방어.)
 */
import type { Href, useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

export function resetToOnboarding(router: Router): void {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    /* 스택 밖(모달 없음 등) — 무시 */
  }
  router.replace('/onboarding' as Href);
}
