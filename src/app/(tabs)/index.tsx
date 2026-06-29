/**
 * Home tab — app-shell skeleton (mockup B1): scroll-aware brand header with
 * search + notifications entry points. Real home content (recent + recommended)
 * lands in the Home screen unit; for now it shows the shell placeholder.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  ShellPlaceholder,
  SearchOverlay,
  NotificationsPanel,
} from '@/components';

export default function Home() {
  const { t } = useTranslation();
  const { scrollY, onScroll } = useStickyScroll();
  const headerH = useHeaderHeight({ largeTitle: true });
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 120, minHeight: 1000 }}
      >
        <ShellPlaceholder />
      </Animated.ScrollView>

      <StickyHeader
        scrollY={scrollY}
        mode="brand"
        largeTitle={t('brand')}
        search
        bell
        bellDot
        onSearch={() => setSearchOpen(true)}
        onBell={() => setNotifOpen(true)}
      />

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
});
