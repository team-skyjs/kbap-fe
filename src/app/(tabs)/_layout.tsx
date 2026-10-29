/**
 * (tabs)/_layout — the 5-slot bottom navigation:
 *   Home · Food · [Scan FAB] · Community (locked) · Profile.
 *
 * Scan is NOT a tab screen — the center FAB pushes the root `/scan` route.
 * The bar itself is the shared presentational <TabBar/>; this layout only
 * bridges it to expo-router navigation state. Labels come from i18n.
 *
 * NOTE: react-navigation is vendored inside expo-router (SDK 56), so we don't
 * import @react-navigation/bottom-tabs — the tabBar render prop infers its type.
 */
import { initAds } from '@/lib/ads/adsSession';
import { whenSplashDone } from '@/lib/bootGate';
import * as React from 'react';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TabBar, type TabKey } from '@/components';
import { EVENTS, track } from '@/lib/analytics';
import { airbridge } from '@/lib/airbridge';
import { isEntryResolved, setDeeplinkReady } from '@/lib/deeplink';
import { isRegisteredForAnalytics } from '@/lib/auth/beTokens';
import { ResumeOnboardingBanner } from '@/components/ResumeOnboardingBanner';

// route name (file) ↔ TabBar key
const ROUTE_TO_KEY: Record<string, TabKey> = {
  index: 'home',
  food: 'food',
  community: 'reviews', // KB-429: 탭 키 reviews — 라우트는 커뮤니티(=전역 리뷰 피드) 재사용
  profile: 'profile',
};
const KEY_TO_ROUTE: Record<TabKey, string> = {
  home: 'index',
  food: 'food',
  reviews: 'community', // KB-429: 키 reviews → 커뮤니티 라우트(전역 리뷰 피드) 재사용
  profile: 'profile',
};

/** Minimal structural slice of the navigation props we actually use. */
function AppTabBar({
  activeRoute,
  navigate,
}: {
  activeRoute: string;
  navigate: (name: string) => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const active = ROUTE_TO_KEY[activeRoute] ?? 'home';

  // P-213: app_tab_view(P-215 개명) — 활성 탭이 바뀔 때 1회(탭 탭·프로그램 전환·첫 진입 전부 포함,
  // 같은 탭 재탭은 무발화). 4탭 계측을 여기 한 곳으로 — 화면별 배선 금지.
  const lastTab = React.useRef<TabKey | null>(null);
  // KB-783: 탭이 **실제로 보일 때**만 딥링크 준비 — 보류분(지연 딥링크 포함)은 여기서 1회 이동.
  // #278 Codex P2: 레이아웃은 /login·/onboarding이 위에 push돼도 마운트로 남는다 → 마운트가 아니라 포커스(루트 스택에서 (tabs) 활성)를 따른다.
  useFocusEffect(
    React.useCallback(() => {
      setDeeplinkReady(true);
      return () => setDeeplinkReady(false);
    }, []),
  );
  React.useEffect(() => {
    if (lastTab.current === active) return;
    lastTab.current = active;
    if (active === 'home' && isEntryResolved()) airbridge.homeView(); // KB-783 ⑤ — 진입 게이트 정착 뒤만(#278 Codex 3R P2: 신규 설치의 로그인 전 홈 마운트 제외)
    // P-389(KB-576): user_type = BE 토큰 유무(서버가 아는 사실이 정본 — 로컬 플래그 금지 P-147).
    // 비동기라 이벤트가 한 틱 늦지만, 탭 전환 계측은 순서가 아니라 발화가 기준이다.
    // **모름(저장소 오류)이면 user_type을 빼고 보낸다** — 회원을 게스트로 찍는 것보다 빈 값이 낫다(Codex #165).
    void isRegisteredForAnalytics()
      .then((reg) => track(EVENTS.app_tab_view, { tab: active, ...(reg === null ? {} : { user_type: reg ? 'registered' : 'guest' }) }))
      .catch(() => track(EVENTS.app_tab_view, { tab: active }));
  }, [active]);

  return (
    <TabBar
      active={active}
      labels={{
        home: t('tabs.home'),
        food: t('tabs.food'),
        scan: t('tabs.scan'),
        reviews: t('tabs.reviews'), // KB-429 신설 키
        profile: t('tabs.profile'),
      }}
      onPress={(key) => navigate(KEY_TO_ROUTE[key])}
      onScan={() => router.navigate('/scan')}
    />
  );
}

/** KB-739: 광고 동의·초기화 1회 — 탭 진입(로그인/게스트 결정 뒤) + 스플래시 뒤 + 다음 틱(QA 4R: 기동 직후 ANR 의심 — 초기화를 스플래시 종료 프레임과
 *  분리). 로그인 화면의 푸시 프롬프트(whenSplashDone)와 겹치지 않게 여기 */
function useInitAdsOnce() {
  React.useEffect(() => {
    void whenSplashDone().then(() => { setTimeout(() => { void initAds(); }, 0); }); // RN 0.86: InteractionManager deprecated(QA 5R) — 다음 틱으로 미루는 의도만 유지
  }, []);
}

export default function TabsLayout() {
  useInitAdsOnce();
  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <AppTabBar
            activeRoute={props.state.routes[props.state.index]?.name ?? 'index'}
            navigate={(name) => {
              // KB-906(T-127): 기본 탭 바처럼 tabPress를 먼저 낸다 — 같은 탭 재탭 = 화면의 useScrollToTop이 맨 위로(직접 navigate만 하면 이벤트 0)
              const target = props.state.routes.find((r) => r.name === name);
              const focused = props.state.routes[props.state.index]?.name === name;
              const e = props.navigation.emit({ type: 'tabPress', target: target?.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) props.navigation.navigate(name as never);
            }}
          />
        )}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="food" />
        <Tabs.Screen name="community" />
        <Tabs.Screen name="profile" />
      </Tabs>
      {/* KB-110: resume nudge when an onboarding draft exists */}
      <ResumeOnboardingBanner />
    </>
  );
}
