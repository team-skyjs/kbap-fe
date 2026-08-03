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
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';

import { queryClient } from '@/lib/queryClient';
import { gateSplash, prefetchAfterCleanup } from '@/lib/bootGate';
import { installBeAuth, onSessionExpired } from '@/lib/auth/beAuth';
import { cleanupIfFreshInstall } from '@/lib/auth/freshInstall';
import { hasSeenIntro } from '@/lib/introSeen';
import { FLAGS } from '@/lib/flags';
import i18n from '@/lib/i18n';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { useAppFonts } from '@/lib/useAppFonts';
import { color } from '@/lib/theme';
import { KeyboardDismissBar } from '@/components';
import { VersionGateOverlay } from '@/components/VersionGate';

SplashScreen.preventAutoHideAsync().catch(() => {});

// KB-67: API 공통 레이어에 BE 토큰 배선(프로바이더 + 401 refresh 핸들러).
// beAuth는 RNFB를 임포트하지 않아 웹 번들에서도 안전하다.
installBeAuth();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const router = useRouter();

  // 첫 실행 게이트 (KB-76): introSeen 판별이 끝날 때까지 스플래시 유지 —
  // 판별 전에 홈/리다이렉트가 먼저 그려지는 race 방지 (실기기 반려분 #1).
  // 신규 설치 잔존 세션 정리(freshInstall)도 이 게이트 안 — **정리가 프리페치·
  // 렌더 모두보다 선행**(P-041): 렌더는 entryChecked가 막고, 프리페치는
  // prefetchAfterCleanup 직렬화가 막는다 (렌더만 막던 시절의 레이스 경위는 아래).
  // P-018(KB-194): 여기에 부트 게이팅 추가 — 핵심 데이터 프리페치 + 최소 노출
  // 1200ms(반짝임 소멸) + 상한 4000ms(무한 스플래시 금지 — 스켈레톤/J4가 이어받음).
  const [entryChecked, setEntryChecked] = useState(false);
  const needsIntro = useRef(false);

  useEffect(() => {
    // P-041(KB-152 재수정): **정리가 프리페치·렌더 모두보다 선행**. 기존 주석
    // ("정리가 항상 먼저")은 렌더 기준이었는데, P-018 프리페치가 네트워크 경로로
    // 같은 틱에 병렬 발사되며 그 가정을 깼다 — 신규 설치 첫 부팅에서 옛 토큰으로
    // /home 인증 프리페치 → 이전 계정 홈 잔상(Q-05, 프라이버시). cleanup은
    // AsyncStorage 체크 1회라 비신규 설치의 직렬화 지연은 무시 가능.
    const cleanupDone = cleanupIfFreshInstall().catch(() => {});
    const ready = Promise.all([cleanupDone, hasSeenIntro()])
      .then(([, seen]) => { needsIntro.current = !seen; })
      .catch(() => {}); // 판별 실패도 부트는 진행 (기존 finally 시맨틱 유지)
    void gateSplash({ ready, prefetch: prefetchAfterCleanup(cleanupDone) }).then(() => setEntryChecked(true));
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
      {/* P-031(KB-206): 시스템 reduce-motion 시 reanimated 애니메이션 전역 비활성
          (스프링/스태거는 스킵되고 Modal 페이드 등 크로스페이드 경로만 남는다) */}
      <ReducedMotionConfig mode={ReduceMotion.System} />
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
                {/* P-088④: 온보딩 = iOS 스와이프 백 차단 (스택 리셋과 이중 방어) */}
                <Stack.Screen name="onboarding/index" options={{ gestureEnabled: false }} />
                <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              </Stack>
              {/* P-106: 키보드 내리기 전역 — iOS 액세서리 바(전 Input 연결)+안드 하단 바 */}
              <KeyboardDismissBar />
              {/* P-111(KB-269): 최소 지원 버전 하드 게이트 — 내비 전체 덮음, 페일 오픈 */}
              <VersionGateOverlay />
            </LocaleProvider>
          </I18nextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
