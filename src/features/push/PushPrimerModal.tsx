/**
 * PushPrimerModal (P-192/KB-39 → KB-497 시트화) — 푸시 권한 **사전 안내**. 이름·props는 호환용,
 * 실제 표면은 NotificationSheet(variant=primer, 하단 시트 — 피그마 「KB-497 알림 설정 시안」 2).
 *
 * iOS OS 팝업은 1회성이라 바로 띄우지 않는다 — 「알림 켜기」 수락 시에만 requestPermission()
 * (OS 팝업) → 토큰 등록(세션 있을 때만, KB-543) → 회원이면 PATCH activity:true(서버 기본 false —
 * 이 저장이 없으면 정보성 알림이 0건). 거절(나중에)은 기록만, 재노출 0(설정 화면에서 켤 수 있음).
 * 진입점 = 스캔 결과 직후 1회(코치마크와 직렬화, KB-377). 온보딩 진입점은 제거(KB-497, UX 리서치 B안).
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationSheet } from '@/features/push/NotificationSheet';
import { markPrimerResult, registerPushToken, requestPermission } from '@/lib/push/pushAdapter';
import { hasBeSession } from '@/lib/auth/beAuth';
import { patchNotificationSettings } from '@/lib/data/useNotificationSettings';
import { EVENTS, track } from '@/lib/analytics';

export function PushPrimerModal({
  open,
  onDone,
  surface,
}: {
  open: boolean;
  onDone: () => void;
  /** P-214: 노출 표면 — 승낙률 비교. KB-497: 스캔 결과만 남음. */
  surface: 'scan';
}) {
  const { t } = useTranslation();

  const accept = async () => {
    track(EVENTS.push_primer_response, { action: 'accept', surface }); // P-214
    await markPrimerResult('accepted');
    const granted = await requestPermission(); // 여기서만 OS 팝업
    if (granted) {
      await registerPushToken();
      if (await hasBeSession()) {
        // 응답 지연 중 사용자가 설정에서 끈 값을 되돌리지 않도록 seq 공유(useNotificationSettings)
        await patchNotificationSettings({ activity: true }).catch(() => {}); // 실패 = 설정 화면에서 직접 켤 수 있음
      }
    }
    onDone();
  };
  const decline = () => {
    track(EVENTS.push_primer_response, { action: 'later', surface }); // P-214
    void markPrimerResult('declined').finally(onDone);
  };

  return (
    <NotificationSheet
      open={open}
      variant="primer"
      title={t('push.primerTitle')}
      body={t('push.primerBody')}
      confirmLabel={t('push.primerYes')}
      onConfirm={accept}
      onClose={decline}
    />
  );
}
