/**
 * PhotoConsentSheet (KB-814 F3) — 가공식품 리뷰 사진을 갤러리에서 고르기 전 1회 동의.
 * ReviewPromptSheet와 같은 바텀시트 문법(dimmed · 라운드 26). 배경 탭·뒤로 = 취소.
 * onClosed = 완전히 닫힌 뒤(iOS onDismiss / Android는 onDismiss 미지원 → 응답 직후) — 갤러리는 여기서 연다(닫힘 직후 present = iOS 프리즈, #236 2R).
 */
import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Modal } from '@/lib/engagement/occlusionSurfaces';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { useBottomInset } from '@/lib/useBottomInset';
import { color as C, font, shadow } from '@/lib/theme';

export function PhotoConsentSheet({ open, onAnswer, onClosed }: { open: boolean; onAnswer: (agreed: boolean) => void; onClosed?: () => void }) {
  const { t } = useTranslation();
  const bottom = useBottomInset();
  const answer = (agreed: boolean) => {
    onAnswer(agreed);
    if (Platform.OS !== 'ios') onClosed?.();
  };
  const cancel = () => answer(false);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={cancel} onDismiss={Platform.OS === 'ios' ? onClosed : undefined}>
      <Pressable style={styles.backdrop} onPress={cancel} testID="photo-consent-backdrop">
        <Pressable style={[styles.sheet, Platform.OS === 'android' ? { paddingBottom: 14 + bottom } : null]} noTrack onPress={() => {}} testID="photo-consent">
          <Text style={styles.title}>{t('ugc.consentTitle')}</Text>
          <View style={styles.lines}>
            <Text style={styles.body}>{t('ugc.consentNoStock')}</Text>
            <Text style={styles.body}>{t('ugc.consentRemoval')}</Text>
          </View>
          <View style={styles.actions}>
            <Btn onPress={() => answer(true)} testID="photo-consent-agree">{t('ugc.consentAgree')}</Btn>
            <Btn variant="ghost" onPress={cancel} testID="photo-consent-cancel">{t('common.cancel')}</Btn>
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
  lines: { gap: 6 },
  body: { fontFamily: font.body, fontSize: 14, color: C.ink2, lineHeight: 20, textAlign: 'center' },
  actions: { gap: 9 },
});
