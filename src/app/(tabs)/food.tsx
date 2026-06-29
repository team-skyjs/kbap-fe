/**
 * Food tab — shell stub. Real browse/search UI lands in the Food screen unit.
 */
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { StickyHeader, useStickyScroll, useHeaderHeight, ShellPlaceholder } from '@/components';

export default function Food() {
  const { t } = useTranslation();
  const { scrollY, onScroll } = useStickyScroll();
  const headerH = useHeaderHeight({ largeTitle: true });

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
      <StickyHeader scrollY={scrollY} mode="brand" largeTitle={t('tabs.food')} search />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: C.surface } });
