/**
 * Home tab — KB-430(P-275) 디자인 4차 D-2 (Figma 4150:16377).
 * AppBar(로고+벨) · 검색 행(+스캔 버튼) · 언더라인 탭(Popular/Saved/Food) ·
 * 위험도 칩 필터 · 음식 카드 2열 그리드(+More) · RECENTLY SCANNED 리스트 ·
 * REVIEWS 카드 3장(+More) · 면책. 데이터 훅·라우트 무변(발주 전제) — 표시만 교체.
 * 구 표면(인사말·식단 배너·스캔 CTA·Safe for you·카테고리)은 시안 부재로 제거.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
  RiskBadge,
  CardPhoto,
  IconSearch,
  IconLock,
  IconFood,
  IconPlus,
  IconTabScan,
} from '@/components';
import { QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { useHome } from '@/lib/data/useHome';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { useInfiniteFoods } from '@/lib/data/useFoods';
import { useGlobalReviews } from '@/lib/data/useFoodReviews';
import { useBookmarks, useToggleBookmark } from '@/lib/data/bookmarks';
import { popularPhotoFoods } from '@/lib/search/discovery';
import { FeedCard } from '@/features/review/FeedCard';
import { useUnreadCount } from '@/lib/notifications/inbox';
import type { FoodCard } from '@/lib/api/types';

const INK_TITLE = '#2F3137'; // 시안 gray-900 (D-1 Chip과 동일 명시값)

type GridTab = 'popular' | 'saved' | 'food';
/** 위험 칩 4종 — All + personalRisk 3상태(라벨은 현 위험 키: Avoid=danger·Warning=caution). */
type RiskChip = 'all' | 'safe' | 'danger' | 'caution';
const RISK_CHIPS: RiskChip[] = ['all', 'safe', 'danger', 'caution'];
type ReviewChip = 'all' | 'popular';

const GRID_N = 4; // 발주: 첫 화면 2행(4장) 후 More
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

  // 훅은 무조건 호출(순서 고정) — 렌더만 분기 (P-216 원칙 유지)
  const browse = useInfiniteFoods();
  const saved = useBookmarks();
  const unread = useUnreadCount();
  const toggleBookmark = useToggleBookmark();

  const [gridTab, setGridTab] = useState<GridTab>('popular');
  const [riskChip, setRiskChip] = useState<RiskChip>('all');
  const [reviewChip, setReviewChip] = useState<ReviewChip>('all');
  const [gate, setGate] = useState(false);

  // 리뷰 3장 — 칩 판정(spec-12): All=latest · Popular=sort helpful. 게스트 열람 개방(P-235).
  const feed = useGlobalReviews(true, { sort: reviewChip === 'popular' ? 'helpful' : 'latest' });
  const feedReviews = (feed.data?.pages ?? []).flatMap((p) => p.items).slice(0, REVIEW_N);

  // Codex #28: 북마크는 커서 페이지네이션 — 1페이지만으론 2페이지 이후 저장분이
  // 그리드에서 미저장으로 보여 토글이 역전된다. 홈은 저장 판정 소스라 전 페이지
  // 드레인(페이지당 1회, hasNextPage 소진까지). wire.bookmarked 플래그(①)는 낙관
  // 토글이 foods 캐시를 안 갱신해 탭 직후 stale — 집합 방식 유지가 정본.
  useEffect(() => {
    if (saved.hasNextPage && !saved.isFetchingNextPage) void saved.fetchNextPage();
  }, [saved, saved.hasNextPage, saved.isFetchingNextPage]);
  const savedFoods = saved.data ?? [];
  const savedIds = new Set(savedFoods.map((f) => f.foodId));
  const gridSource: FoodCard[] =
    gridTab === 'popular' ? popularPhotoFoods(browse.data) : gridTab === 'saved' ? savedFoods : (browse.data ?? []);
  // 칩 = 클라이언트 위험도 필터(personalRisk 결과 기준 — 발주 §1-4)
  const gridFoods = (
    riskChip === 'all' ? gridSource : gridSource.filter((f) => personalRisk(f.risk, hasR) === riskChip)
  ).slice(0, GRID_N);
  const gridMoreHref: Href = gridTab === 'saved' ? ('/profile/saved' as Href) : ('/food' as Href);

  const onBookmark = (f: FoodCard) => {
    if (isGuest) return setGate(true);
    toggleBookmark.mutate({
      snap: { foodId: f.foodId, name: f.name, nameKo: f.nameKo, risk: f.risk, photoUrl: f.photoUrl },
      add: !savedIds.has(f.foodId),
    });
  };

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

            {/* 검색 행 + 스캔 버튼 (4150:16377 @y100) */}
            <View style={styles.searchRow}>
              <Pressable style={styles.searchBox} onPress={() => router.push('/search' as Href)} testID="home-search">
                <Text style={styles.searchPh} numberOfLines={1}>
                  {t('food.searchPlaceholder')}
                </Text>
                <IconSearch size={20} color={C.ink3} />
              </Pressable>
              <Pressable style={styles.scanBtn} onPress={() => router.navigate('/scan')} testID="home-scan">
                <IconTabScan size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* 언더라인 탭 (4123:3884): Popular | Saved | Food */}
            <View style={styles.tabsRow}>
              {(
                [
                  ['popular', t('home.popularTitle')],
                  ['saved', t('saved.title')],
                  ['food', t('food.title')],
                ] as [GridTab, string][]
              ).map(([key, label]) => (
                <Pressable key={key} style={styles.tab} onPress={() => setGridTab(key)} testID={`home-tab-${key}`}>
                  <Text style={[styles.tabLabel, gridTab === key && styles.tabLabelOn]} numberOfLines={1}>
                    {label}
                  </Text>
                  {/* 활성 바 — 프레임 불변(P-151): 비활성도 같은 높이의 투명 바 */}
                  <View style={[styles.tabBar, gridTab === key && styles.tabBarOn]} />
                </Pressable>
              ))}
            </View>
            <View style={styles.tabsDivider} />

            {/* 위험도 칩 필터 (§1-4) — 게스트는 개인화 위험이 없어 미노출(guest-access-policy §1) */}
            {!isGuest && (
              <View style={styles.chipRow}>
                {RISK_CHIPS.map((c) => (
                  <Chip
                    key={c}
                    label={c === 'all' ? t('home.filterAll') : t(`risk.${c}`)}
                    selected={riskChip === c}
                    onPress={() => setRiskChip(c)}
                    testID={`home-chip-${c}`}
                  />
                ))}
              </View>
            )}

            {/* 음식 카드 2열 그리드 (4150:13806) */}
            <View style={styles.grid}>
              {gridFoods.map((f) => (
                <FoodGridCard
                  key={f.foodId}
                  food={f}
                  risk={personalRisk(f.risk, hasR)}
                  guest={isGuest}
                  saved={savedIds.has(f.foodId)}
                  riskLabel={t(`risk.${personalRisk(f.risk, hasR)}`)}
                  onPress={() => openFood(f.foodId)}
                  onBookmark={() => onBookmark(f)}
                />
              ))}
              {gridFoods.length === 0 && gridTab === 'saved' && (
                <Text style={styles.gridEmpty}>{t('saved.emptyBody')}</Text>
              )}
            </View>
            {gridSource.length > GRID_N && (
              <View style={styles.moreWrap}>
                <Btn variant="ghost" onPress={() => router.push(gridMoreHref)} testID="home-grid-more">
                  {t('home.seeAll')}
                </Btn>
              </View>
            )}

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
                  {(['all', 'popular'] as ReviewChip[]).map((c) => (
                    <Chip
                      key={c}
                      label={c === 'all' ? t('home.filterAll') : t('reviews.sort_helpful')}
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
      <AuthGateSheet context="save" open={gate} onClose={() => setGate(false)} />
    </View>
  );
}

/* ---------- pieces ---------- */

/** 2열 그리드 카드 (4150:13806) — 히어로 이미지 + RiskBadge + 북마크 버튼. */
export function FoodGridCard({
  food,
  risk,
  guest,
  saved,
  riskLabel,
  onPress,
  onBookmark,
}: {
  food: FoodCard;
  risk: RiskState;
  guest: boolean;
  saved: boolean;
  riskLabel: string;
  onPress: () => void;
  onBookmark: () => void;
}) {
  return (
    <Pressable style={styles.gcard} onPress={onPress} testID={`home-food-${food.foodId}`}>
      <View style={styles.gphoto}>
        {!!food.photoUrl && <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} />}
        {/* 게스트에겐 개인화 뱃지 미렌더 (guest-access-policy §1) */}
        {!guest && (
          <View style={styles.gbadge}>
            <RiskBadge state={risk} />
          </View>
        )}
      </View>
      <View style={styles.gmeta}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.gname} numberOfLines={2}>
            {food.name}
          </Text>
          {food.nameKo !== food.name && (
            <Text style={styles.gko} numberOfLines={1}>
              {food.nameKo}
            </Text>
          )}
          {!guest && <Text style={[styles.gstatus, { color: riskText[risk] }]}>{riskLabel}</Text>}
        </View>
        <Pressable style={styles.gbm} onPress={onBookmark} hitSlop={6} testID={`home-bm-${food.foodId}`}>
          <IconPlus size={24} color={saved ? C.primary : C.ink2} />
        </Pressable>
      </View>
    </Pressable>
  );
}

/** recent-list 행 (4129:10705) — 썸네일 100 + RiskBadge + Review 소형 버튼.
 *  장소 칩·스캔 날짜는 홈 데이터(FoodCard)에 필드 부재 — 미표시(REPORTS 기재). */
export function RecentRow({
  food,
  risk,
  reviewLabel,
  onPress,
  onReview,
}: {
  food: FoodCard;
  risk: RiskState;
  reviewLabel: string;
  onPress: () => void;
  onReview: () => void;
}) {
  return (
    <Pressable style={styles.rrow} onPress={onPress} testID={`home-recent-${food.foodId}`}>
      <View style={styles.rthumb}>
        {food.photoUrl ? (
          <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} borderRadius={4} />
        ) : (
          <View style={styles.rthumbFb}>
            <IconFood size={24} color={C.ink3} />
          </View>
        )}
        <View style={styles.rbadge}>
          <RiskBadge state={risk} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={styles.gname} numberOfLines={2}>
          {food.name}
        </Text>
        {food.nameKo !== food.name && (
          <Text style={styles.gko} numberOfLines={1}>
            {food.nameKo}
          </Text>
        )}
        {FLAGS.reviewsEnabled && (
          <View style={{ marginTop: 2 }}>
            <Btn sm variant="ghost" onPress={onReview} testID={`home-recent-review-${food.foodId}`}>
              {reviewLabel}
            </Btn>
          </View>
        )}
      </View>
    </Pressable>
  );
}

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
  gcard: { width: '47%', flexGrow: 1 },
  gphoto: { aspectRatio: 174 / 203, borderRadius: 4, backgroundColor: C.surface2, overflow: 'visible' },
  gbadge: { position: 'absolute', top: 0, left: 9 },
  gmeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  gname: { fontSize: 15, fontWeight: '600', color: INK_TITLE },
  gko: { fontSize: 14, fontWeight: '500', color: C.ink2 },
  gstatus: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  gbm: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sh1,
  },
  gridEmpty: { fontSize: 14, fontWeight: '400', color: C.ink2, paddingVertical: 24 },
  moreWrap: { paddingHorizontal: 20, paddingTop: 20 },

  // recent-list (§1-7)
  rrow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rthumb: { width: 100, height: 100, borderRadius: 4, backgroundColor: C.surface2 },
  rthumbFb: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rbadge: { position: 'absolute', top: 0, left: 3 },

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
