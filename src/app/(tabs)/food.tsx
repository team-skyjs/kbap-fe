/**
 * Food tab (mockup Screen G1) — browse every dish tagged with the user's risk.
 * Scroll-aware brand header + greeting, inline search entry (opens the shared
 * SearchOverlay), category chips, and a 2-column browse grid.
 *
 * Data via useFoods() (MOCK_MODE). Tapping a card opens the detail (screen #4).
 * Category chips are visual selection only in mock (FoodCard has no category;
 * real filtering uses the /foods?category= param once live).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  SearchOverlay,
  SkeletonList,
  RiskMark,
  Stars,
  IconSearch,
} from '@/components';
import { useFoods } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import type { FoodCard } from '@/lib/api/types';

const CATEGORY_KEYS = ['all', 'stews', 'rice', 'noodles', 'bbq', 'street', 'sides'];

export default function Food() {
  const { t } = useTranslation();
  const router = useRouter();
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();
  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState('all');

  const { data: foods, isLoading } = useFoods();
  const { data: me } = useMe();
  const hasR = (me?.restrictions.length ?? 0) > 0;
  const list = foods ?? [];

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 110 }}
      >
        <View style={styles.body}>
          <View style={styles.greet}>
            <Text style={styles.greetTitle}>{t('food.title')}</Text>
            <Text style={styles.greetSub}>{t('food.sub')}</Text>
          </View>

          {/* search entry → shared overlay */}
          <Pressable style={styles.search} onPress={() => setSearchOpen(true)}>
            <IconSearch size={18} color={C.ink2} />
            <Text style={styles.searchPh}>{t('food.searchPlaceholder')}</Text>
          </Pressable>

          {/* category chips */}
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 1 }}
          >
            {CATEGORY_KEYS.map((key) => {
              const on = category === key;
              return (
                <Pressable key={key} style={[styles.catChip, on && styles.catChipOn]} onPress={() => setCategory(key)}>
                  <Text style={[styles.catChipText, on && styles.catChipTextOn]}>{t(`food.categories.${key}`)}</Text>
                </Pressable>
              );
            })}
          </Animated.ScrollView>

          {/* browse grid */}
          {isLoading ? (
            <SkeletonList />
          ) : (
            <View style={styles.grid}>
              {list.map((f) => (
                <BrowseCard key={f.foodId} food={f} hasRestrictions={hasR} onPress={() => router.push(`/food/${f.foodId}` as Href)} />
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <StickyHeader hidden={hidden} mode="brand" bell />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </View>
  );
}

function BrowseCard({ food, hasRestrictions, onPress }: { food: FoodCard; hasRestrictions: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.photo}>
        <View style={styles.badge}>
          <RiskMark state={personalRisk(food.risk, hasRestrictions)} size={20} />
        </View>
      </View>
      <View style={styles.cardB}>
        <Text style={styles.name} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.ko} numberOfLines={1}>
          {food.nameKo}
        </Text>
        <View style={styles.rate}>
          <Stars value={food.overall.average ?? 0} size={13} />
          <Text style={styles.rateNum}>
            {food.overall.average?.toFixed(1) ?? '—'} · {food.overall.count}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 4, gap: 16 },

  greet: { gap: 2 },
  greetTitle: { fontFamily: font.display, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  greetSub: { fontFamily: font.body, fontSize: 15, color: C.ink2 },

  search: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, ...shadow.sh1 },
  searchPh: { flex: 1, fontFamily: font.body, fontSize: 14.5, color: C.ink3 },

  catChip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 },
  catChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  catChipText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2 },
  catChipTextOn: { color: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: { width: '48.5%', backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sh2 },
  photo: { height: 102, backgroundColor: C.surface2 },
  badge: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  cardB: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 4 },
  name: { fontFamily: font.display, fontSize: 14.5, color: C.ink },
  ko: { fontFamily: font.ko, fontSize: 12, color: C.ink2 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  rateNum: { fontFamily: font.bodyBold, fontSize: 12, color: C.ink2 },
});
