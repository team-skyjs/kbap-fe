/**
 * AuthGateSheet (KB-77) — 인증 게이트 바텀시트. 게이트 액션(위험도 보기·
 * 리뷰 보기/쓰기·스캔·프로필) 탭 시 dimmed 위로 등장하는 단일 컴포넌트.
 * context prop이 카피를 분기하고, CTA는 /login?returnTo=<현재 경로>로 —
 * 로그인 성공 시 보던 맥락으로 복귀한다 (guest-access-policy §0-3).
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { spring } from '@/lib/motion';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, radius, shadow } from '@/lib/theme';
import { Btn } from '@/components/Btn';
import { IconClose, IconLock } from '@/components/icons';

export type GateContext = 'risk' | 'reviews' | 'writeReview' | 'scan' | 'profile' | 'notifications' | 'save';

const COPY: Record<GateContext, { title: string; sub: string }> = {
  risk: { title: 'gate.riskTitle', sub: 'gate.riskSub' },
  reviews: { title: 'gate.reviewsTitle', sub: 'gate.reviewsSub' },
  writeReview: { title: 'gate.writeTitle', sub: 'gate.writeSub' },
  scan: { title: 'gate.scanTitle', sub: 'gate.scanSub' },
  profile: { title: 'gate.profileTitle', sub: 'gate.profileSub' },
  notifications: { title: 'gate.notifTitle', sub: 'gate.notifSub' },
  save: { title: 'gate.saveTitle', sub: 'gate.saveSub' },
};

export function AuthGateSheet({
  context,
  open,
  onClose,
}: {
  context: GateContext;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const copy = COPY[context];

  const goLogin = () => {
    onClose();
    router.push(`/login?returnTo=${encodeURIComponent(pathname)}` as Href);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* P-031: 시트 등장 = damped 스프링(바운스 0 — 모멘텀 없는 등장, apple-design §4).
            backdrop 페이드·퇴장은 Modal fade가 담당. reduced-motion 시 스프링만
            비활성(ReducedMotionConfig) → 페이드 등장으로 자연 폴백. */}
        <Animated.View entering={SlideInDown.springify().damping(spring.sheet.damping).stiffness(spring.sheet.stiffness)}>
          {/* 카드 탭이 backdrop으로 새지 않게 */}
          <Pressable style={styles.sheet} onPress={() => {}}>
          <Pressable style={styles.close} hitSlop={10} onPress={onClose}>
            <IconClose size={18} color={C.ink3} />
          </Pressable>
          <View style={styles.glyph}>
            <IconLock size={24} color={C.primary} />
          </View>
          <Text style={styles.title}>{t(copy.title)}</Text>
          <Text style={styles.sub}>{t(copy.sub)}</Text>
          <Btn onPress={goLogin}>{t('intro.signUp')}</Btn>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.later}>{t('onboarding.skip')}</Text>
          </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 26,
    paddingBottom: 34,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
    ...shadow.sh2,
  },
  close: { position: 'absolute', top: 16, right: 16, zIndex: 1, padding: 4 },
  glyph: { width: 56, height: 56, borderRadius: 28, backgroundColor: primaryTint, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.displayBlack, fontSize: 19, color: C.ink, textAlign: 'center', lineHeight: 26 },
  sub: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, textAlign: 'center', lineHeight: 20, marginBottom: 6, maxWidth: 320 },
  later: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2, padding: 8 },
});
