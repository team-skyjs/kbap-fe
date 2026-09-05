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
import * as React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TabBar, type TabKey } from '@/components';
import { EVENTS, track } from '@/lib/analytics';
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
  React.useEffect(() => {
    if (lastTab.current === active) return;
    lastTab.current = active;
    track(EVENTS.app_tab_view, { tab: active });
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

export default function TabsLayout() {
  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <AppTabBar
            activeRoute={props.state.routes[props.state.index]?.name ?? 'index'}
            navigate={(name) => props.navigation.navigate(name as never)}
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
