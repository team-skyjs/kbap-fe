/**
 * Food reviews (mockup Screen G2, FR-023) — reviews for one dish with a
 * same-nationality filter and a translate (original ↔ reader-language) toggle.
 * Reached from the detail rating cards. No risk rendering here.
 *
 * Anonymized reviews hide author identity (nationality/name). Scroll-aware back
 * header (§6); no emoji (SVG); reader text via i18n (English only for MVP).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  Stars,
  Flag,
  Rosette,
  StateBlock,
  stateIconColor,
  Spinner,
  IconGlobe,
  IconProfile,
  IconBubbleEmpty,
  IconPlus,
} from '@/components';
import { useFoodReviews } from '@/lib/data/useFoodReviews';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { useReviewTranslation } from '@/lib/data/useReviewTranslation';
import type { RatingAggregate, Review } from '@/lib/api/types';

const READER_LANG = 'en'; // MVP reader language

export default function FoodReviews() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { scrollY, onScroll } = useStickyScroll();
  const headerH = useHeaderHeight();

  const { data: reviews } = useFoodReviews(id ?? '');
  const { data: food } = useFoodDetail(id ?? '');
  const { data: me } = useMe();

  const [sameNatOnly, setSameNatOnly] = useState(false);

  const nationality = me?.nationality ?? 'US';
  const all = reviews?.items ?? [];
  const items = sameNatOnly ? all.filter((r) => r.authorNationality === nationality) : all;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 40 }}
      >
        {reviews && (
          <View style={styles.body}>
            {/* dish header */}
            <View>
              <Text style={styles.dishName}>{food?.name ?? ''}</Text>
              <Text style={styles.dishSub}>
                {food?.nameKo ? `${food.nameKo} · ` : ''}
                {t('reviews.subtitle', { count: reviews.overall.count })}
              </Text>
            </View>

            {/* rating summary */}
            <View style={styles.summary}>
              <RateCol label={t('reviews.overall')} agg={reviews.overall} />
              <View style={styles.divider} />
              <RateCol
                label={t('reviews.sameNationality')}
                agg={reviews.sameNationality}
                left={<Flag code={nationality} size={14} />}
              />
            </View>

            {/* filter — same-nationality only (translation is now per-review) */}
            <View style={styles.filters}>
              <Pressable style={styles.filter} onPress={() => setSameNatOnly((v) => !v)}>
                <Flag code={nationality} size={16} />
                <Text style={styles.filterLbl}>{t('reviews.sameNationalityOnly', { country: nationality })}</Text>
                <Switch on={sameNatOnly} />
              </Pressable>
            </View>

            {/* list or empty */}
            {items.length === 0 ? (
              <StateBlock
                icon={<IconBubbleEmpty size={38} color={stateIconColor.default} />}
                title={t('reviews.emptyTitle')}
                body={t('reviews.emptyBody')}
                primary={{
                  label: t('reviews.writeReview'),
                  icon: <IconPlus size={17} color="#fff" />,
                  onPress: () => router.push(`/food/${id}/review` as Href),
                }}
              />
            ) : (
              <View style={{ gap: 12 }}>
                {items.map((r) => (
                  <ReviewItem key={r.id} review={r} t={t} />
                ))}
              </View>
            )}
          </View>
        )}
      </Animated.ScrollView>

      <StickyHeader scrollY={scrollY} mode="back" title={t('reviews.headerTitle')} onBack={() => router.back()} />
    </View>
  );
}

type TFn = ReturnType<typeof useTranslation>['t'];

function RateCol({ label, agg, left }: { label: string; agg: RatingAggregate; left?: React.ReactNode }) {
  return (
    <View style={styles.rateCol}>
      <View style={styles.rateLblRow}>
        {left}
        <Text style={styles.rateLbl}>{label}</Text>
      </View>
      <Text style={styles.rateNum}>{agg.average?.toFixed(1) ?? '—'}</Text>
      <Stars value={agg.average ?? 0} size={14} />
      <Text style={styles.rateCount}>{agg.count}</Text>
    </View>
  );
}

function ReviewItem({ review, t }: { review: Review; t: TFn }) {
  const anon = review.anonymized;
  const tx = useReviewTranslation(review, READER_LANG);
  const langName = t(`reviews.lang.${tx.fromLang}`, { defaultValue: tx.fromLang });

  return (
    <View style={styles.item}>
      <View style={styles.itemTop}>
        <View style={styles.who}>
          {anon || !review.authorNationality ? (
            <View style={styles.anonAvatar}>
              <IconProfile size={14} color={C.ink3} />
            </View>
          ) : (
            <Flag code={review.authorNationality} size={20} />
          )}
          <Text style={styles.whoName}>{anon ? t('reviews.anonymous') : review.authorNationality}</Text>
          {!anon && !!review.authorRankTier && (
            <View style={styles.rankPill}>
              <Rosette level={3} size={15} />
              <Text style={styles.rankText}>{review.authorRankTier}</Text>
            </View>
          )}
        </View>
        <Stars value={review.rating} size={14} />
      </View>

      {!!tx.text && (
        <Text style={[styles.reviewBody, review.bodyLanguage === 'ko' && styles.reviewBodyKo]}>{tx.text}</Text>
      )}

      {/* per-review translation control (only when not already in reader language) */}
      {tx.canTranslate && (
        <View style={styles.txRow}>
          {tx.loading ? (
            <View style={styles.txInline}>
              <Spinner size={14} color={C.accent} />
              <Text style={styles.txMuted}>{t('reviews.translating')}</Text>
            </View>
          ) : tx.error ? (
            <View style={styles.txInline}>
              <Text style={styles.txError}>{t('reviews.translateFailed')}</Text>
              <Text style={styles.dot}>·</Text>
              <Pressable onPress={tx.retry} hitSlop={6}>
                <Text style={styles.txLink}>{t('reviews.retry')}</Text>
              </Pressable>
            </View>
          ) : tx.showingTranslated ? (
            <View style={styles.txInline}>
              <Text style={styles.txMuted}>{t('reviews.translatedFrom', { lang: langName })}</Text>
              <Text style={styles.dot}>·</Text>
              <Pressable onPress={tx.showOriginal} hitSlop={6}>
                <Text style={styles.txLink}>{t('reviews.showOriginal')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.txInline} onPress={tx.translate} hitSlop={6}>
              <IconGlobe size={14} color={C.accent} />
              <Text style={styles.txLink}>{t('reviews.translate')}</Text>
            </Pressable>
          )}
        </View>
      )}

      <Text style={styles.when}>{relativeDate(review.createdAt, t)}</Text>
    </View>
  );
}

function relativeDate(iso: string, t: TFn): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return t('reviews.today');
  if (days < 7) return t('reviews.daysAgo', { count: days });
  return t('reviews.weeksAgo', { count: Math.floor(days / 7) });
}

function Switch({ on }: { on: boolean }) {
  return (
    <View style={[styles.sw, on && styles.swOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 4, gap: 16 },

  dishName: { fontFamily: font.display, fontSize: 22, color: C.ink },
  dishSub: { fontFamily: font.ko, fontSize: 13, color: C.ink2, marginTop: 3 },

  summary: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 16, ...shadow.sh1 },
  rateCol: { flex: 1, alignItems: 'center', gap: 4 },
  rateLblRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rateLbl: { fontFamily: font.body, fontSize: 11, letterSpacing: 0.3, color: C.ink3, textTransform: 'uppercase' },
  rateNum: { fontFamily: font.displayBlack, fontSize: 32, color: C.ink, lineHeight: 34 },
  rateCount: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  divider: { width: 1, backgroundColor: C.hair, marginHorizontal: 6 },

  filters: { flexDirection: 'row', gap: 10 },
  filter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, ...shadow.sh1 },
  filterLbl: { flex: 1, fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink },

  sw: { width: 34, height: 20, borderRadius: 10, backgroundColor: C.line, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },

  item: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 14, gap: 8, ...shadow.sh1 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  anonAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  whoName: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  rankText: { fontFamily: font.bodyBold, fontSize: 11, color: C.ink2 },
  reviewBody: { fontFamily: font.body, fontSize: 14, color: C.ink, lineHeight: 20 },
  reviewBodyKo: { fontFamily: font.ko },
  txRow: { flexDirection: 'row', alignItems: 'center' },
  txInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txLink: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.accent },
  txMuted: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  txError: { fontFamily: font.body, fontSize: 12, color: C.riskDanger },
  dot: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  when: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
});
