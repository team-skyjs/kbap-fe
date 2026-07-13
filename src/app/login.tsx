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
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { IconArrowLeft } from '@/components';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import { BrandLockup } from '@/components/Brand';

export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 26 }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
        <IconArrowLeft size={22} color={C.ink} />
      </Pressable>

      <View style={styles.hero}>
        <BrandLockup tileSize={44} />
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.sub}>{t('login.sub')}</Text>
      </View>

      <View style={styles.foot}>
        {/* KB-67: newMember만 온보딩으로, 기존 회원은 바로 홈 */}
        <SocialAuthButtons onSignedIn={(newMember) => router.replace((newMember ? '/onboarding' : '/(tabs)') as Href)} />
        <Text style={styles.terms}>{t('login.terms')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface, paddingHorizontal: 26 },
  back: { alignSelf: 'flex-start', padding: 6 },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: { fontFamily: font.displayBlack, fontSize: 26, color: C.ink, textAlign: 'center', letterSpacing: -0.4, marginTop: 14 },
  sub: { fontFamily: font.body, fontSize: 14.5, color: C.ink2, textAlign: 'center', lineHeight: 21, maxWidth: 300 },

  foot: { gap: 14 },
  terms: { fontFamily: font.body, fontSize: 12, color: C.ink3, textAlign: 'center', lineHeight: 17, paddingHorizontal: 10 },
});
