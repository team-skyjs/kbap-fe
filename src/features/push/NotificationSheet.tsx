/**
 * NotificationSheet (KB-497) — 알림 관련 하단 시트 1종.
 *
 * - variant="primer": OS 알림 권한 사전 안내(스캔 결과 직후). 제목·본문·「알림 켜기」·「나중에」.
 * - variant="consent": 광고성 동의 2종(마케팅 목적 개인정보 수집·이용 / 광고성 정보 수신)
 *   체크 + 전문 링크. 9/14 종한: 열릴 때 둘 다 **체크된 상태**로 시작, 하나만 체크된 채 확인을 누르면
 *   "둘 다 동의 필요" 안내를 고정 슬롯에 표시(색·불투명도만 — P-151)하고 onConfirm은 호출하지 않는다.
 *   ⚠ 사전 체크 상태의 광고성 수신 동의는 유효성 논쟁 소지(KISA 안내서 계열) — PR 리뷰 포인트로 기재.
 *
 * KB-553: Modal은 fade(딤만) — Modal slide는 딤 레이어까지 시트와 함께 밀어 올려 부자연(실기 지적).
 * 시트 슬라이드는 공용 훅 useSheetSwipeDismiss가 담당: animateIn(아래에서 스프링 등장) · 핸들·제목 드래그
 * (임계 통과 = 퇴장 후 onClose, 미만 = 복귀) · dismiss(스크림·나중에·확인·백버튼 닫힘도 슬라이드 다운).
 * open=false가 되면 퇴장 애니메이션이 끝난 뒤 Modal을 내린다(visible 지연).
 * 제스처 영역 = 시트 전체(9/14 종한): 이 시트는 본문 스크롤이 없어 P-337의 "핸들+제목 한정" 사유(리스트 스크롤
 * 충돌)가 없다. Pan은 이동 후에만 활성화되므로 체크박스·전문 링크·버튼 탭은 그대로 먹는다.
 * 확인 버튼 = useSubmitGuard + Btn busy(공용 제출 가드). 시안: 피그마 「KB-497 알림 설정 시안」 2·3.
 * KB-987: consent 변형만 토스 B안(흰 플랫·그림자/핸들 없음·제목 24 최대 3줄·체크 원+chevron·버튼 56) — primer는 그대로.
 */
import * as React from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { Modal } from '@/lib/engagement/occlusionSurfaces';
import { Pressable } from '@/components/Pressable';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSheetSwipeDismiss } from '@/components/useSheetSwipeDismiss';
import { Txt as Text } from '@/components/Txt';
import { useTranslation } from 'react-i18next';
import { color as C, font, shadow, radius } from '@/lib/theme';
import { Btn } from '@/components/Btn';
import { IconCheck, IconChevron } from '@/components/icons';
import { useBottomInset } from '@/lib/useBottomInset';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { openWebPage } from '@/lib/openExternal';
import { consentUrl, type ConsentKind } from '@/lib/push/consent';
import { EVENTS, track } from '@/lib/analytics';

/** KB-979: 동의 시트가 뜬 표면(계측 surface) */
export type ConsentSurface = 'home' | 'inbox' | 'settings';

export interface ConsentChecks {
  privacy: boolean;
  receive: boolean;
}

export function NotificationSheet({
  open,
  variant,
  consentSurface,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  onDismiss,
}: {
  open: boolean;
  variant: 'primer' | 'consent';
  /** consent 변형의 계측 surface(KB-979) — push_consent_view·push_consent_response에 붙는다 */
  consentSurface?: ConsentSurface;
  title: string;
  body: string;
  confirmLabel: string;
  /** consent 변형은 두 체크가 모두 true인 상태로만 호출된다. */
  onConfirm: (consents?: ConsentChecks) => Promise<void> | void;
  onClose: () => void;
  /** KB-730: 완전히 닫힌 뒤(iOS) — 일회성 모달 큐의 다음 스텝 */
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  const { busy, run } = useSubmitGuard();
  const bottom = useBottomInset();
  // 마운트 유지형 — open 전환 시 훅이 아래에서 등장(animateIn)·잔존 드래그 리셋(FR-007)
  const swipe = useSheetSwipeDismiss(onClose, open, { animateIn: true });
  // 닫힘 경로 전부(나중에·확인·스크림·백버튼·드래그) = 시트 슬라이드 다운 → Modal fade-out. 드래그로 이미 내려갔으면 즉시.
  const [visible, setVisible] = React.useState(open);
  const [closing, setClosing] = React.useState(false);
  const PRECHECKED: ConsentChecks = { privacy: true, receive: true };
  const [checks, setChecks] = React.useState<ConsentChecks>(PRECHECKED);
  const [notice, setNotice] = React.useState(false); // 하나만 체크된 채 확인 탭 → 안내
  // KB-603: 열릴 때 초기화(표시·closing·체크·안내)는 렌더 중 이전값 비교(React 공식 패턴) — 닫힘 직후가 아니라 열릴 때
  // (Codex 리뷰 #150: 닫힘 직후 리셋하면 퇴장 중 리셋값으로 확인될 수 있다). 슬라이드 다운(부수효과)만 effect.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setVisible(true);
      setClosing(false);
      setChecks(PRECHECKED);
      setNotice(false);
    }
  }
  React.useEffect(() => {
    if (!open && visible) swipe.dismiss(() => setVisible(false)); // 콜백 = 애니메이션 뒤(동기 setState 아님)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open 전환에만 반응
  }, [open]);
  // 닫힘 요청(나중에·스크림·안드 백버튼) = 훅 dismiss 경유: 슬라이드 다운 후 onClose 1회. 이미 닫히는 중이면 무시 —
  // 퇴장 중 백버튼 재입력·스와이프 퇴장 중 탭이 onClose를 두 번 부르던 경로 차단(Codex 리뷰 #150 P2).
  // 내부 시작 퇴장은 open이 그대로 true라 pointerEvents 게이트가 못 본다 → closing 상태로 즉시 무반응(Codex #150 P1).
  const needsConsent = variant === 'consent';
  const flat = needsConsent; // KB-987 B안 스타일 = consent 변형만
  const surface = consentSurface;
  // KB-979: 노출 = 열릴 때마다 1회(렌더 중 부수효과 금지 — effect)
  React.useEffect(() => {
    if (open && needsConsent) track(EVENTS.push_consent_view, { surface });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open 전환에만 반응
  }, [open]);
  const requestClose = () => {
    if (closing) return; // 닫힘 진행 중 재입력 — 이벤트도 1회만(KB-630)
    if (needsConsent && !swipe.isClosing()) track(EVENTS.push_consent_response, { action: 'later', surface }); // KB-630: primer는 PushPrimerModal이 담당 · 드래그 퇴장 중 탭 = 중복 아님
    setClosing(true);
    swipe.dismiss();
  };
  const sheetPad = Platform.OS === 'android' ? { paddingBottom: 18 + bottom } : null;
  const toggle = (kind: ConsentKind) => {
    track(EVENTS.push_consent_response, { action: checks[kind] ? 'uncheck' : 'check', target: kind, surface }); // KB-630
    setChecks((c) => ({ ...c, [kind]: !c[kind] }));
  };

  const ready = !needsConsent || (checks.privacy && checks.receive);
  // 둘 다 체크되는 순간 안내 소거 — KB-603: 렌더 중 이전값 비교
  const [prevReady, setPrevReady] = React.useState(ready);
  if (ready !== prevReady) {
    setPrevReady(ready);
    if (ready) setNotice(false);
  }

  const confirm = () => {
    if (swipe.isClosing()) return; // 스와이프 퇴장 중 확인 탭 — "나중에/끌어 닫기"를 택한 뒤 동의가 켜지면 안 된다(Codex #150 P1)
    if (!ready) {
      track(EVENTS.push_consent_response, { action: 'blocked', surface }); // KB-630
      setNotice(true); // 탭은 받되 진행 안 함 — 둘 다 동의해야 켤 수 있음을 알린다
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t('push.consentBothRequired')); // Android는 liveRegion이 읽어줌(중복 방지)
      return;
    }
    if (needsConsent) track(EVENTS.push_consent_response, { action: 'confirm', surface }); // KB-979: 표면별 동의율(노출 대비)
    void run(async () => {
      await onConfirm(needsConsent ? checks : undefined);
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={requestClose} onDismiss={onDismiss}>
      {/* Codex #98 3R P2: Modal = 안드 별도 네이티브 루트 — 자체 GestureHandlerRootView 필수 */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 퇴장 중(open=false·Modal 아직 보임)엔 스크림·시트 전부 무반응 — 닫히는 시트에서 확인이 눌리지 않게(Codex #150) */}
      <View style={styles.root} pointerEvents={open && !closing ? 'auto' : 'none'} testID="notif-sheet-root">
        {/* P-337: 딤 전용 레이어 — 시트 컨테이너에 걸면 시트도 바랜다 */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, swipe.dimStyle]} pointerEvents="none" />
        <Pressable style={{ flex: 1 }} onPress={requestClose} testID="notif-sheet-backdrop" />
        <GestureDetector gesture={swipe.gesture}>
        <Animated.View style={[flat ? styles.sheetFlat : styles.sheet, sheetPad, swipe.sheetStyle]} onLayout={swipe.onSheetLayout} testID={`notif-sheet-${variant}`}>
          {!flat && <View style={styles.handle} testID="notif-sheet-grab" />}
          {/* KB-987: 3줄 안에서 네이티브 축소(KB-856 선례) — 수동 개행 금지. 기본 글자 크기는 10개 로케일 모두 축소 없이 ≤3줄(360pt 폭 실측),
              큰글씨 상한(×1.3)에서 en·es·ru ≈0.87·id 0.80이 필요해 하한 0.8 */}
          <Text style={flat ? styles.titleFlat : styles.title} numberOfLines={flat ? 3 : undefined} adjustsFontSizeToFit={flat} minimumFontScale={flat ? 0.8 : undefined} testID="notif-sheet-title">{title}</Text>
          <Text style={flat ? styles.bodyFlat : styles.body}>{body}</Text>
          {needsConsent && (
            <View style={styles.consents} testID="notif-sheet-consents">
              <ConsentRow
                kind="privacy"
                surface={surface}
                label={t('push.privacyConsent')}
                checked={checks.privacy}
                onToggle={() => toggle('privacy')}
              />
              <ConsentRow
                kind="receive"
                surface={surface}
                label={t('push.receiveConsent')}
                checked={checks.receive}
                onToggle={() => toggle('receive')}
              />
            </View>
          )}
          {needsConsent && (
            // 고정 슬롯(항상 렌더, 불투명도만) — 안내가 뜨어도 시트 높이 불변(P-151)
            <Text
              style={[styles.notice, flat && styles.noticeFlat, !notice && styles.noticeHidden]}
              testID="notif-sheet-notice"
              accessibilityLiveRegion="polite"
              accessibilityElementsHidden={!notice}
              importantForAccessibility={notice ? 'yes' : 'no-hide-descendants'}
            >
              {t('push.consentBothRequired')}
            </Text>
          )}
          <View style={flat ? styles.actionsFlat : styles.actions}>
            <Btn busy={busy} onPress={confirm} style={flat ? styles.confirmFlat : undefined} testID="notif-sheet-confirm">
              {confirmLabel}
            </Btn>
            <Pressable onPress={requestClose} hitSlop={10} style={flat ? styles.laterFlatBox : undefined} testID="notif-sheet-later">
              <Text style={flat ? styles.laterFlat : styles.later}>{t('push.primerLater')}</Text>
            </Pressable>
          </View>
        </Animated.View>
        </GestureDetector>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** 체크 행(KB-987 B안) — 체크 원은 고정 슬롯(22×22·보더 1.5), 상태로 바뀌는 건 색만(P-151). off = 회색 원 + 흰 체크(토스 패턴). */
function ConsentRow({ kind, surface, label, checked, onToggle }: { kind: ConsentKind; surface?: ConsentSurface; label: string; checked: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Pressable style={styles.rowMain} onPress={onToggle} hitSlop={6} testID={`consent-${kind}`} accessibilityRole="checkbox" accessibilityState={{ checked }}>
        <View style={[styles.box, checked && styles.boxOn]} testID={`consent-${kind}-box`}>
          <IconCheck size={14} color="#fff" />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </Pressable>
      <Pressable
        onPress={() => { track(EVENTS.push_consent_response, { action: 'full_text', target: kind, surface }); void openWebPage(consentUrl(kind)); }}
        hitSlop={12}
        accessibilityRole="link"
        accessibilityLabel={t('notif.viewFull')}
        testID={`consent-${kind}-full`}
      >
        <IconChevron size={20} color={C.inkMute} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 10,
    paddingBottom: 34,
    paddingHorizontal: 20,
    gap: 12,
    ...shadow.sh2,
  },
  // KB-987 B안(consent) — 흰 플랫: 그림자·핸들 없음, 간격은 요소 마진(시안 14487-1333)
  sheetFlat: {
    backgroundColor: C.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 36,
    paddingBottom: 34,
    paddingHorizontal: 24,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: radius.pill, backgroundColor: C.line, marginBottom: 6 },
  title: { fontFamily: font.bodyBold, fontSize: 18, color: C.ink, lineHeight: 25 },
  body: { fontFamily: font.body, fontSize: 16, color: C.ink3, lineHeight: 23 },
  titleFlat: { fontFamily: font.bodyBold, fontSize: 24, lineHeight: 32, color: C.ink, letterSpacing: -0.36 },
  bodyFlat: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: C.ink3, marginTop: 8 },
  // 동의 영역(consent 전용) — 회색 박스·구분선 없이 행 2개(행 자체 패딩)
  consents: { marginTop: 28 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { flex: 1, fontFamily: font.bodySemi, fontSize: 15, color: C.ink2, lineHeight: 22 },
  // 체크 원: on/off 같은 크기·보더 폭 — 상태로 바뀌는 건 색만(P-151)
  box: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 1.5, borderColor: C.line2, backgroundColor: C.line2, alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: C.primary, backgroundColor: C.primary },
  notice: { fontFamily: font.body, fontSize: 13, lineHeight: 17, color: C.riskDangerText, textAlign: 'center', marginTop: -4 },
  noticeFlat: { marginTop: 0 },
  noticeHidden: { opacity: 0 },
  actions: { gap: 6, marginTop: 4 },
  actionsFlat: { gap: 4, marginTop: 6 },
  confirmFlat: { minHeight: 56 }, // 계획 A-1: 라운드는 Btn 기본 알약(KB-909), 높이만 시안 56
  later: { fontFamily: font.bodyBold, fontSize: 16, color: C.ink2, padding: 8, textAlign: 'center' },
  laterFlatBox: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  laterFlat: { fontFamily: font.bodySemi, fontSize: 15, color: C.ink3, textAlign: 'center' },
});
