/**
 * Food tab (mockup Screen G1) — browse every dish tagged with the user's risk.
 * Scroll-aware brand header + greeting, inline search entry (opens the
 * full-screen /search route), category chips, and a 2-column browse grid.
 *
 * Grid data is LIVE (KB-71): GET /api/v1/foods keyset pages via
 * useInfiniteFoods — scrolling near the end fetches the next cursor until
 * hasNext=false. Tapping a card opens the detail with the BE's numeric foodId
 * (KB-70). Category chips are visual selection only (no category param in the
 * list contract yet); ratings show the null aggregate until reviews land (KB-73).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  SkeletonFoodGrid,
  Spinner,
  QueryErrorBlock,
  RiskMark,
  CardPhoto,
  Stars,
  IconSearch,
  IconFood,
} from '@/components';
import { useInfiniteFoods } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { FLAGS } from '@/lib/flags';
import { useIsGuest } from '@/lib/auth/useSession';
import type { FoodCard } from '@/lib/api/types';

const CATEGORY_KEYS = ['all', 'stews', 'rice', 'noodles', 'bbq', 'street', 'sides'];

export default function Food() {
  const { t } = useTranslation();
  const router = useRouter();
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();
  const [category, setCategory] = useState('all');

  const { data: foods, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteFoods();
  const { data: me } = useMe();
  const hasR = (me?.restrictions.length ?? 0) > 0;
  const isGuest = useIsGuest();
  const list = foods ?? [];

  const Header = (
    <View style={styles.head}>
      <View style={styles.greet}>
        <Text style={styles.greetTitle}>{t('food.title')}</Text>
        <Text style={styles.greetSub}>{t('food.sub')}</Text>
      </View>

      {/* search entry → full-screen search route */}
      <Pressable style={styles.search} onPress={() => router.push('/search' as Href)}>
        <IconSearch size={18} color={C.ink2} />
        <Text style={styles.searchPh}>{t('food.searchPlaceholder')}</Text>
      </Pressable>

      {/* category chips — MVP-excluded behind a flag (KB-108); flip to restore */}
      {FLAGS.categoryUI && (
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
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {isError ? (
        /* P-036(Q-08 ①): 에러/오프라인은 **캐시 유무 무관** 전체화면 J3/J4 —
           P-027의 ListEmptyComponent 경유는 캐시가 있으면 리스트가 비어있지 않아
           에러 화면이 안 떴다(캐시 목록+무헤더 어중간 상태). 리스트 자체를 대체
           하므로 onEndReached·푸터 스피너 경로도 원천 차단. 헤더 미렌더는 유지. */
        <View style={styles.errorFill}>
          <QueryErrorBlock error={error} onRetry={() => void refetch()} />
        </View>
      ) : (
        <Animated.FlatList
          data={list}
          keyExtractor={(f: FoodCard) => f.foodId}
          numColumns={2}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: headerH, paddingBottom: 110, paddingHorizontal: 18, gap: 12 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          ListHeaderComponent={Header}
          ListEmptyComponent={isLoading ? <SkeletonFoodGrid /> : null}
          ListFooterComponent={isFetchingNextPage ? <Spinner /> : null}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          renderItem={({ item }) => (
            <BrowseCard food={item} hasRestrictions={hasR} guest={isGuest} onPress={() => router.push(`/food/${item.foodId}` as Href)} />
          )}
        />
      )}

      <StickyHeader hidden={hidden} mode="brand" bell signIn={isGuest} onSignIn={() => router.push('/login' as Href)} />
    </View>
  );
}

export function BrowseCard({ food, hasRestrictions, guest, onPress }: { food: FoodCard; hasRestrictions: boolean; guest: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.photo}>
        {!!food.photoUrl && (
          <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} />
        )}
        {/* 게스트에겐 개인화 뱃지 미렌더 — 자리 비움 (guest-access-policy §1) */}
        {!guest && (
          <View style={styles.badge}>
            <RiskMark state={personalRisk(food.risk, hasRestrictions)} size={20} />
          </View>
        )}
      </View>
      <View style={styles.cardB}>
        <Text style={styles.name} numberOfLines={1}>
          {food.name}
        </Text>
        {food.nameKo !== food.name && (
          <Text style={styles.ko} numberOfLines={1}>
            {food.nameKo}
          </Text>
        )}
        {FLAGS.reviewsEnabled && (
          <View style={styles.rate}>
            <Stars value={food.overall.average ?? 0} size={13} />
            <Text style={styles.rateNum}>
              {food.overall.average?.toFixed(1) ?? '—'} · {food.overall.count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  errorFill: { flex: 1, justifyContent: 'center' }, // P-036: 전체화면 J3/J4
  head: { paddingTop: 4, gap: 16 },

  greet: { gap: 2 },
  greetTitle: { fontFamily: font.display, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  greetSub: { fontFamily: font.body, fontSize: 15, color: C.ink2 },

  search: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, ...shadow.sh1 },
  searchPh: { flex: 1, fontFamily: font.body, fontSize: 14.5, color: C.ink3 },

  catChip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 },
  catChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  catChipText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2 },
  catChipTextOn: { color: '#fff' },

  card: { width: '48.5%', backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sh2 },
  photo: { height: 102, backgroundColor: C.surface2 },
  badge: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  cardB: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 4 },
  name: { fontFamily: font.display, fontSize: 14.5, color: C.ink },
  ko: { fontFamily: font.ko, fontSize: 12, color: C.ink2 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  rateNum: { fontFamily: font.bodyBold, fontSize: 12, color: C.ink2 },
});
