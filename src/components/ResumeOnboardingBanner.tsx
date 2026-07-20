/**
 * ResumeOnboardingBanner (KB-110) — centered modal (dimmed backdrop) shown over
 * the tab shell when a mid-flow onboarding draft exists: "이어서 설정하기"
 * resumes at the saved step; "나중에"(Skip for now) keeps browsing with the
 * draft intact (server sync of the incomplete state lands with KB-75).
 * Dismiss hides it for the session; a successful submit clears the draft so it
 * never returns.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, radius, shadow } from '@/lib/theme';
import { Btn } from '@/components/Btn';
import { IconProfile } from '@/components/icons';
import { loadOnboardingDraft } from '@/lib/onboarding/draft';
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';

/**
 * 노출 판정 (P-010/KB-177 개정): **로그인 + 온보딩 미완 회원**에게만.
 * - 게스트는 draft가 있어도 미노출 — 탈퇴/로그아웃 잔재가 게스트를 미완
 *   회원으로 오인시키는 계열 버그의 방어벽 (일괄 정리와 별개의 이중 방어).
 * - 회원은 KB-75 그대로: 서버 플래그가 원천(완료=절대 미노출, 미완=draft
 *   없어도 노출), 플래그 없으면(mock) 로컬 draft 기준.
 */
export function shouldShowResume(
  isGuest: boolean,
  onboardingCompleted: boolean | undefined,
  draftExists: boolean,
): boolean {
  if (isGuest) return false;
  if (onboardingCompleted === true) return false;
  if (onboardingCompleted === false) return true;
  return draftExists;
}

export function ResumeOnboardingBanner() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: me } = useMe();
  const isGuest = useIsGuest();
  const [draftExists, setDraftExists] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void loadOnboardingDraft().then((d) => setDraftExists(!!d));
  }, []);

  const visible = shouldShowResume(isGuest, me?.onboardingCompleted, draftExists) && !dismissed;
  const setVisible = (v: boolean) => setDismissed(!v);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      {/* backdrop tap = "나중에" (keeps the draft) */}
      <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
        {/* stop card taps from falling through to the backdrop */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.glyph}>
            <IconProfile size={26} color={C.primary} />
          </View>
          <Text style={styles.title}>{t('onboarding.resumeTitle')}</Text>
          <Btn
            onPress={() => {
              setVisible(false);
              router.push('/onboarding' as Href);
            }}
          >
            {t('onboarding.resumeCta')}
          </Btn>
          <Pressable onPress={() => setVisible(false)} hitSlop={10}>
            <Text style={styles.later}>{t('onboarding.skip')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.card,
    borderRadius: radius.lg,
    paddingVertical: 26,
    paddingHorizontal: 22,
    ...shadow.sh2,
  },
  glyph: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    color: C.ink,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 2,
  },
  later: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink2, padding: 6 },
});
