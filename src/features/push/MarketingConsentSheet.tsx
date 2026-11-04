/**
 * MarketingConsentSheet (KB-979) — 홈·알림함 광고성 동의 시트. 기존 NotificationSheet consent 변형 + 새 제목·본문.
 * 확인 = 설정 화면과 같은 PATCH(MARKETING_CONSENT_PATCH) → OS 권한 `undetermined`면 요청 → 허용 시 토큰 등록 → 닫기
 * (PushPrimerModal.accept와 같은 순서: 시트가 열린 채 OS 팝업). PATCH 실패 = 오류 토스트 후 닫기(OS 팝업 0 — 다음 기회에 다시 묻는다).
 * 동의되면 PATCH 응답이 설정 캐시를 교체해 알림함은 다음 포커스부터 자동 미노출.
 */
import * as React from 'react';
import { Platform } from 'react-native';
import { useFocusEffect, useNavigation, type NativeStackNavigationProp } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { NotificationSheet } from '@/features/push/NotificationSheet';
import { showTopToast } from '@/components/topToastStore';
import { FLAGS } from '@/lib/flags';
import { MARKETING_CONSENT_PATCH } from '@/lib/push/consent';
import { patchNotificationSettings, useNotificationSettings } from '@/lib/data/useNotificationSettings';
import { getPermissionStatus, registerPushToken, requestPermission } from '@/lib/push/pushAdapter';
import { isOccluded, subscribeOcclusion } from '@/lib/engagement/occlusion';
import { isMarketingConsentActive, isUnconsented, setMarketingConsentActive } from '@/features/push/marketingConsentPrompt';
import { markPromptShown } from '@/lib/engagement/promptSlot';

type Surface = 'home' | 'inbox';

export function MarketingConsentSheet({ open, surface, onClose, onDismiss }: { open: boolean; surface: Surface; onClose: () => void; onDismiss?: () => void }) {
  const { t } = useTranslation();
  const confirm = async () => {
    try {
      await patchNotificationSettings(MARKETING_CONSENT_PATCH);
    } catch {
      showTopToast(t('notif.saveFailed'), { error: true });
      onClose();
      return;
    }
    if ((await getPermissionStatus()) === 'undetermined' && (await requestPermission())) await registerPushToken();
    onClose();
  };
  return (
    <NotificationSheet
      open={open}
      variant="consent"
      consentSurface={surface}
      title={t('push.consentPromptTitle')}
      body={t('push.consentPromptBody')}
      confirmLabel={t('push.consentConfirm')}
      onConfirm={confirm}
      onClose={onClose}
      onDismiss={onDismiss}
    />
  );
}

/** 열림/닫힘 + 닫힘 완료 뒤 done(iOS = onDismiss, Android = 즉시 — usePackagedCoach와 같은 순서) + 활성 플래그 */
export function useMarketingConsentSheet(surface: Surface) {
  const [open, setOpen] = React.useState(false);
  const pending = React.useRef<{ done?: () => void } | null>(null);
  const settle = React.useCallback(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setMarketingConsentActive(false);
    p.done?.();
  }, []);
  // 포커스 효과 deps에 들어가므로 identity 고정
  const show = React.useCallback((done?: () => void) => {
    pending.current = { done };
    setMarketingConsentActive(true);
    markPromptShown(); // KB-986
    setOpen(true);
  }, []);
  /** 블러 — 떠 있으면 닫고 즉시 풀어 준다(#398 Codex 선례: 목적지 위에 남지 않게). 계측 없음(계획 A-4) */
  const abort = React.useCallback(() => {
    if (!pending.current) return;
    setOpen(false);
    settle();
  }, [settle]);
  const close = () => {
    setOpen(false);
    if (Platform.OS !== 'ios') settle();
  };
  return { show, abort, props: { open, surface, onClose: close, onDismiss: Platform.OS === 'ios' ? settle : undefined } };
}

/**
 * 알림함 — 미동의 회원에게 포커스마다 1회. 진입 push·자식 화면 복귀 모두 native-stack `transitionEnd {closing:false}` 뒤에 연다
 * (전환 중 Modal present = iOS 교착 KB-377. RN 0.85의 InteractionManager.runAfterInteractions는 전환을 기다리지 않는다).
 * 다른 덮개가 떠 있으면 풀릴 때까지 기다린다. 회원 분기에서만 마운트(게스트 = 설정 GET 0).
 */
export function InboxMarketingConsent() {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const query = useNotificationSettings(FLAGS.pushEnabled); // staleTime 0 — 진입마다 서버 재확인
  const { show, abort, props } = useMarketingConsentSheet('inbox');
  const [settled, setSettled] = React.useState(false);
  const clear = React.useSyncExternalStore(subscribeOcclusion, () => !isOccluded());
  const shown = React.useRef(false);
  const focusedAt = React.useRef(Number.POSITIVE_INFINITY);
  const refetch = query.refetch;
  React.useEffect(() => navigation.addListener('transitionEnd', (e) => { if (!e.data.closing) setSettled(true); }), [navigation]);
  // #416 Codex P2: 자식 화면 밑에 살아 있다 복귀해도 재조회(전역 refetchOnWindowFocus=false) — 첫 GET 실패도 복귀 때 재시도
  useFocusEffect(
    React.useCallback(() => {
      focusedAt.current = Date.now();
      void refetch();
      return () => {
        setSettled(false);
        shown.current = false;
        abort();
      };
    }, [abort, refetch]),
  );
  // 이번 포커스 이후 받은 성공 응답만(캐시된 옛 값으로 판정 금지 — 재가입 등은 서버가 정본). ref 비교는 effect 안에서(react-hooks/refs)
  const due = settled && clear && query.isSuccess && isUnconsented(query.data);
  const updatedAt = query.dataUpdatedAt;
  React.useEffect(() => {
    if (!due || updatedAt < focusedAt.current || shown.current || isMarketingConsentActive()) return;
    shown.current = true;
    show();
  }, [due, updatedAt, show]);
  return <MarketingConsentSheet {...props} />;
}
