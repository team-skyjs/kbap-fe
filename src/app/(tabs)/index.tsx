/**
 * Home tab — KB-430(P-275) 디자인 4차 D-2 (Figma 4150:16377).
 * AppBar(로고+벨) · 검색 행(+스캔 버튼) · 언더라인 탭(Popular/Saved/Food) ·
 * 위험도 칩 필터 · 음식 카드 2열 그리드(+More) · RECENTLY SCANNED 리스트 ·
 * REVIEWS 카드 3장(+More) · 면책. 데이터 훅·라우트 무변(발주 전제) — 표시만 교체.
 * 구 표면(인사말·식단 배너·스캔 CTA·Safe for you·카테고리)은 시안 부재로 제거.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, riskText, shadow, type RiskState } from '@/lib/theme';
import { UpdateNudgeBanner } from '@/components/VersionGate';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  SkeletonHome,
  Btn,
  Chip,
  SectionHead,
  IconLock,
} from '@/components';
import { QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { RecentRow } from '@/features/food/FoodCards';
import { FoodExplorer } from '@/features/food/FoodExplorer';
import { useHome } from '@/lib/data/useHome';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { useGlobalReviews } from '@/lib/data/useFoodReviews';
import { FeedCard } from '@/features/review/FeedCard';
import { useUnreadCount } from '@/lib/notifications/inbox';
import type { FoodCard } from '@/lib/api/types';

const INK_TITLE = '#2F3137'; // 시안 gray-900 (D-1 Chip과 동일 명시값)

/** 9/5 예진 확정("싹 다 시안대로"): For You·Nearby도 시안대로 렌더 — 서버 파라미터
 *  부재라 선택해도 결과는 현재(latest) 유지(무동작), Popular만 sort=helpful. */
type ReviewChip = 'all' | 'foryou' | 'nearby' | 'popular';
const REVIEW_CHIPS: [ReviewChip, string][] = [
  ['all', 'home.filterAll'],
  ['foryou', 'home.chipForYou'],
  ['nearby', 'home.chipNearby'],
  ['popular', 'reviews.sort_helpful'],
];

const RECENT_N = 4;
const REVIEW_N = 3;

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();

  const { data: home, isLoading, isError, error, refetch } = useHome();
  const { data: me } = useMe();
  const recent = home?.recent ?? [];
  const restrictions = me?.restrictions ?? [];
  const isGuest = home?.authenticated === false; // LIVE에서만 판정됨
  const hasR = restrictions.length > 0;
  const openFood = (foodId: string) => router.push(`/food/${foodId}?src=home` as Href);

  const unread = useUnreadCount();
  const [reviewChip, setReviewChip] = useState<ReviewChip>('all');

  // 리뷰 3장 — 칩 판정(spec-12): All=latest · Popular=sort helpful. 게스트 열람 개방(P-235).
  const feed = useGlobalReviews(true, { sort: reviewChip === 'popular' ? 'helpful' : 'latest' });
  const feedReviews = (feed.data?.pages ?? []).flatMap((p) => p.items).slice(0, REVIEW_N);


  if (isError && !isLoading) {
    return (
      <View style={styles.root}>
        <ScreenCenterFill>
          {/* P-007 false-empty 금지 유지 — 에러는 에러로 */}
          <QueryErrorBlock error={error} onRetry={() => void refetch()} />
        </ScreenCenterFill>
        <StickyHeader hidden={hidden} mode="brand" bell={FLAGS.notificationCenter} bellCount={unread} onBell={() => router.push('/notifications' as Href)} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 110 }}
      >
        {isLoading ? (
          <SkeletonHome />
        ) : (
          <View>
            <UpdateNudgeBanner />

            {/* KB-430 후속(9/5): 검색·탭·칩·그리드 = FoodExplorer 공용(음식 탭과 공유) */}
            <FoodExplorer variant="embedded" guest={isGuest} srcTag="home" />

            {/* RECENTLY SCANNED (§1-6~7) */}
            <SectionHead label={t('home.recentTitle')} title={t('home.recentSub')} testID="home-recent-head" />
            {isGuest ? (
              <Pressable style={styles.guestCta} onPress={() => router.push('/login' as Href)}>
                <View style={styles.guestCtaIc}>
                  <IconLock size={18} color={C.ink2} />
                </View>
                <Text style={styles.guestCtaText}>{t('home.guestScansTitle')}</Text>
                <Text style={styles.guestCtaBtn}>{t('intro.signUp')}</Text>
              </Pressable>
            ) : (
              <>
                {recent.slice(0, RECENT_N).map((f) => (
                  <RecentRow
                    key={f.foodId}
                    food={f}
                    risk={personalRisk(f.risk, hasR)}
                    reviewLabel={t('home.review')}
                    onPress={() => openFood(f.foodId)}
                    onReview={() => {
                      track(EVENTS.review_write_tap, { source: 'home' });
                      router.push(`/food/${f.foodId}/review` as Href);
                    }}
                  />
                ))}
                {recent.length > RECENT_N && (
                  <View style={styles.moreWrap}>
                    <Btn variant="ghost" onPress={() => router.push('/profile/my-foods' as Href)} testID="home-recent-more">
                      {t('home.seeAll')}
                    </Btn>
                  </View>
                )}
              </>
            )}

            {/* REVIEWS (§1-8~9) — 칩 = All·Popular(sort=helpful), For You/Nearby 파라미터 부재로 숨김 */}
            {FLAGS.reviewsEnabled && feedReviews.length > 0 && (
              <>
                <SectionHead label={t('reviews.headerTitle')} title={t('home.reviewsSub')} testID="home-reviews-head" />
                <View style={styles.chipRow}>
                  {REVIEW_CHIPS.map(([c, key]) => (
                    <Chip
                      key={c}
                      label={t(key)}
                      selected={reviewChip === c}
                      onPress={() => setReviewChip(c)}
                      testID={`home-review-chip-${c}`}
                    />
                  ))}
                </View>
                <View>
                  {feedReviews.map((rv) => (
                    <FeedCard
                      key={rv.id}
                      review={rv}
                      t={t}
                      mine={false}
                      showMore={false} /* 홈 프리뷰 = 모더레이션 없음(동작 없는 ⋯ 금지) */
                      onOpenFood={() => rv.foodId && openFood(rv.foodId)}
                      onGuestHelpful={() => router.push('/login' as Href)}
                      onMore={() => router.push('/community')}
                    />
                  ))}
                </View>
                <View style={styles.moreWrap}>
                  <Btn variant="ghost" onPress={() => router.push('/community')} testID="home-reviews-more">
                    {t('home.seeAll')}
                  </Btn>
                </View>
              </>
            )}

            {/* 면책 (FR-030 유지 — §1-10) */}
            <Text style={styles.disc}>{t('home.disclaimer')}</Text>
          </View>
        )}
      </Animated.ScrollView>

      <StickyHeader
        hidden={hidden}
        mode="brand"
        bell={FLAGS.notificationCenter}
        bellCount={unread}
        onBell={() => router.push('/notifications' as Href)}
      />
    </View>
  );
}

/* ---------- pieces ---------- */
// KB-434: 카드 2종 = features/food/FoodCards 분리(경량 그래프) — 재수출로 기존 임포트 호환
export { FoodGridCard, RecentRow } from '@/features/food/FoodCards';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },

  // 검색 행 (§1-2)
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  searchBox: {
    flex: 1,
    height: 48,
    borderRadius: 4,
    backgroundColor: C.surface2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  searchPh: { flex: 1, fontSize: 15, fontWeight: '400', color: C.ink3, marginRight: 8 },
  scanBtn: { width: 48, height: 48, borderRadius: 8, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },

  // 언더라인 탭 (§1-3)
  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 20, gap: 4 },
  tab: { paddingHorizontal: 8, height: 40, justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  tabLabel: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  tabLabelOn: { color: INK_TITLE },
  tabBar: { alignSelf: 'stretch', height: 2, backgroundColor: 'transparent' },
  tabBarOn: { backgroundColor: INK_TITLE },
  tabsDivider: { height: 0.5, backgroundColor: C.line2 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, paddingVertical: 16 },

  // 2열 그리드 (§1-5)
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 16, paddingHorizontal: 20 },
  gridEmpty: { fontSize: 14, fontWeight: '400', color: C.ink2, paddingVertical: 24 },
  moreWrap: { paddingHorizontal: 20, paddingTop: 20 },

  // recent-list (§1-7)

  // 비회원 가입 유도 (KB-69 유지 — 스타일만 토큰)
  guestCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: C.line2,
    borderStyle: 'dashed',
    borderRadius: 4,
    padding: 14,
    marginHorizontal: 20,
  },
  guestCtaIc: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  guestCtaText: { flex: 1, fontSize: 13, fontWeight: '400', color: C.ink2, lineHeight: 18 },
  guestCtaBtn: { fontSize: 13, fontWeight: '700', color: C.primaryText },

  // 면책 (§1-10)
  disc: { fontSize: 12, fontWeight: '400', color: C.ink3, lineHeight: 18, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 40 },
});
