/**
 * Login / sign-up (KB-10) — SOCIAL ONLY per the 2026-07-08 회의: Apple + Google
 * buttons, no email form or link. The button set is the shared
 * SocialAuthButtons (reused by the KB-77 auth-gate sheet).
 *
 * A successful acquisition routes to onboarding (profile setup) — the real
 * "signed-in" session starts when the BE contract lands (KB-109 stub). Terms/
 * privacy notice is i18n'd (9 languages); Apple button localizes natively and
 * the Google label follows Google's own localized strings.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { IconArrowLeft } from '@/components/icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '@/lib/useBottomInset';
import { resetToOnboarding } from '@/lib/nav';
import { EVENTS, track } from '@/lib/analytics';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import { BrandLockup } from '@/components/Brand';
import { api } from '@/lib/api/client';

export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset(); // P-055: 안드 내비바 보정
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: bottom + 26 }]}>
      {/* P-129: 뒤로가기 복원(멘토) — ⑪-3의 빈 스택 GO_BACK 에러는 canGoBack 가드로 해소 */}
      {router.canGoBack() && (
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn} testID="login-back">
          <IconArrowLeft size={22} color={C.ink2} />
        </Pressable>
      )}
      <View style={styles.hero}>
        <BrandLockup tileSize={44} />
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.sub}>{t('login.sub')}</Text>
      </View>

      <View style={styles.foot}>
        <Pressable onPress={() => { track(EVENTS.guest_enter); /* P-083 */ router.replace('/(tabs)' as Href); }} hitSlop={8}>
          <Text style={styles.browse}>{t('intro.browseFirst')}</Text>
        </Pressable>
        {/* KB-67: newMember → 온보딩. 기존 회원도 onboardingCompleted=false면
            온보딩으로 (계정만 생기고 프로필 미저장인 미완료 회원 — 400 이탈 등).
            판별 실패 시엔 홈 — resume 모달이 안전망. */}
        <SocialAuthButtons
          onSignedIn={(newMember) => {
            void (async () => {
              if (newMember) return resetToOnboarding(router); // P-088④ 스택 리셋
              const completed = await api
                .get<{ onboardingCompleted?: boolean }>('/members/me/profile')
                .then((p) => p.onboardingCompleted === true)
                .catch(() => true);
              if (completed) {
                router.replace((returnTo ?? '/(tabs)') as Href);
              } else {
                resetToOnboarding(router); // P-088④ 스택 리셋
              }
            })();
          }}
        />
        <Text style={styles.terms}>{t('login.terms')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface, paddingHorizontal: 26 },
  backBtn: { position: 'absolute', top: 54, left: 16, zIndex: 5, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: { fontFamily: font.displayBlack, fontSize: 26, color: C.ink, textAlign: 'center', letterSpacing: -0.4, marginTop: 14 },
  sub: { fontFamily: font.body, fontSize: 14.5, color: C.ink2, textAlign: 'center', lineHeight: 21, maxWidth: 300 },

  foot: { gap: 14 },
  terms: { fontFamily: font.body, fontSize: 12, color: C.ink3, textAlign: 'center', lineHeight: 17, paddingHorizontal: 10 },
  browse: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink2, textAlign: 'center', padding: 10 },
});
