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
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import { BrandLockup } from '@/components/Brand';
import { api } from '@/lib/api/client';

export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 26 }]}>
      {/* ⑪-3: 뒤로가기 제거 — replace로 진입하면 스택이 비어 GO_BACK 미처리 에러.
          출구는 하단 "먼저 둘러보기"(replace라 스택 상태 무관) 하나로 통일. */}
      <View style={styles.hero}>
        <BrandLockup tileSize={44} />
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.sub}>{t('login.sub')}</Text>
      </View>

      <View style={styles.foot}>
        {/* KB-67: newMember → 온보딩. 기존 회원도 onboardingCompleted=false면
            온보딩으로 (계정만 생기고 프로필 미저장인 미완료 회원 — 400 이탈 등).
            판별 실패 시엔 홈 — resume 모달이 안전망. */}
        <SocialAuthButtons
          onSignedIn={(newMember) => {
            void (async () => {
              if (newMember) return router.replace('/onboarding' as Href);
              const completed = await api
                .get<{ onboardingCompleted?: boolean }>('/members/me/profile')
                .then((p) => p.onboardingCompleted === true)
                .catch(() => true);
              router.replace((completed ? (returnTo ?? '/(tabs)') : '/onboarding') as Href);
            })();
          }}
        />
        <Text style={styles.terms}>{t('login.terms')}</Text>
        <Pressable onPress={() => router.replace('/(tabs)' as Href)} hitSlop={8}>
          <Text style={styles.browse}>{t('intro.browseFirst')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface, paddingHorizontal: 26 },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: { fontFamily: font.displayBlack, fontSize: 26, color: C.ink, textAlign: 'center', letterSpacing: -0.4, marginTop: 14 },
  sub: { fontFamily: font.body, fontSize: 14.5, color: C.ink2, textAlign: 'center', lineHeight: 21, maxWidth: 300 },

  foot: { gap: 14 },
  terms: { fontFamily: font.body, fontSize: 12, color: C.ink3, textAlign: 'center', lineHeight: 17, paddingHorizontal: 10 },
  browse: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink2, textAlign: 'center', padding: 10 },
});
