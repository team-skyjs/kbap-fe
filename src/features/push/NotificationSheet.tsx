/**
 * NotificationSheet (KB-497) — 알림 관련 하단 시트 1종.
 *
 * - variant="primer": OS 알림 권한 사전 안내(스캔 결과 직후). 제목·본문·「알림 켜기」·「나중에」.
 * - variant="consent": 광고성 동의 2종(마케팅 목적 개인정보 수집·이용 / 광고성 정보 수신)
 *   체크 + 전문 링크. 확인은 둘 다 체크된 경우에만 활성(FR-005) — 색·불투명도만 바뀐다.
 *
 * KB-553: Modal은 fade(딤만) — Modal slide는 딤 레이어까지 시트와 함께 밀어 올려 부자연(실기 지적).
 * 시트 슬라이드는 공용 훅 useSheetSwipeDismiss가 담당: animateIn(아래에서 스프링 등장) · 핸들·제목 드래그
 * (임계 통과 = 퇴장 후 onClose, 미만 = 복귀) · dismiss(스크림·나중에·확인·백버튼 닫힘도 슬라이드 다운).
 * open=false가 되면 퇴장 애니메이션이 끝난 뒤 Modal을 내린다(visible 지연).
 * 제스처 영역 = 시트 전체(9/14 종한): 이 시트는 본문 스크롤이 없어 P-337의 "핸들+제목 한정" 사유(리스트 스크롤
 * 충돌)가 없다. Pan은 이동 후에만 활성화되므로 체크박스·전문 링크·버튼 탭은 그대로 먹는다.
 * 확인 버튼 = useSubmitGuard + Btn busy(공용 제출 가드). 시안: 피그마 「KB-497 알림 설정 시안」 2·3.
 */
import * as React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSheetSwipeDismiss } from '@/components/useSheetSwipeDismiss';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, shadow } from '@/lib/theme';
import { Btn } from '@/components/Btn';
import { IconCheck } from '@/components/icons';
import { useBottomInset } from '@/lib/useBottomInset';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { openWebPage } from '@/lib/openExternal';
import { consentUrl, type ConsentKind } from '@/lib/push/consent';

export interface ConsentChecks {
  privacy: boolean;
  receive: boolean;
}

export function NotificationSheet({
  open,
  variant,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  variant: 'primer' | 'consent';
  title: string;
  body: string;
  confirmLabel: string;
  /** consent 변형은 두 체크가 모두 true인 상태로만 호출된다. */
  onConfirm: (consents?: ConsentChecks) => Promise<void> | void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { busy, run } = useSubmitGuard();
  const bottom = useBottomInset();
  // 마운트 유지형 — open 전환 시 훅이 아래에서 등장(animateIn)·잔존 드래그 리셋(FR-007)
  const swipe = useSheetSwipeDismiss(onClose, open, { animateIn: true });
  // 닫힘 경로 전부(나중에·확인·스크림·백버튼·드래그) = 시트 슬라이드 다운 → Modal fade-out. 드래그로 이미 내려갔으면 즉시.
  const [visible, setVisible] = React.useState(open);
  React.useEffect(() => {
    if (open) setVisible(true);
    else if (visible) swipe.dismiss(() => setVisible(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open 전환에만 반응
  }, [open]);
  const sheetPad = Platform.OS === 'android' ? { paddingBottom: 18 + bottom } : null;
  const [checks, setChecks] = React.useState<ConsentChecks>({ privacy: false, receive: false });
  React.useEffect(() => {
    if (!open) setChecks({ privacy: false, receive: false }); // 닫히면 pending 체크 폐기(data-model §2)
  }, [open]);

  const needsConsent = variant === 'consent';
  const ready = !needsConsent || (checks.privacy && checks.receive);

  const confirm = () => {
    if (!ready) return; // 비활성 — 색만 다르고 탭은 무동작(FR-005)
    void run(async () => {
      await onConfirm(needsConsent ? checks : undefined);
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Codex #98 3R P2: Modal = 안드 별도 네이티브 루트 — 자체 GestureHandlerRootView 필수 */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.root}>
        {/* P-337: 딤 전용 레이어 — 시트 컨테이너에 걸면 시트도 바랜다 */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, swipe.dimStyle]} pointerEvents="none" />
        <Pressable style={{ flex: 1 }} onPress={onClose} testID="notif-sheet-backdrop" />
        <GestureDetector gesture={swipe.gesture}>
        <Animated.View style={[styles.sheet, sheetPad, swipe.sheetStyle]} onLayout={swipe.onSheetLayout} testID={`notif-sheet-${variant}`}>
          <View style={styles.handle} testID="notif-sheet-grab" />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          {needsConsent && (
            <View style={styles.consents}>
              <ConsentRow
                kind="privacy"
                label={t('push.privacyConsent')}
                checked={checks.privacy}
                onToggle={() => setChecks((c) => ({ ...c, privacy: !c.privacy }))}
              />
              <View style={styles.hair} />
              <ConsentRow
                kind="receive"
                label={t('push.receiveConsent')}
                checked={checks.receive}
                onToggle={() => setChecks((c) => ({ ...c, receive: !c.receive }))}
              />
            </View>
          )}
          <View style={styles.actions}>
            <Btn busy={busy} disabled={!ready} onPress={confirm} testID="notif-sheet-confirm">
              {confirmLabel}
            </Btn>
            <Pressable onPress={onClose} hitSlop={10} testID="notif-sheet-later">
              <Text style={styles.later}>{t('push.primerLater')}</Text>
            </Pressable>
          </View>
        </Animated.View>
        </GestureDetector>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** 체크 행 — 체크박스는 고정 슬롯(20×20·보더 동일), 상태로 바뀌는 건 색·아이콘 표시만(P-151). */
function ConsentRow({ kind, label, checked, onToggle }: { kind: ConsentKind; label: string; checked: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Pressable style={styles.rowMain} onPress={onToggle} hitSlop={6} testID={`consent-${kind}`} accessibilityRole="checkbox" accessibilityState={{ checked }}>
        <View style={[styles.box, checked && styles.boxOn]} testID={`consent-${kind}-box`}>
          <View style={[styles.boxIcon, !checked && styles.boxIconHidden]}>
            <IconCheck size={14} color="#fff" />
          </View>
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </Pressable>
      <Pressable onPress={() => void openWebPage(consentUrl(kind))} hitSlop={8} testID={`consent-${kind}-full`}>
        <Text style={styles.viewFull}>{t('notif.viewFull')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 34,
    paddingHorizontal: 20,
    gap: 12,
    ...shadow.sh2,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 6 },
  title: { fontFamily: font.bodyBold, fontSize: 18, color: C.ink, lineHeight: 25 },
  body: { fontFamily: font.body, fontSize: 14, color: C.ink3, lineHeight: 20 },
  consents: { backgroundColor: C.surface2, borderRadius: 16, paddingHorizontal: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { flex: 1, fontFamily: font.bodyBold, fontSize: 14, color: C.ink, lineHeight: 19 },
  hair: { height: 1, backgroundColor: C.hair },
  // 체크박스: 미선택도 같은 폭 보더로 자리 유지 — 상태로 바뀌는 건 색만(P-151)
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: C.primary, backgroundColor: C.primary },
  boxIcon: { opacity: 1 },
  boxIconHidden: { opacity: 0 },
  viewFull: { fontFamily: font.bodyBold, fontSize: 12, color: C.primaryText, padding: 4 },
  actions: { gap: 6, marginTop: 4 },
  later: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2, padding: 8, textAlign: 'center' },
});
