/**
 * Profile tab (mockup Screen I1) — identity, ranking ladder, dietary
 * restrictions, my reviews, and account rows (incl. delete account).
 *
 * Data via useMe()/useMyReviews()/useFoods() (MOCK_MODE). Scroll-aware brand
 * header; no emoji; reader text i18n'd; risk colors fixed.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  Rosette,
  Flag,
  RiskDot,
  RiskMark,
  Stars,
  IconProfile,
  IconEdit,
  IconGlobe,
  IconBell,
  IconGear,
  IconTrash,
  IconChevron,
  IconPlus,
} from '@/components';
import { useMe, useMyReviews } from '@/lib/data/useMe';
import { useFoods } from '@/lib/data/useFoods';
import { RANK_TIERS } from '@/lib/mocks/me';
import { restrictionLabel } from '@/lib/onboarding/data';
import type { FoodCard, Review } from '@/lib/api/types';

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { scrollY, onScroll } = useStickyScroll();
  const headerH = useHeaderHeight();

  const { data: me } = useMe();
  const { data: reviews } = useMyReviews();
  const { data: foods } = useFoods();

  const foodMap = new Map((foods ?? []).map((f) => [f.foodId, f]));
  const curTier = me ? RANK_TIERS.indexOf(me.rank.tier) : 0;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 110 }}
      >
        {me && (
          <View style={styles.body}>
            {/* identity */}
            <View style={styles.id}>
              <View style={styles.avatar}>
                <IconProfile size={30} color={C.primary} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.name}>{me.nickname}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={styles.pill}>
                    <Flag code={me.nationality} size={16} />
                    <Text style={styles.pillText}>{me.nationality}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{me.readerLanguage.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              <Pressable style={styles.edit} hitSlop={8}>
                <IconEdit size={18} color={C.ink2} />
              </Pressable>
            </View>

            {/* ranking */}
            <Section title={t('profile.rankingTitle')}>
              <View style={styles.rank}>
                <View style={styles.rankTop}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Rosette level={me.rank.level} size={42} />
                    <View>
                      <Text style={styles.rankTier}>{me.rank.tier}</Text>
                      <Text style={styles.tag}>{t('profile.levelPts', { level: me.rank.level, score: me.rank.score })}</Text>
                    </View>
                  </View>
                  {me.rank.nextTier && me.rank.pointsToNext != null && (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{t('profile.toNext', { points: me.rank.pointsToNext, tier: me.rank.nextTier })}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.rankProg}>
                  {RANK_TIERS.map((_, i) => (
                    <View key={i} style={[styles.rankSeg, i <= curTier && styles.rankSegOn]} />
                  ))}
                </View>
                <View style={styles.rankTiers}>
                  {RANK_TIERS.map((tn, i) => (
                    <Text key={tn} style={[styles.rt, i === curTier && styles.rtOn]}>
                      {tn}
                    </Text>
                  ))}
                </View>
                <Text style={styles.tag}>{t('profile.scoreNote')}</Text>
              </View>
            </Section>

            {/* dietary restrictions */}
            <Section
              title={t('profile.restrictionsTitle')}
              action={
                <Pressable style={styles.linkRow} hitSlop={8}>
                  <IconEdit size={14} color={C.primary} />
                  <Text style={styles.link}>{t('profile.edit')}</Text>
                </Pressable>
              }
            >
              <View style={styles.dietWrap}>
                {me.restrictions.map((r) => {
                  const danger = r.kind === 'allergy';
                  return (
                    <View key={r.code} style={[styles.dietChip, danger && styles.dietChipDanger]}>
                      {danger ? <RiskDot state="danger" size={13} /> : <IconProfile size={13} color={C.ink2} />}
                      <Text style={[styles.dietChipText, danger && styles.dietChipTextDanger]}>{restrictionLabel(r.code)}</Text>
                    </View>
                  );
                })}
                <Pressable style={styles.dietAdd} hitSlop={6}>
                  <IconPlus size={13} color={C.primary} />
                  <Text style={styles.dietAddText}>{t('profile.add')}</Text>
                </Pressable>
              </View>
            </Section>

            {/* my reviews */}
            <Section
              title={t('profile.myReviewsTitle', { count: reviews?.length ?? 0 })}
              action={<Text style={styles.link}>{t('profile.seeAll')}</Text>}
            >
              <View style={{ gap: 10 }}>
                {(reviews ?? []).map((rv) => (
                  <MyReview key={rv.id} review={rv} food={foodMap.get(rv.foodId)} onPress={() => router.push(`/food/${rv.foodId}` as Href)} />
                ))}
              </View>
            </Section>

            {/* account */}
            <Section title={t('profile.accountTitle')}>
              <View style={styles.acctList}>
                <AcctRow icon={<IconGlobe size={18} color={C.ink2} />} label={t('profile.language')} value={me.readerLanguage === 'en' ? 'English' : me.readerLanguage} />
                <AcctRow icon={<IconBell size={18} color={C.ink2} />} label={t('profile.notifications')} />
                <AcctRow icon={<IconGear size={18} color={C.ink2} />} label={t('profile.safetyNotice')} />
                <AcctRow
                  icon={<IconTrash size={18} color={C.riskDanger} />}
                  label={t('profile.deleteAccount')}
                  danger
                  onPress={() => router.push('/delete-account' as Href)}
                />
              </View>
            </Section>
          </View>
        )}
      </Animated.ScrollView>

      <StickyHeader scrollY={scrollY} mode="brand" bell />
    </View>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.sec}>
      <View style={styles.secHead}>
        <Text style={styles.secTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function MyReview({ review, food, onPress }: { review: Review; food?: FoodCard; onPress: () => void }) {
  return (
    <Pressable style={styles.myrev} onPress={onPress}>
      <View style={styles.myrevPh}>
        <RiskMark state={food?.risk ?? 'unable'} size={20} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={styles.myrevName} numberOfLines={1}>
            {food?.name ?? review.foodId}
          </Text>
          <Stars value={review.rating} size={13} />
        </View>
        {!!review.body && (
          <Text style={styles.myrevBody} numberOfLines={2}>
            {review.body}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function AcctRow({ icon, label, value, danger, onPress }: { icon: React.ReactNode; label: string; value?: string; danger?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={styles.acctRow} onPress={onPress}>
      <View style={styles.acctIc}>{icon}</View>
      <Text style={[styles.acctLabel, danger && { color: C.riskDanger }]}>{label}</Text>
      {value && <Text style={styles.tag}>{value}</Text>}
      <IconChevron size={16} color={danger ? C.riskDanger : C.ink2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 4, gap: 20 },

  id: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(226,88,12,0.08)', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: font.display, fontSize: 20, color: C.ink },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  pillText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink },
  edit: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },

  sec: { gap: 11 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secTitle: { fontFamily: font.display, fontSize: 17, color: C.ink },
  link: { fontFamily: font.bodyBold, fontSize: 13, color: C.primary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // ranking
  rank: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 16, gap: 12, ...shadow.sh1 },
  rankTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankTier: { fontFamily: font.display, fontSize: 16, color: C.ink },
  tag: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  rankProg: { flexDirection: 'row', gap: 4 },
  rankSeg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.surface2 },
  rankSegOn: { backgroundColor: C.primary },
  rankTiers: { flexDirection: 'row', justifyContent: 'space-between' },
  rt: { fontFamily: font.body, fontSize: 10, color: C.ink3 },
  rtOn: { fontFamily: font.bodyBold, color: C.primary },

  // dietary
  dietWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dietChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  dietChipDanger: { backgroundColor: '#fdecea', borderColor: '#f3cdc8' },
  dietChipText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink },
  dietChipTextDanger: { color: C.riskDanger },
  dietAdd: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', paddingHorizontal: 12, paddingVertical: 8 },
  dietAddText: { fontFamily: font.bodyBold, fontSize: 13, color: C.primary },

  // my reviews
  myrev: { flexDirection: 'row', gap: 11, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12, ...shadow.sh1 },
  myrevPh: { width: 44, height: 44, borderRadius: 11, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  myrevName: { flex: 1, fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  myrevBody: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 18 },

  // account
  acctList: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sh1 },
  acctRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  acctIc: { width: 30, alignItems: 'center' },
  acctLabel: { flex: 1, fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
});
