/**
 * Root layout — global providers for the whole app:
 *  - TanStack Query (data seam)
 *  - i18next (reader-language strings)
 *  - font gate (Baloo 2 / Nunito Sans / Noto Sans KR) — splash held until loaded
 *  - SafeAreaProvider + gesture handler root
 *
 * The (tabs) app shell is built in a later unit; this just boots the foundation.
 */
import 'react-native-gesture-handler';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';

import { queryClient } from '@/lib/queryClient';
import { installBeAuth, onSessionExpired } from '@/lib/auth/beAuth';
import { hasSeenIntro } from '@/lib/introSeen';
import { FLAGS } from '@/lib/flags';
import i18n from '@/lib/i18n';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { useAppFonts } from '@/lib/useAppFonts';
import { color } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// KB-67: API 공통 레이어에 BE 토큰 배선(프로바이더 + 401 refresh 핸들러).
// beAuth는 RNFB를 임포트하지 않아 웹 번들에서도 안전하다.
installBeAuth();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const router = useRouter();

  // 첫 실행 게이트 (KB-76): introSeen 판별이 끝날 때까지 스플래시 유지 —
  // 판별 전에 홈/리다이렉트가 먼저 그려지는 race 방지 (실기기 반려분 #1).
  const [entryChecked, setEntryChecked] = useState(false);
  const needsIntro = useRef(false);

  useEffect(() => {
    hasSeenIntro()
      .then((seen) => { needsIntro.current = !seen; })
      .finally(() => setEntryChecked(true));
  }, []);

  // 네비게이터가 마운트된 뒤 1회만 인트로로 보낸다 (replace라 백스택 없음)
  useEffect(() => {
    if (entryChecked && needsIntro.current) {
      needsIntro.current = false;
      router.replace('/intro' as Href);
    }
  }, [entryChecked, router]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && entryChecked) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, entryChecked]);

  // KB-67: refresh 만료 = 세션 정리. 게스트 모드에선 로그인 화면을 강제하지
  // 않는다 — 세션 없음 ≠ 로그인 강제 (guest-access-policy §1): 캐시가 clear돼
  // 화면들이 게스트로 재평가되고, 회원 전용 동작은 게이트 시트가 안내한다.
  useEffect(() => {
    onSessionExpired(() => {
      if (Platform.OS !== 'web') {
        const session = require('@/lib/auth/session') as typeof import('@/lib/auth/session');
        void session.logOut().catch(() => {});
      }
      if (!FLAGS.guestMode) router.replace('/login' as Href);
    });
    return () => onSessionExpired(null);
  }, [router]);

  if ((!fontsLoaded && !fontError) || !entryChecked) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <LocaleProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: color.surface },
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              </Stack>
            </LocaleProvider>
          </I18nextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
