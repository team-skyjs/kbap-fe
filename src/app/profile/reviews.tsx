/**
 * My reviews list (mockup Screen I7) — reached from "See all" on the profile
 * tab's My reviews section (KB-85). Stat header (count + avg given) + Recent/
 * Top-rated sort + review cards. Tapping a card opens that dish's detail
 * (review editing is KB-73, out of scope here). Empty state when no reviews.
 *
 * Data via useMyReviews() (MOCK_MODE); food name/nameKo/risk joined from
 * useFoods() by foodId. Risk passes through personalRisk() (false-safe guard).
 * Helpful-votes / "most helpful" sort from the design are omitted — not in the
 * review contract yet (BE 논의).
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow, type RiskState } from '@/lib/theme';
import { SubHeader, RiskMark, Stars, IconChevron, IconFood } from '@/components';
import { useMe, useMyReviews } from '@/lib/data/useMe';
import { useFoods } from '@/lib/data/useFoods';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { personalRisk } from '@/lib/risk';
import type { FoodCard, Review } from '@/lib/api/types';

type TFn = ReturnType<typeof useTranslation>['t'];
type SortKey = 'recent' | 'rating';

export default function MyReviews() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: reviews } = useMyReviews();
  const { data: foods } = useFoods();
  const { data: me } = useMe();
  const [sort, setSort] = useState<SortKey>('recent');

  const foodMap = useMemo(() => new Map((foods ?? []).map((f) => [f.foodId, f])), [foods]);
  const hasR = (me?.restrictions.length ?? 0) > 0;

  const list = useMemo(() => {
    const arr = [...(reviews ?? [])];
    arr.sort((a, b) => {
      const recent = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === 'rating' ? b.rating - a.rating || recent : recent;
    });
    return arr;
  }, [reviews, sort]);

  const count = reviews?.length ?? 0;
  const avg = count ? (reviews as Review[]).reduce((s, r) => s + r.rating, 0) / count : null;
  const isGuest = useIsGuest();

  // 라우트 자체 가드 (⑧-b) — 진입로는 프로필 탭(게이트)뿐이지만 딥링크 이중 방어.
  // 게스트는 콘텐츠(mock 포함) 미마운트, 시트 닫으면 뒤로.
  if (isGuest) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('myReviews.title')} onBack={() => router.back()} />
        <AuthGateSheet context="profile" open onClose={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SubHeader title={t('myReviews.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {count === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIc}>
              <IconFood size={30} color={C.ink3} />
            </View>
            <Text style={styles.emptyTitle}>{t('myReviews.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('myReviews.emptyBody')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.stat}>
              <StatBig value={String(count)} label={t('myReviews.statReviews')} />
              <View style={styles.sd} />
              <StatBig value={(avg ?? 0).toFixed(1)} label={t('myReviews.statAvgGiven')} color={C.primary} />
            </View>

            <View style={styles.sortRow}>
              <SortPill label={t('reviews.sortRecent')} on={sort === 'recent'} onPress={() => setSort('recent')} />
              <SortPill label={t('reviews.sortTopRated')} on={sort === 'rating'} onPress={() => setSort('rating')} />
            </View>

            <View style={{ gap: 10 }}>
              {list.map((rv) => (
                <ReviewCard
                  key={rv.id}
                  review={rv}
                  food={foodMap.get(rv.foodId)}
                  hasR={hasR}
                  when={relativeDate(rv.createdAt, t)}
                  onPress={() => router.push(`/review/${rv.id}` as Href)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatBig({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.big}>
      <Text style={[styles.bigNum, color ? { color } : null]}>{value}</Text>
      <Text style={styles.bigLbl}>{label}</Text>
    </View>
  );
}

function SortPill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.pill, on && styles.pillOn]} onPress={onPress} hitSlop={6}>
      <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ReviewCard({ review, food, hasR, when, onPress }: { review: Review; food?: FoodCard; hasR: boolean; when: string; onPress: () => void }) {
  const risk: RiskState = food ? personalRisk(food.risk, hasR) : 'unable';
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.thumb}>
        <IconFood size={22} color={C.ink3} />
        <View style={styles.bdg}>
          <RiskMark state={risk} size={14} />
        </View>
      </View>
      <View style={styles.main}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {food?.name ?? review.foodId}
          </Text>
          <Stars value={review.rating} size={13} />
        </View>
        {!!review.body && (
          <Text style={styles.cardBody} numberOfLines={2}>
            {review.body}
          </Text>
        )}
        <View style={styles.foot}>
          <Text style={styles.tag}>{when}</Text>
        </View>
      </View>
      <IconChevron size={16} color={C.ink3} style={{ alignSelf: 'center' }} />
    </Pressable>
  );
}

function relativeDate(iso: string, t: TFn): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return t('reviews.today');
  if (days < 7) return t('reviews.daysAgo', { count: days });
  return t('reviews.weeksAgo', { count: Math.floor(days / 7) });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32, gap: 14 },

  stat: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 15, ...shadow.sh1 },
  big: { flex: 1, alignItems: 'center', gap: 3 },
  bigNum: { fontFamily: font.display, fontSize: 30, color: C.ink, lineHeight: 40 },
  bigLbl: { fontFamily: font.body, fontSize: 10.5, color: C.ink3 },
  sd: { width: 1, alignSelf: 'stretch', backgroundColor: C.hair },

  sortRow: { flexDirection: 'row', gap: 8 },
  pill: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  pillOn: { backgroundColor: C.primary, borderColor: C.primary },
  pillText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 },
  pillTextOn: { color: '#fff' },

  card: { flexDirection: 'row', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12, ...shadow.sh1 },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  bdg: { position: 'absolute', bottom: -3, right: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  main: { flex: 1, minWidth: 0, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  cardBody: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 19 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },

  empty: { alignItems: 'center', gap: 12, paddingHorizontal: 28, paddingTop: 60 },
  emptyIc: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: font.display, fontSize: 19, color: C.ink, textAlign: 'center' },
  emptyBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, textAlign: 'center', lineHeight: 20 },
});
