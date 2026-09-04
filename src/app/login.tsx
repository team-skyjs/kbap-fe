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
import { logoutBe } from '@/lib/auth/beAuth';
import { EVENTS, setUserProps, track } from '@/lib/analytics';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import { BrandLockup } from '@/components/Brand';
import { api } from '@/lib/api/client';

/** P-146: embedded = 프로필 탭 소속 렌더 — 화면 내 로고 블록·백 화살표 제거
 *  (앱 헤더 로고와 중복 + 탭 컨텍스트에 뒤로가기 무의미). 독립 /login 진입
 *  (라우트 — 게이트 시트→로그인 등 푸시 컨텍스트)은 embedded 미전달 = 현행 무변. */
export default function Login({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset(); // P-055: 안드 내비바 보정
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: bottom + 26 }]}>
      {/* P-129: 뒤로가기 복원(멘토) — ⑪-3의 빈 스택 GO_BACK 에러는 canGoBack 가드로 해소 */}
      {!embedded && router.canGoBack() && (
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn} testID="login-back">
          <IconArrowLeft size={22} color={C.ink2} />
        </Pressable>
      )}
      <View style={styles.hero}>
        {!embedded && <BrandLockup tileSize={44} />}
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.sub}>{t('login.sub')}</Text>
      </View>

      <View style={styles.foot}>
        {/* KB-421: 게스트 진입 = 명시적 세션 클리어 — 부트 레이스 등으로 남은 반쪽
            세션(스토어 true·토큰 잔존)을 신뢰하지 않는다. 무세션이면 사실상 no-op. */}
        <Pressable onPress={() => { void logoutBe().catch(() => {}); track(EVENTS.auth_guest_enter); setUserProps({ user_info_is_registered: false }); /* P-083+144 */ router.replace('/(tabs)' as Href); }} hitSlop={8}>
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
