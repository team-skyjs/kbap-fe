/**
 * ReviewPromptSheet (KB-730) — "K-Bap이 도움이 됐나요?" 자체 안내 시트. AuthGateSheet와 같은 바텀시트 문법(dimmed · 라운드 26).
 * 응답 3종: 좋아요(primary) · 별로예요(ghost) · 나중에(ghost). 배경 탭·뒤로 = 나중에. 첫 응답 뒤 버튼 비활성.
 * onShow = 실제로 보인 뒤(소모·계측 시점) · onClosed = 완전히 닫힌 뒤(iOS onDismiss / Android는 onDismiss 미지원 → 응답 직후)
 */
import * as React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { useBottomInset } from '@/lib/useBottomInset';
import { color as C, font, shadow } from '@/lib/theme';
import type { PromptAnswer } from '@/lib/reviewPrompt';

export function ReviewPromptSheet({
  open,
  onAnswer,
  onShow,
  onClosed,
  disabled = false,
}: {
  open: boolean;
  onAnswer: (a: PromptAnswer) => void;
  onShow?: () => void;
  onClosed?: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const bottom = useBottomInset();
  const answer = (a: PromptAnswer) => {
    if (disabled) return;
    onAnswer(a);
    if (Platform.OS !== 'ios') onClosed?.(); // Android: onDismiss 미지원 — 교착 자체가 iOS UIKit 이슈라 무해(P-267)
  };
  const later = () => answer('later');
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={later} onShow={onShow} onDismiss={Platform.OS === 'ios' ? onClosed : undefined}>
      <Pressable style={styles.backdrop} onPress={later} testID="review-prompt-backdrop">
        <Pressable style={[styles.sheet, Platform.OS === 'android' ? { paddingBottom: 14 + bottom } : null]} onPress={() => {}} testID="review-prompt">
          <Text style={styles.title}>{t('reviewPrompt.title')}</Text>
          <View style={styles.actions}>
            <Btn onPress={() => answer('positive')} disabled={disabled} testID="review-prompt-positive">{t('reviewPrompt.positive')}</Btn>
            <Btn variant="ghost" onPress={() => answer('negative')} disabled={disabled} testID="review-prompt-negative">{t('reviewPrompt.negative')}</Btn>
            <Btn variant="ghost" onPress={later} disabled={disabled} testID="review-prompt-later">{t('reviewPrompt.later')}</Btn>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 22, paddingBottom: 30, paddingHorizontal: 20, gap: 14, ...shadow.shPop },
  title: { fontFamily: font.display, fontSize: 18, color: C.ink, textAlign: 'center' },
  actions: { gap: 9 },
});
