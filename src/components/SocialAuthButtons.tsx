/**
 * SocialAuthButtons (KB-10) — the ONLY sign-in entry: Apple + Google, no email.
 * Self-contained (flows + loading + error line live inside) so the login screen
 * AND the KB-77 auth-gate bottom sheet can drop in the same set.
 *
 * Brand compliance:
 *  - Apple: the OFFICIAL native button (expo-apple-authentication
 *    AppleAuthenticationButton) — style/label/localization rendered by the OS
 *    per the Sign in with Apple HIG. iOS only; hidden elsewhere.
 *  - Google: per Google Identity branding — white surface, #747775 border,
 *    official 4-color "G" mark (exact paths/colors, no tinting), label
 *    "Sign in with Google" (i18n follows Google's own localized strings).
 */
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import Svg, { Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { useSocialAuth } from '@/lib/auth/useSocialAuth';
import { useShake } from '@/lib/useShake';

const BTN_H = 52;

/** Official Google "G" — exact brand paths and colors (do not modify). */
function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

export function SocialAuthButtons({ onSignedIn }: { onSignedIn: (newMember: boolean) => void }) {
  const { t } = useTranslation();
  const { phase, error, appleAvailable, signInWithGoogle, signInWithApple } = useSocialAuth(onSignedIn);
  const busy = phase !== 'idle';

  // P-032: Error Shake — 시도가 에러로 끝날 때마다 감쇠 진동. phase가 idle로
  // 돌아온 시점 기준이라 같은 에러의 재시도 실패도 재트리거된다.
  const { shakeStyle, shake } = useShake();
  React.useEffect(() => {
    if (error && phase === 'idle') shake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, phase]);

  return (
    <View style={styles.wrap}>
      {appleAvailable && (
        <View style={styles.appleSlot}>
          {phase === 'apple' ? (
            <View style={[styles.busyBox, { backgroundColor: '#000' }]}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
              style={styles.apple}
              onPress={() => { if (!busy) void signInWithApple(); }}
            />
          )}
        </View>
      )}

      <Pressable
        style={[styles.google, busy && phase !== 'google' && styles.dim]}
        disabled={busy}
        onPress={() => void signInWithGoogle()}
        accessibilityRole="button"
        accessibilityLabel={t('login.google')}
      >
        {phase === 'google' ? (
          <ActivityIndicator color={C.ink2} />
        ) : (
          <>
            <GoogleG />
            <Text style={styles.googleLabel}>{t('login.google')}</Text>
          </>
        )}
      </Pressable>

      {!!error && (
        <Animated.View style={shakeStyle}>
          <Text style={styles.error}>
            {t(error === 'network' ? 'login.errorNetwork' : 'login.errorGeneric')}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 12 },
  appleSlot: { height: BTN_H },
  apple: { width: '100%', height: BTN_H },
  busyBox: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Google Identity light button: white bg, #747775 border, #1F1F1F medium label
  google: {
    height: BTN_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#747775',
    borderRadius: 14,
  },
  googleLabel: { fontFamily: font.bodyBold, fontSize: 15.5, color: '#1F1F1F' },
  dim: { opacity: 0.5 },

  error: { fontFamily: font.body, fontSize: 13, color: C.riskDanger, textAlign: 'center', marginTop: 2 },
});
