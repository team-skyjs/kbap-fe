/**
 * Profile tab (mockup Screen I1) — identity, ranking ladder, dietary
 * restrictions, my reviews, and account rows (incl. delete account).
 *
 * Data via useMe()/useMyReviews()/useFoods() (MOCK_MODE). Scroll-aware brand
 * header; no emoji; reader text i18n'd; risk colors fixed.
 */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  Btn,
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  Rosette,
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
  IconLogout,
} from '@/components';
import { useMe, useMyReviews } from '@/lib/data/useMe';
import { useFoods } from '@/lib/data/useFoods';
import { personalRisk } from '@/lib/risk';
import { TIERS } from '@/lib/ranking';
import { restrictionLabel } from '@/lib/onboarding/data';
import { LANG_ENDONYM } from '@/lib/i18n/languages';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { useIsGuest } from '@/lib/auth/useSession';
import { LanguagePicker } from '@/components/LanguagePicker';
import type { FoodCard, Review } from '@/lib/api/types';

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const isGuest = useIsGuest();
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();
  const { lang } = useLocale();
  const [langOpen, setLangOpen] = useState(false);

  const { data: me } = useMe();
  const { data: reviews } = useMyReviews();
  const { data: foods } = useFoods();

  const foodMap = new Map((foods ?? []).map((f) => [f.foodId, f]));
  const curLevel = me?.rank.level ?? 1;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 110 }}
      >
        {isGuest ? (
          /* 게스트: 프로필 전체 잠금 — 탭 진입 자체가 가입 유도 (policy §1) */
          <View style={[styles.body, { paddingTop: 40, alignItems: 'center', gap: 14 }]}>
            <View style={styles.guestAvatar}>
              <IconProfile size={34} color={C.ink3} />
            </View>
            <Text style={styles.guestTitle}>{t('gate.profileTitle')}</Text>
            <Text style={styles.guestSub}>{t('gate.profileSub')}</Text>
            {/* width:'100%'는 RN 0.85 flex 버그(중앙정렬 깨짐) — 공용 Btn 사용 */}
            <View style={{ alignSelf: 'stretch', paddingHorizontal: 24 }}>
              <Btn onPress={() => router.push('/login?returnTo=%2F(tabs)%2Fprofile' as Href)}>{t('intro.signUp')}</Btn>
            </View>
          </View>
        ) : me && (
          <View style={styles.body}>
            {/* identity */}
            <View style={styles.id}>
              <View style={styles.avatar}>
                <IconProfile size={30} color={C.primary} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.name}>{me.nickname || '—'}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {!!me.nationality && (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{me.nationality}</Text>
                    </View>
                  )}
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{lang.split('-')[0].toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              <Pressable style={styles.edit} hitSlop={8} onPress={() => router.push('/profile/edit' as Href)}>
                <IconEdit size={18} color={C.ink2} />
              </Pressable>
            </View>

            {/* 미완료 프로필(서버 플래그) — 온보딩 이어하기 유도 행 */}
            {me.onboardingCompleted === false && (
              <Pressable style={styles.finishRow} onPress={() => router.push('/onboarding' as Href)}>
                <Text style={styles.finishText}>{t('onboarding.resumeTitle')}</Text>
                <Text style={styles.finishCta}>{t('onboarding.resumeCta')}</Text>
              </Pressable>
            )}

            {/* ranking → tap opens the ranking-detail screen (7-tier FR-025 data) */}
            <Section title={t('profile.rankingTitle')}>
              <Pressable style={styles.rank} onPress={() => router.push('/profile/ranking' as Href)}>
                <View style={styles.rankTop}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Rosette level={me.rank.level} size={42} />
                    <View>
                      <Text style={styles.rankTier}>{t(`ranking.tier.${me.rank.tier}`)}</Text>
                      <Text style={styles.tag}>{t('profile.levelPts', { level: me.rank.level, score: me.rank.score })}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {me.rank.nextTier && me.rank.pointsToNext != null && (
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>{t('profile.toNext', { points: me.rank.pointsToNext, tier: t(`ranking.tier.${me.rank.nextTier}`) })}</Text>
                      </View>
                    )}
                    <IconChevron size={16} color={C.ink3} />
                  </View>
                </View>
                <View style={styles.rankProg}>
                  {TIERS.map((tier) => (
                    <View key={tier.key} style={[styles.rankSeg, tier.level <= curLevel && styles.rankSegOn]} />
                  ))}
                </View>
                <Text style={styles.tag}>{t('profile.scoreNote')}</Text>
              </Pressable>
            </Section>

            {/* dietary restrictions — flat ingredient chips (no per-item risk color) */}
            <Section
              title={t('profile.restrictionsTitle')}
              action={
                <Pressable style={styles.linkRow} hitSlop={8} onPress={() => router.push('/profile/restrictions' as Href)}>
                  <IconEdit size={14} color={C.primary} />
                  <Text style={styles.link}>{t('profile.edit')}</Text>
                </Pressable>
              }
            >
              <View style={styles.dietWrap}>
                {me.restrictions.map((r) => (
                  <View key={r.code} style={styles.dietChip}>
                    <Text style={styles.dietChipText}>{restrictionLabel(r.code)}</Text>
                  </View>
                ))}
                <Pressable style={styles.dietAdd} hitSlop={6} onPress={() => router.push('/profile/restrictions' as Href)}>
                  <IconPlus size={13} color={C.primary} />
                  <Text style={styles.dietAddText}>{t('profile.add')}</Text>
                </Pressable>
              </View>
            </Section>

            {/* my reviews */}
            <Section
              title={t('profile.myReviewsTitle', { count: reviews?.length ?? 0 })}
              action={
                <Pressable hitSlop={8} onPress={() => router.push('/profile/reviews' as Href)}>
                  <Text style={styles.link}>{t('profile.seeAll')}</Text>
                </Pressable>
              }
            >
              <View style={{ gap: 10 }}>
                {(reviews ?? []).map((rv) => (
                  <MyReview key={rv.id} review={rv} food={foodMap.get(rv.foodId)} hasRestrictions={me.restrictions.length > 0} onPress={() => router.push(`/review/${rv.id}` as Href)} />
                ))}
              </View>
            </Section>

            {/* account */}
            <Section title={t('profile.accountTitle')}>
              <View style={styles.acctList}>
                <AcctRow icon={<IconGlobe size={18} color={C.ink2} />} label={t('profile.language')} value={LANG_ENDONYM[lang] ?? lang} onPress={() => setLangOpen(true)} />
                <AcctRow icon={<IconBell size={18} color={C.ink2} />} label={t('profile.notifications')} />
                <AcctRow icon={<IconGear size={18} color={C.ink2} />} label={t('profile.safetyNotice')} />
                <AcctRow
                  // 멘토링 ②: 좌측 화살표 → 로그아웃 아이콘. 액션 행이라 우측 chevron도 제거
                  // (양쪽 화살표 오해 방지 — 내비게이션 행들만 chevron 유지).
                  icon={<IconLogout size={18} color={C.ink2} />}
                  chevron={false}
                  label={t('profile.logout')}
                  onPress={() => {
                    // KB-67: BE 세션 폐기(POST /auth/logout + 토큰 삭제) 후
                    // Firebase signOut(네이티브 전용 — lazy require).
                    void (async () => {
                      const { logoutBe } = await import('@/lib/auth/beAuth');
                      await logoutBe().catch(() => {});
                      if (Platform.OS !== 'web') {
                        const session = require('@/lib/auth/session') as typeof import('@/lib/auth/session');
                        await session.logOut().catch(() => {});
                      }
                      router.replace('/login' as Href);
                    })();
                  }}
                />
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

      <StickyHeader hidden={hidden} mode="brand" bell />
      <LanguagePicker open={langOpen} onClose={() => setLangOpen(false)} />
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

function MyReview({ review, food, hasRestrictions, onPress }: { review: Review; food?: FoodCard; hasRestrictions: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.myrev} onPress={onPress}>
      <View style={styles.myrevPh}>
        <RiskMark state={food ? personalRisk(food.risk, hasRestrictions) : 'unable'} size={20} />
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

function AcctRow({ icon, label, value, danger, chevron = true, onPress }: { icon: React.ReactNode; label: string; value?: string; danger?: boolean; chevron?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={styles.acctRow} onPress={onPress}>
      <View style={styles.acctIc}>{icon}</View>
      <Text style={[styles.acctLabel, danger && { color: C.riskDanger }]}>{label}</Text>
      {value && <Text style={styles.tag}>{value}</Text>}
      {chevron && <IconChevron size={16} color={danger ? C.riskDanger : C.ink2} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  finishRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fdf3e7', borderWidth: 1, borderColor: '#f3ddc0', borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  finishText: { flex: 1, fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink, lineHeight: 18 },
  finishCta: { fontFamily: font.bodyBold, fontSize: 13, color: C.primary },
  // 게스트 가입 유도 (KB-78)
  guestAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  guestTitle: { fontFamily: font.displayBlack, fontSize: 20, color: C.ink, textAlign: 'center' },
  guestSub: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
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
