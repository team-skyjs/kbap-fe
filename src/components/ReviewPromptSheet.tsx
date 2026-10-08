/**
 * ReviewPromptSheet (KB-730) — "K-Bap이 도움이 됐나요?" 자체 안내 시트. AuthGateSheet와 같은 바텀시트 문법(dimmed · 라운드 26 · 그랩 없음).
 * 응답 3종: 좋아요(primary) · 별로예요(ghost) · 나중에(ghost). 배경 탭·뒤로 = 나중에.
 */
import * as React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { useBottomInset } from '@/lib/useBottomInset';
import { color as C, font, shadow } from '@/lib/theme';
import type { PromptAnswer } from '@/lib/reviewPrompt';

export function ReviewPromptSheet({ open, onAnswer }: { open: boolean; onAnswer: (a: PromptAnswer) => void }) {
  const { t } = useTranslation();
  const bottom = useBottomInset();
  const later = () => onAnswer('later');
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={later}>
      <Pressable style={styles.backdrop} onPress={later} testID="review-prompt-backdrop">
        <Pressable style={[styles.sheet, Platform.OS === 'android' ? { paddingBottom: 14 + bottom } : null]} onPress={() => {}} testID="review-prompt">
          <Text style={styles.title}>{t('reviewPrompt.title')}</Text>
          <View style={styles.actions}>
            <Btn onPress={() => onAnswer('positive')} testID="review-prompt-positive">{t('reviewPrompt.positive')}</Btn>
            <Btn variant="ghost" onPress={() => onAnswer('negative')} testID="review-prompt-negative">{t('reviewPrompt.negative')}</Btn>
            <Btn variant="ghost" onPress={later} testID="review-prompt-later">{t('reviewPrompt.later')}</Btn>
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
