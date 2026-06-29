/**
 * Home tab (mockup Screen C) — personalized hub. Scroll-aware brand header
 * (shared StickyHeader) over: greeting · diet banner · scan CTA · "Safe for you
 * today" (recommended) · recently scanned · browse categories · safety notice.
 *
 * Data via useHome()/useMe() hooks (MOCK_MODE). Empty state when no recent scans.
 * No emoji (SVG), reader text i18n'd, risk colors fixed (Constitution).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  SearchOverlay,
  NotificationsPanel,
  SkeletonList,
  Btn,
  RiskMark,
  RiskDot,
  Stars,
  Star,
  CatStew,
  CatBowl,
  CatNoodle,
  CatBBQ,
  CatStreet,
  CatSides,
  IconCamera,
  IconChevron,
  IconScanLines,
  IconFood,
  type IconProps,
} from '@/components';
import { useHome } from '@/lib/data/useHome';
import { useMe } from '@/lib/data/useMe';
import { restrictionLabel } from '@/lib/onboarding/data';
import type { FoodCard } from '@/lib/api/types';

const CATEGORIES: { key: string; Icon: (p: IconProps) => React.JSX.Element }[] = [
  { key: 'stews', Icon: CatStew },
  { key: 'rice', Icon: CatBowl },
  { key: 'noodles', Icon: CatNoodle },
  { key: 'bbq', Icon: CatBBQ },
  { key: 'street', Icon: CatStreet },
  { key: 'sides', Icon: CatSides },
];

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { scrollY, onScroll } = useStickyScroll();
  const headerH = useHeaderHeight();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: home, isLoading } = useHome();
  const { data: me } = useMe();

  const recent = home?.recent ?? [];
  const recommended = home?.recommended ?? [];
  const restrictions = me?.restrictions ?? [];
  const hasScans = recent.length > 0;
  // forward links to routes built in later screens (detail #4, review #6)
  const openFood = (foodId: string) => router.push(`/food/${foodId}` as Href);

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 110 }}
      >
        {isLoading ? (
          <SkeletonList />
        ) : (
          <View style={styles.body}>
            {/* greeting */}
            <View style={styles.greet}>
              <Text style={styles.greetTitle}>{t('home.greeting', { name: me?.nickname ?? '' })}</Text>
              <Text style={styles.greetSub}>
                {hasScans ? t('home.greetingSub') : t('home.greetingSubEmpty')}
              </Text>
            </View>

            {/* diet banner */}
            {restrictions.length > 0 && (
              <View style={styles.diet}>
                <View style={styles.dietHead}>
                  <RiskMark state="danger" size={20} />
                  <Text style={styles.dietTitle}>{t('home.avoidCount', { count: restrictions.length })}</Text>
                  <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
                    <Text style={styles.link}>{t('home.edit')}</Text>
                  </Pressable>
                </View>
                <Animated.ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 7, paddingVertical: 1 }}
                >
                  {restrictions.map((r) => (
                    <View key={r.code} style={styles.achip}>
                      <RiskDot state="danger" size={12} />
                      <Text style={styles.achipText}>{restrictionLabel(r.code)}</Text>
                    </View>
                  ))}
                </Animated.ScrollView>
              </View>
            )}

            {/* scan CTA or empty block */}
            {hasScans ? (
              <Pressable onPress={() => router.push('/scan')}>
                <LinearGradient
                  colors={[C.primary, C.primary2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.scanCta}
                >
                  <View style={styles.scanIc}>
                    <IconCamera size={28} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scanTitle}>{t('home.scanTitle')}</Text>
                    <Text style={styles.scanSub}>{t('home.scanSub')}</Text>
                  </View>
                  <IconChevron size={20} color="#fff" />
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIc}>
                  <IconScanLines size={34} color={C.primary} />
                </View>
                <Text style={styles.emptyTitle}>{t('home.emptyTitle')}</Text>
                <Text style={styles.emptyBody}>{t('home.emptyBody')}</Text>
                <View style={styles.emptyBtns}>
                  <Btn sm icon={<IconScanLines size={16} color="#fff" />} onPress={() => router.push('/scan')}>
                    {t('home.scan')}
                  </Btn>
                  <Btn sm variant="ghost" icon={<IconFood size={16} color={C.ink} />} onPress={() => router.push('/food')}>
                    {t('home.explore')}
                  </Btn>
                </View>
              </View>
            )}

            {/* safe for you / popular */}
            {recommended.length > 0 && (
              <Section
                icon={<RiskMark state="safe" size={22} />}
                title={hasScans ? t('home.safeTitle') : t('home.popularTitle')}
                sub={hasScans ? t('home.safeSub') : t('home.popularSub')}
                seeAll={t('home.seeAll')}
                onSeeAll={() => router.push('/food')}
              >
                <Animated.ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 13, paddingVertical: 4 }}
                >
                  {recommended.map((d) => (
                    <SafeCard key={d.foodId} food={d} onPress={() => openFood(d.foodId)} />
                  ))}
                </Animated.ScrollView>
              </Section>
            )}

            {/* recently scanned */}
            {hasScans && (
              <Section title={t('home.recentTitle')} sub={t('home.recentSub')} seeAll={t('home.seeAll')} onSeeAll={() => router.push('/food')}>
                <View style={{ gap: 10 }}>
                  {recent.map((d) => (
                    <RecentRow key={d.foodId} food={d} reviewLabel={t('home.review')} onPress={() => openFood(d.foodId)} />
                  ))}
                </View>
              </Section>
            )}

            {/* categories */}
            <Section title={t('home.categoriesTitle')}>
              <View style={styles.catGrid}>
                {CATEGORIES.map(({ key, Icon }) => (
                  <Pressable key={key} style={styles.cat} onPress={() => router.push('/food')}>
                    <View style={styles.catGlyph}>
                      <Icon size={18} color={C.accent} />
                    </View>
                    <Text style={styles.catLbl}>{t(`home.categories.${key}`)}</Text>
                    <IconChevron size={16} color={C.ink3} />
                  </Pressable>
                ))}
              </View>
            </Section>

            {/* safety notice (FR-030) */}
            <View style={styles.disc}>
              <RiskMark state="caution" size={15} variant="outline" />
              <Text style={styles.discText}>{t('home.disclaimer')}</Text>
            </View>
          </View>
        )}
      </Animated.ScrollView>

      <StickyHeader
        scrollY={scrollY}
        mode="brand"
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

/* ---------- pieces ---------- */

function Section({
  icon,
  title,
  sub,
  seeAll,
  onSeeAll,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  seeAll?: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sec}>
      <View style={styles.secHead}>
        {icon}
        <Text style={styles.secTitle}>{title}</Text>
        {seeAll && (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={styles.link}>{seeAll}</Text>
          </Pressable>
        )}
      </View>
      {!!sub && <Text style={styles.secSub}>{sub}</Text>}
      {children}
    </View>
  );
}

function SafeCard({ food, onPress }: { food: FoodCard; onPress: () => void }) {
  return (
    <Pressable style={styles.safeCard} onPress={onPress}>
      <View style={styles.photo}>
        <View style={styles.photoBadge}>
          <RiskMark state={food.risk} size={20} />
        </View>
      </View>
      <View style={styles.cardB}>
        <Text style={styles.nm} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.koSm} numberOfLines={1}>
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

function RecentRow({ food, reviewLabel, onPress }: { food: FoodCard; reviewLabel: string; onPress: () => void }) {
  const router = useRouter();
  return (
    <Pressable style={styles.rec} onPress={onPress}>
      <View style={styles.recThumb}>
        <IconFood size={24} color={C.primary} />
        <View style={styles.recBadge}>
          <RiskMark state={food.risk} size={15} />
        </View>
      </View>
      <View style={styles.recMeta}>
        <Text style={styles.nm} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.koSm} numberOfLines={1}>
          {food.nameKo}
        </Text>
      </View>
      <Pressable style={styles.reviewBtn} onPress={() => router.push(`/food/${food.foodId}/review` as Href)} hitSlop={6}>
        <Star size={13} fillPct={100} fillColor={C.primary} />
        <Text style={styles.reviewBtnText}>{reviewLabel}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 4, gap: 20 },

  greet: { gap: 2 },
  greetTitle: { fontFamily: font.display, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  greetSub: { fontFamily: font.body, fontSize: 15, color: C.ink2 },

  link: { fontFamily: font.bodyBold, fontSize: 13, color: C.primary },

  // diet banner
  diet: { borderRadius: radius.lg, backgroundColor: '#fdf0ee', borderWidth: 1, borderColor: '#f1cfca', padding: 14, gap: 11 },
  dietHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dietTitle: { flex: 1, fontFamily: font.display, fontSize: 15, color: C.ink },
  achip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eeccc8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  achipText: { fontFamily: font.bodyBold, fontSize: 12, color: C.riskDanger },

  // scan CTA
  scanCta: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: radius.lg, padding: 16, ...shadow.sh2 },
  scanIc: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontFamily: font.display, fontSize: 18, color: '#fff' },
  scanSub: { fontFamily: font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.9)', marginTop: 1 },

  // empty
  empty: { alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, paddingVertical: 26, paddingHorizontal: 22, ...shadow.sh1 },
  emptyIc: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(226,88,12,0.08)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: font.display, fontSize: 18, color: C.ink },
  emptyBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, textAlign: 'center', maxWidth: 260, lineHeight: 19 },
  emptyBtns: { flexDirection: 'row', gap: 9, marginTop: 6 },

  // sections
  sec: { gap: 11 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  secTitle: { flex: 1, fontFamily: font.display, fontSize: 17, color: C.ink },
  secSub: { fontFamily: font.body, fontSize: 13, color: C.ink2, marginTop: -6 },

  // safe card
  safeCard: { width: 162, backgroundColor: C.card, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: C.hair, ...shadow.sh2 },
  photo: { height: 112, backgroundColor: C.surface2 },
  photoBadge: { position: 'absolute', top: 9, right: 9, width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  cardB: { padding: 11, gap: 5 },
  nm: { fontFamily: font.display, fontSize: 15, color: C.ink },
  koSm: { fontFamily: font.ko, fontSize: 12, color: C.ink2 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  rateNum: { fontFamily: font.bodyBold, fontSize: 12, color: C.ink2 },

  // recent rows
  rec: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, ...shadow.sh1 },
  recThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: 'rgba(226,88,12,0.08)', alignItems: 'center', justifyContent: 'center' },
  recBadge: { position: 'absolute', bottom: -3, right: -3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  recMeta: { flex: 1, gap: 1 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  reviewBtnText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primary },

  // categories
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cat: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 14, ...shadow.sh1 },
  catGlyph: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(14,154,167,0.08)', alignItems: 'center', justifyContent: 'center' },
  catLbl: { flex: 1, fontFamily: font.bodyBold, fontSize: 14, color: C.ink },

  // disclaimer
  disc: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, paddingTop: 14 },
  discText: { flex: 1, fontFamily: font.body, fontSize: 12, color: C.ink2, lineHeight: 17 },
});
