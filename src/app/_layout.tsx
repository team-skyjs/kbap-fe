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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';

import { queryClient } from '@/lib/queryClient';
import i18n from '@/lib/i18n';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { useAppFonts } from '@/lib/useAppFonts';
import { color } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// KB-109: API 공통 레이어에 Firebase ID 토큰 프로바이더 연결. Firebase 네이티브
// 모듈은 웹 런타임이 없으므로 웹 번들에서는 실행하지 않는다 (require = 지연 평가).
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/lib/auth/session') as typeof import('@/lib/auth/session')).installAuthTokenProvider();
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

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
