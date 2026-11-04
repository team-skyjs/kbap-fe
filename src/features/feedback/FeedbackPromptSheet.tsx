/**
 * FeedbackPromptSheet (KB-986) — 재방문 사용자 홈 바텀시트: 안내 두 줄 + 문의 입력칸(공용 FeedbackForm) + "다시 보지 않기".
 * 화면 이동 없이 기존 문의 API로 보낸다(게스트 포함). 완료 안내·종료 = 응답 성공 뒤에만(P-387) — 실패면 본문 유지·재시도.
 * 닫기(X·바깥 탭·스와이프·뒤로) = 다음 실행에 다시 · 보내기 성공·다시 보지 않기 = 영구 종료(feedbackPrompt).
 * 시트 문법 = NotificationSheet(fade Modal + useSheetSwipeDismiss 등장·퇴장 슬라이드). 제스처 = 핸들·제목 머리만(입력·사진 스트립과 충돌 방지 — 훅 계약).
 * 키보드 = Modal 안 KeyboardAvoidingView(padding 두 플랫폼 — KB-768) + 본문 ScrollView(키보드가 떠도 Send까지 스크롤로 닿음).
 */
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/lib/engagement/occlusionSurfaces';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { IconClose } from '@/components/icons';
import { useSheetSwipeDismiss } from '@/components/useSheetSwipeDismiss';
import { useBottomInset } from '@/lib/useBottomInset';
import { KAV_BEHAVIOR, KAV_OFFSET } from '@/lib/keyboardAvoid';
import { EVENTS, track } from '@/lib/analytics';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { FeedbackFields, useFeedbackForm } from './FeedbackForm';
import { markFeedbackPromptDone, setFeedbackPromptActive } from './feedbackPrompt';

type Via = 'close' | 'backdrop' | 'swipe' | 'back';

export function FeedbackPromptSheet({ open, onClose, onDismiss }: { open: boolean; onClose: () => void; onDismiss?: () => void }) {
  // 닫힘 경로는 전부 몸통 안에서 퇴장 슬라이드를 끝낸 뒤 onClose — 바깥에서 닫힘(블러 abort)은 애니메이션 없이 바로 내린다
  // 안드 뒤로 = Modal onRequestClose(Modal이 떠 있으면 BackHandler로 안 온다) → 몸통의 닫기 경로로
  const back = React.useRef<(() => void) | null>(null);
  // 입력 상태는 시트가 보이는 동안만 산다(닫히면 언마운트 = 다음 실행은 빈 폼 · 전송 중 언마운트 = 업로드 취소 KB-711)
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => back.current?.()} onDismiss={onDismiss}>
      {open && <SheetBody open={open} onClose={onClose} backRef={back} />}
    </Modal>
  );
}

function SheetBody({ open, onClose, backRef }: { open: boolean; onClose: () => void; backRef: React.RefObject<(() => void) | null> }) {
  const { t } = useTranslation();
  const bottom = useBottomInset();
  const form = useFeedbackForm();
  const via = React.useRef<Via>('swipe'); // 훅이 직접 onClose를 부르는 경로 = 끌어 닫기
  const ended = React.useRef(false); // 계측 1회(닫기·다시 보지 않기·보내기 중 하나)
  const end = (event: 'dismissed' | 'never_again' | 'submitted', props?: Record<string, unknown>) => {
    if (ended.current) return;
    ended.current = true;
    if (event === 'dismissed') track(EVENTS.feedback_prompt_dismissed, { via: via.current });
    else if (event === 'never_again') track(EVENTS.feedback_prompt_never_again, {});
    else track(EVENTS.feedback_prompt_submitted, props ?? {});
    onClose();
  };
  const swipe = useSheetSwipeDismiss(() => end('dismissed'), open, { animateIn: true });
  React.useEffect(() => {
    track(EVENTS.feedback_prompt_shown, {});
  }, []);

  const requestClose = (v: Via) => {
    if (form.busy || swipe.isClosing()) return; // 전송 중 = 닫지 않는다(응답을 기다린다)
    via.current = v;
    swipe.dismiss(() => end('dismissed'));
  };
  const neverAgain = () => {
    if (form.busy || swipe.isClosing()) return;
    void markFeedbackPromptDone();
    swipe.dismiss(() => end('never_again'));
  };
  const onSend = () =>
    form.send(({ photoCount }) => {
      void markFeedbackPromptDone(); // P-387: 성공 응답 뒤에만 종료
      swipe.dismiss(() => end('submitted', { has_photos: photoCount > 0, photo_count: photoCount }));
    });

  React.useEffect(() => {
    backRef.current = () => requestClose('back');
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={styles.root} behavior={KAV_BEHAVIOR} keyboardVerticalOffset={KAV_OFFSET} testID="feedback-prompt-kav">
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, swipe.dimStyle]} pointerEvents="none" />
        <Pressable style={{ flex: 1 }} onPress={() => requestClose('backdrop')} testID="feedback-prompt-backdrop" />
        <Animated.View style={[styles.sheet, { paddingBottom: 20 + bottom }, swipe.sheetStyle]} onLayout={swipe.onSheetLayout} testID="feedback-prompt">
          <GestureDetector gesture={swipe.gesture}>
            <View testID="feedback-prompt-head">
              <View style={styles.handle} />
              <View style={styles.headRow}>
                <Text style={styles.title} accessibilityRole="header">{t('feedbackPrompt.title')}</Text>
                <Pressable style={styles.close} onPress={() => requestClose('close')} accessibilityRole="button" accessibilityLabel={t('common.close')} testID="feedback-prompt-close">
                  <IconClose size={16} color={C.ink2} />
                </Pressable>
              </View>
              <Text style={styles.body}>{t('feedbackPrompt.body')}</Text>
            </View>
          </GestureDetector>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.fields} keyboardShouldPersistTaps="handled">
            <FeedbackFields form={form} onSend={onSend} />
            <Pressable style={styles.never} onPress={neverAgain} accessibilityRole="button" testID="feedback-prompt-never">
              <Text style={styles.neverText}>{t('feedbackPrompt.neverAgain')}</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

/** 열림/닫힘 + 닫힘 완료 뒤 done(iOS = onDismiss, Android = 즉시 — useMarketingConsentSheet와 같은 순서) + 활성 플래그 */
export function useFeedbackPromptSheet() {
  const [open, setOpen] = React.useState(false);
  const pending = React.useRef<{ done?: () => void } | null>(null);
  const settle = React.useCallback(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setFeedbackPromptActive(false);
    p.done?.();
  }, []);
  const show = React.useCallback((done?: () => void) => {
    pending.current = { done };
    setFeedbackPromptActive(true);
    setOpen(true);
  }, []);
  /** 블러 — 떠 있으면 닫고 즉시 풀어 준다(목적지 위에 남지 않게, 계측 없음 — 다음 실행에 다시) */
  const abort = React.useCallback(() => {
    if (!pending.current) return;
    setOpen(false);
    settle();
  }, [settle]);
  const close = () => {
    setOpen(false);
    if (Platform.OS !== 'ios') settle();
  };
  return { show, abort, props: { open, onClose: close, onDismiss: Platform.OS === 'ios' ? settle : undefined } };
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '92%', backgroundColor: C.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: 10, ...shadow.sh2 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: radius.pill, backgroundColor: C.line, marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20 },
  title: { flex: 1, fontFamily: font.bodyBold, fontSize: 18, color: C.ink, lineHeight: 25 },
  close: { width: 44, height: 44, marginTop: -10, marginRight: -12, alignItems: 'center', justifyContent: 'center' },
  body: { fontFamily: font.body, fontSize: 16, color: C.ink3, lineHeight: 23, paddingHorizontal: 20, marginTop: 4 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  fields: { padding: 20, gap: 16 },
  never: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  neverText: { fontFamily: font.bodySemi, fontSize: 14, color: C.ink3, textDecorationLine: 'underline' },
});
