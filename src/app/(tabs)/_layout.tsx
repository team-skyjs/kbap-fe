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
import { Tabs, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TabBar, type TabKey } from '@/components';

// route name (file) ↔ TabBar key
const ROUTE_TO_KEY: Record<string, TabKey> = {
  index: 'home',
  food: 'food',
  community: 'community',
  profile: 'profile',
};
const KEY_TO_ROUTE: Record<TabKey, string> = {
  home: 'index',
  food: 'food',
  community: 'community',
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

  return (
    <TabBar
      active={active}
      labels={{
        home: t('tabs.home'),
        food: t('tabs.food'),
        scan: t('tabs.scan'),
        community: t('tabs.community'),
        profile: t('tabs.profile'),
      }}
      onPress={(key) => navigate(KEY_TO_ROUTE[key])}
      onScan={() => router.push('/scan')}
    />
  );
}

export default function TabsLayout() {
  return (
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
  );
}
