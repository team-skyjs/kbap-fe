/**
 * NotificationSheet (KB-497) — 알림 관련 하단 시트 1종.
 *
 * - variant="primer": OS 알림 권한 사전 안내(스캔 결과 직후). 제목·본문·「알림 켜기」·「나중에」.
 * - variant="consent": 광고성 동의 2종(마케팅 목적 개인정보 수집·이용 / 광고성 정보 수신)
 *   체크 + 전문 링크. 확인은 둘 다 체크된 경우에만 활성(FR-005) — 색·불투명도만 바뀐다.
 *
 * KB-553: Modal slide(등장 슬라이드 업·스크림/나중에/백버튼 닫힘 = 슬라이드 다운) + 공용 훅
 * useSheetSwipeDismiss(핸들·제목 드래그 → 임계 통과 시 퇴장 후 onClose, 미만 = 스프링 복귀, 딤 비례 페이드)
 * — 선례 LegalSheet/TagPickerSheet/OrderDishPickerSheet와 같은 골격. 제스처 영역 = 핸들+제목(P-337).
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
  // 마운트 유지형(visible=open) — open 전환 시 훅이 translateY 리셋(FR-007)
  const swipe = useSheetSwipeDismiss(onClose, open);
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
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      {/* Codex #98 3R P2: Modal = 안드 별도 네이티브 루트 — 자체 GestureHandlerRootView 필수 */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.root}>
        {/* P-337: 딤 전용 레이어 — 시트 컨테이너에 걸면 시트도 바랜다 */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, swipe.dimStyle]} pointerEvents="none" />
        <Pressable style={{ flex: 1 }} onPress={onClose} testID="notif-sheet-backdrop" />
        <Animated.View style={[styles.sheet, sheetPad, swipe.sheetStyle]} onLayout={swipe.onSheetLayout} testID={`notif-sheet-${variant}`}>
          <GestureDetector gesture={swipe.gesture}>
            <View>{/* P-337 제스처 영역 = 핸들 + 제목(본문·체크 행·버튼은 밖 — 탭 충돌 0) */}
              <View style={styles.handle} testID="notif-sheet-grab" />
              <Text style={styles.title}>{title}</Text>
            </View>
          </GestureDetector>
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
