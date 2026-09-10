/**
 * Home tab — KB-430(P-275) 디자인 4차 D-2 (Figma 4150:16377).
 * AppBar(로고+벨) · 검색 행(+스캔 버튼) · 언더라인 탭(Popular/Saved/Food) ·
 * 위험도 칩 필터 · 음식 카드 2열 그리드(+More) · RECENTLY SCANNED 리스트 ·
 * REVIEWS 무한 스크롤 피드(P-317 v2) · 면책. 데이터 훅·라우트 무변 — 표시만 교체.
 * 구 표면(인사말·식단 배너·스캔 CTA·Safe for you·카테고리)은 시안 부재로 제거.
 */
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
import { queryClient } from '@/lib/queryClient'; // 루트 프로바이더와 동일 인스턴스(_layout)
import { useHome } from '@/lib/data/useHome';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { FLAGS } from '@/lib/flags';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
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

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { onScroll, hidden, atTop } = useStickyScroll();
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

  // P-349 ③(KB-512): 당겨서 새로고침 — 홈 표면 키 접두 3종 무효화(완료까지 스피너)
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['home'] }),
      queryClient.invalidateQueries({ queryKey: ['foods'] }),
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
      queryClient.invalidateQueries({ queryKey: ['reviews', 'global'] }), // #111 P2 ①: 홈 리뷰 피드
    ]).finally(() => setRefreshing(false));
  }, []);
  // P-339 ②(KB-494): 홈 피드도 ⋯ 전 카드 — 신고만(차단 없음), 위치 통일
  const [mod, setMod] = useState<ModTarget | null>(null);

  // P-317: 리뷰 = 무한 스크롤(Reviews 탭과 같은 커서 API·FeedCard). 칩: All=latest·Popular=helpful.
  const feed = useGlobalReviews(true, { sort: reviewChip === 'popular' ? 'helpful' : 'latest' });
  const seen = new Set<string>();
  const feedReviews = (feed.data?.pages ?? [])
    .flatMap((p) => p.items)
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))); // 페이지 경계 중복 0
  const loadMoreReviews = () => {
    // Codex #80 P2(=#58 P2-2 문법): 에러 푸터가 높이를 바꿔 onEndReached 재발화 →
    // 자동 재시도 루프. 실패 상태에선 재시도 = 푸터 버튼만.
    if (feed.isFetchNextPageError) return;
    if (FLAGS.reviewsEnabled && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  };


  if (isError && !isLoading) {
    return (
      <View style={styles.root}>
        <ScreenCenterFill>
          {/* P-007 false-empty 금지 유지 — 에러는 에러로 */}
          <QueryErrorBlock error={error} onRetry={() => void refetch()} />
        </ScreenCenterFill>
        <StickyHeader hidden={hidden} atTop={atTop} mode="brand" bell={FLAGS.notificationCenter} bellCount={unread} onBell={() => router.push('/notifications' as Href)} />
      </View>
    );
  }

  const header = isLoading ? (
    <SkeletonHome />
  ) : (
    <View>
      <UpdateNudgeBanner />

      {/* KB-430 후속 → P-317: 검색·세그먼트·칩 + 가로 레일 = FoodExplorer embedded */}
      <FoodExplorer variant="embedded" guest={isGuest} srcTag="home" />

      {/* RECENTLY SCANNED (§1-6~7) — P-314(KB-481): 회원 0건 = 섹션 통째 숨김
          (구 P-287 빈 블록 폐기 — 로딩은 SkeletonHome이 선행). 게스트 CTA는 유지. */}
      {(isGuest || recent.length > 0) && (
      <>
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
      </>
      )}

      {/* REVIEWS — P-317: 프리뷰 3장+More → 무한 스크롤 피드 헤더(칩 유지) */}
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
        </>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <Animated.FlatList
        data={isLoading || !FLAGS.reviewsEnabled ? [] : feedReviews}
        keyExtractor={(rv) => rv.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink3} progressViewOffset={headerH} />}
        ListHeaderComponent={header}
        renderItem={({ item: rv }) => (
          <FeedCard
            review={rv}
            t={t}
            mine={false}
            /* P-339 ②: ⋯ 전 카드(구 showMore=false 폐기) — 홈은 신고만·차단 없음 */
            onOpenFood={() => rv.foodId && openFood(rv.foodId)}
            onGuestHelpful={() => router.push('/login' as Href)}
            onMore={() =>
              setMod({
                type: 'review',
                id: rv.id,
                author: { id: rv.author?.memberId ?? rv.memberId ?? `rv-${rv.id}`, nickname: rv.author?.nickname ?? null, nationality: rv.authorNationality },
                mine: false,
                anonymized: rv.anonymized === true,
                reportOnly: true,
              })
            }
          />
        )}
        onEndReachedThreshold={0.6}
        onEndReached={loadMoreReviews}
        ListFooterComponent={
          <View>
            {feed.isFetchingNextPage && (
              /* P-317: 다음 페이지 로딩 = 하단 스켈레톤 3장(공백 금지) */
              <View style={styles.feedSkel} testID="home-feed-skel">
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.feedSkelCard} />
                ))}
              </View>
            )}
            {feed.isFetchNextPageError && (
              /* Codex #80 P2: 다음 페이지 실패 = 푸터 소형 에러 + 수동 재시도(자동 재요청 0) */
              <View style={styles.footerErr} testID="home-feed-next-error">
                <Text style={styles.footerErrText}>{t('states.errorTitle')}</Text>
                <Pressable style={styles.footerRetry} onPress={() => void feed.fetchNextPage()} testID="home-feed-next-retry">
                  <Text style={styles.footerRetryText}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            )}
            {/* 면책 (FR-030 유지 — §1-10) */}
            {!isLoading && <Text style={styles.disc}>{t('home.disclaimer')}</Text>}
          </View>
        }
        testID="home-list"
      />

      <StickyHeader
        hidden={hidden}
        atTop={atTop}
        mode="brand"
        bell={FLAGS.notificationCenter}
        bellCount={unread}
        onBell={() => router.push('/notifications' as Href)}
      />

      {/* P-339 ②: 홈 피드 ⋯ = 신고만(reportOnly — 차단·수정 없음, 게스트는 플로우 내 게이트) */}
      <ModerationFlow target={mod} onClose={() => setMod(null)} onEdit={() => {}} onDelete={() => {}} onBlocked={() => {}} />
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

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, paddingVertical: 0 }, // A-HM-08(KB-486)

  // 2열 그리드 (§1-5)
  gridEmpty: { fontSize: 14, fontWeight: '400', color: C.ink2, paddingVertical: 24 },
  moreWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }, // A-HM-06(KB-486)

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

  feedSkel: { gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  feedSkelCard: { height: 150, borderRadius: 8, backgroundColor: '#F2F3F6' },
  // Codex #80 P2: 다음 페이지 실패 푸터 (ReviewFeed footerErr 문법)
  footerErr: { paddingVertical: 20, alignItems: 'center', gap: 10 },
  footerErrText: { fontSize: 13, fontWeight: '500', color: C.inkInfo },
  footerRetry: { borderWidth: 1, borderColor: C.line2, borderRadius: 4, paddingHorizontal: 20, paddingVertical: 8 },
  footerRetryText: { fontSize: 14, fontWeight: '600', color: C.ink },
  // 면책 (§1-10)
  disc: { fontSize: 12, fontWeight: '400', color: C.ink3, lineHeight: 18, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 40 },
});
