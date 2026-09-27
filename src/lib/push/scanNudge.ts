/**
 * scanNudge (2026-09-28, 종한 결정 — 리뷰 리마인더 서버 전환 후속) — 스캔 결과 직후 알림 유도 판정.
 *
 * 리마인더·리뷰 반응은 서버 배치가 보내므로 OS 권한 + 서버 활동 알림(activity)이 둘 다 켜져야 도달한다.
 * 판정(우선순위 순):
 *  - OS 거부(denied)            → 'osDenied'   : 「기기 설정 열기」. 매 스캔마다(재노출 억제 없음).
 *  - OS 허용 + 서버 activity false → 'activityOff': 「알림 켜기」= PATCH activity:true. 매 스캔마다.
 *  - 그 외(미결정·unavailable)   → 기존 프라이머 1회 규칙(getPrimerResult null일 때만 'primer').
 * OS 미결정은 로그인 화면 OS 팝업(KB-631)이 담당 — 여기서 새 표면을 만들지 않는다.
 * 게스트는 서버 설정이 없고 토큰도 등록되지 않으므로 osDenied·activityOff를 띄우지 않는다(기존 프라이머만).
 * 「나중에」 = 그 시점에 닫기만 — 기록·억제 없음(종한 확정 9/28).
 */
import { AppState } from 'react-native';
import { queryClient } from '@/lib/queryClient';
import { fetchNotificationSettings, NOTIF_SETTINGS_KEY, patchNotificationSettings, type NotificationSettings } from '@/lib/data/useNotificationSettings';
import { getPermissionStatus, getPrimerResult, registerPushToken } from '@/lib/push/pushAdapter';

export type ScanNudgeMode = 'primer' | 'osDenied' | 'activityOff';

export async function decideScanNudge(isGuest: boolean): Promise<ScanNudgeMode | null> {
  const status = await getPermissionStatus();
  if (!isGuest && status === 'denied') return 'osDenied';
  if (!isGuest && status === 'granted') {
    // 서버 정본 — 캐시가 있으면 재사용, 없으면 1회 조회. 조회 실패 = 유도 안 함(보수적).
    const s = await queryClient
      .fetchQuery<NotificationSettings>({ queryKey: NOTIF_SETTINGS_KEY, queryFn: fetchNotificationSettings, staleTime: 60_000 })
      .catch(() => null);
    return s?.activity === false ? 'activityOff' : null;
  }
  return (await getPrimerResult()) == null ? 'primer' : null;
}

/**
 * osDenied 시트 「기기 설정 열기」 직전에 호출 — 설정 앱에서 돌아온(AppState active) 첫 1회에 권한이 granted로
 * 바뀌었으면 토큰 등록 + PATCH activity:true(프라이머 수락과 같은 기본값). 여전히 denied면 아무것도 하지 않는다
 * (다음 스캔에서 재유도). 9/28 실기: 이 처리가 없으면 OS에서 켜고 돌아와도 활동 알림 토글이 OFF로 남는다.
 */
export function finishAfterOsSettings(): void {
  const sub = AppState.addEventListener('change', (st) => {
    if (st !== 'active') return;
    sub.remove();
    void (async () => {
      if ((await getPermissionStatus()) !== 'granted') return;
      await registerPushToken();
      await patchNotificationSettings({ activity: true }).catch(() => {}); // 실패 = 설정 화면에서 직접 켤 수 있음
    })();
  });
}
