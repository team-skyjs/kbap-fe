/**
 * EligibilityGate (P-251/KB-361 2차) — 리뷰 자격 게이트 안내.
 * 정책(8/15 멘토링): 리뷰는 **스캔한 음식에만**. 서버 강제(BE #185) =
 * 상세 `reviewEligible` + 작성 403 REVIEW-004. 이 시트는 그 두 지점의 공용 안내 —
 * 문구·CTA는 P-245 픽커 자격 UX 재사용(reviewEligibleNote·goScanCta — 새 문구 발명 금지).
 * ⚠️ 게스트는 이 게이트 대상이 아니다(가입 게이트 우선 — 호출측이 회원일 때만 연다).
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Btn } from '@/components';
import { color as C, font, radius, shadow } from '@/lib/theme';

export function EligibilityGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}} testID="review-elig-gate">
          <Text style={styles.body}>{t('community.reviewEligibleNote')}</Text>
          <View style={{ gap: 9, marginTop: 12 }}>
            <Btn onPress={() => { onClose(); router.navigate('/scan'); }} testID="review-elig-scan">
              {t('community.goScanCta')}
            </Btn>
            <Btn variant="ghost" onPress={onClose} testID="review-elig-close">{t('common.cancel')}</Btn>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,12,5,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: radius.lg, padding: 20, ...shadow.shPop },
  body: { fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: C.ink, textAlign: 'center' },
});
