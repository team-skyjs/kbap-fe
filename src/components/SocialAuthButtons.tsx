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
 *    official 4-color "G" mark (IconGoogleG — icons.tsx SSOT, P-034), label
 *    "Sign in with Google" (i18n follows Google's own localized strings).
 */
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';
import { color as C, font } from '@/lib/theme';
import { useSocialAuth } from '@/lib/auth/useSocialAuth';
import { useShake } from '@/lib/useShake';
import { IconGoogleG } from './icons';

const BTN_H = 52;

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
            <IconGoogleG size={20} />
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
