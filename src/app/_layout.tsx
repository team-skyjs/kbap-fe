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
import { useEffect } from 'react';
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // KB-67: refresh 만료 = 강제 로그아웃 → 재로그인 유도. Firebase signOut은
  // 네이티브 전용이라 Platform 가드 뒤 lazy require.
  useEffect(() => {
    onSessionExpired(() => {
      if (Platform.OS !== 'web') {
        const session = require('@/lib/auth/session') as typeof import('@/lib/auth/session');
        void session.logOut().catch(() => {});
      }
      router.replace('/login' as Href);
    });
    return () => onSessionExpired(null);
  }, [router]);

  if (!fontsLoaded && !fontError) return null;

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
