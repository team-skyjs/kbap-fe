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

/**
 * openNotificationRoute (KB-573, 2026-09-16 종한 확정) — 푸시 탭·알림함 항목 탭 **공용** 이동.
 * 홈('/(tabs)') = 스택 리셋(dismissAll, 뒤로 가기 대상 없음) + 탭 점프(navigate) ·
 * 그 외 = navigate(맨 위가 같은 화면이면 재사용 — 서로 다른 알림 연속 탭에도 1장).
 * expo-router 56 StackRouter는 getId 없으면 name이 현재 최상단과 다를 때 push·navigate 모두
 * 새로 쌓는다 — 홈은 dismissAll 선행이 필수(research R-2). 매핑 자체는 pushAdapter routeForNotificationData.
 */
export function openNotificationRoute(router: Router, href: string): void {
  if (href === '/(tabs)') {
    try {
      if (router.canDismiss()) router.dismissAll();
    } catch {
      /* 스택 밖(모달 없음 등) — 무시 */
    }
  }
  router.navigate(href as Href);
}
