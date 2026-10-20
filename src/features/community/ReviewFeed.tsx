/**
 * ReviewFeed (P-179/KB-307 → KB-430 D-2) — 리뷰 탭 = 전역 최신 리뷰 피드.
 * 디자인 4차(4150:17070): AppBar(로고+벨, 홈 공용 StickyHeader) · 컨트롤 행 =
 * 정렬 드롭다운(FeedSort 5종 — 커맨드 센터 판정) · 리뷰 카드(4150:13934) ·
 * 플로팅 "Write a review" 필. P-331(KB-487, 9/8 예진 확정): "Filter by profile"
 * 토글 = **같은 국적 리뷰 필터**(서버 countryCode — KB-448과 동일 의미, 라벨
 * 카피는 유지). 게스트·국적 없음 = 토글 미렌더(KB-448 규칙). 구 국가·음식·별점
 * 칩은 시안 컨트롤 행 부재로 숨김 유지(훅 계약은 무변).
 *
 * 게스트: 열람 개방(P-235) — 쓰기·Helpful 게이트 유지(AuthGateSheet).
 */
import * as React from 'react';
import { RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable } from '@/components/Pressable';
import Animated from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, radius } from '@/lib/theme';
import { Spinner, StickyHeader, useHeaderHeight, useStickyScroll, IconChevronDown, IconCheck, IconEdit } from '@/components';
import { EmptyBlock, QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { AuthGateSheet, type GateContext } from '@/components/AuthGateSheet';
import { ActionSheet } from '@/components/ActionSheet';
import { useIsGuest } from '@/lib/auth/useSession';
import { reviewDetailKey, useGlobalReviews, type FeedSort } from '@/lib/data/useFoodReviews';
import { useBlockedUsers } from '@/lib/community/hooks';
import { TagPickerSheet } from '@/app/community/compose';
import { FeedCard } from '@/features/review/FeedCard';
import { ReviewTabCard, type ReviewOpenTarget } from '@/features/review/ReviewTabCard';
import { ImpressionTracker } from '@/features/home/homeImpressions';
import { TABBAR_CONTENT_H } from '@/components/TabBar';
import { FeedAd } from '@/features/ads/FeedAd';
import { REVIEW_FEED_AD_EVERY, withFeedAds } from '@/lib/ads/feedSlots';
import { IlloSpeechBubble } from '@/components/design4Assets';
import { useMe } from '@/lib/data/useMe';
import { isScanQuotaExhausted } from '@/lib/api/memberAdapter';
import { useUnreadCount } from '@/lib/data/useNotifications';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { reviewTargetHref, reviewTargetType } from '@/lib/review/reviewTarget';
import type { Review } from '@/lib/api/types';
import type { FoodTagRef } from '@/lib/community/types';

type TFn = ReturnType<typeof useTranslation>['t'];

const INK_TITLE = '#2F3137'; // 시안 gray-900(D-1 Chip과 동일 명시값)
const SORT_OPTIONS: FeedSort[] = ['latest', 'rating_high', 'rating_low', 'food_review_count', 'helpful'];

/** KB-777 B3-7: 플로팅 "Write a review"를 아이콘만으로 줄이는 작은 화면(폭 < 360 또는 높이 < 700 dp — QA 720×1280@2x = 360×640). */
export const isCompactFabScreen = (w: number, h: number): boolean => w < 360 || h < 700;
const FAB_COMPACT_SLOP = 4; // 36 + 4×2 = 44

export function ReviewFeed() {
  const router = useRouter();
  const { t } = useTranslation();
  const isGuest = useIsGuest();
  const [sort, setSort] = React.useState<FeedSort>('latest');
  const [sortSheet, setSortSheet] = React.useState(false);
  // P-331(KB-487): on = 뷰어와 같은 국적 리뷰만 — 쿼리 키에 countryCode 포함이라
  // 토글 전환 = 키 분리 재조회(커서 오염 없음, P-323 natQ 문법). 세션 내 state만(저장 없음).
  const [profileFilter, setProfileFilter] = React.useState(false);
  const me = useMe().data;
  const myNat = me?.nationality ?? null;
  // Codex #94 P2: 게스트 전환·국적 소실 시 on 잔존 → emptySameNat 오노출 — 리셋 +
  // 쿼리·빈 상태가 같은 effective 판정을 쓴다.
  const filterActive = profileFilter && !isGuest && !!myNat;
  // KB-603: 같은 조건을 렌더 중 이전값 비교로(React 공식 패턴) — on 잔존이 한 프레임도 보이지 않는다
  const filterKey = `${isGuest}\u0000${myNat ?? ''}\u0000${profileFilter}`;
  const [prevFilterKey, setPrevFilterKey] = React.useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    if ((isGuest || !myNat) && profileFilter) setProfileFilter(false);
  }
  const feed = useGlobalReviews(true, { sort, countryCode: filterActive ? myNat : undefined });
  const unread = useUnreadCount();
  const [gateOpen, setGateOpen] = React.useState<GateContext | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const { onScroll, hidden, atTop } = useStickyScroll();
  const headerH = useHeaderHeight();

  // P-186: 차단 회원 리뷰 클라 숨김 — 서버 필터링 미검증이라 보조(확인되면 제거)
  const { data: blockedUsers } = useBlockedUsers();
  const blockedIds = React.useMemo(() => new Set((blockedUsers ?? []).map((u) => u.id)), [blockedUsers]);
  const reviews = (feed.data?.pages ?? []).flatMap((p) => p.items).filter((r) => {
    const author = r.author?.memberId ?? r.memberId;
    return author == null || !blockedIds.has(author);
  });
  const rows = withFeedAds(reviews, (r) => r.id, REVIEW_FEED_AD_EVERY); // KB-816: 5개마다 · KB-739: 광고 행 key 순번 고정(페이지 추가에도 앞 행 identity 유지)
  const positions = new Map(reviews.map((r, i) => [r.id, i])); // review_card_view position = 광고 행 제외 리뷰 순번

  // KB-802: 카드·"리뷰 읽기" → 리뷰 상세. 이동 전 상세 캐시 시드 = 상세 첫 프레임 완성 렌더(단건 쿼리는 백그라운드 갱신)
  const qc = useQueryClient();
  const openReview = (review: Review, target: ReviewOpenTarget) => {
    qc.setQueryData(reviewDetailKey(review.id), review);
    track(EVENTS.review_card_open, { target, photo_count: review.photos?.length ?? 0, target_type: reviewTargetType(review) });
    router.push(`/review/${review.id}` as Href);
  };

  // KB-802(R-16): 카드 노출 = 홈 KB-784 판정 그대로(50%↑ · 스크롤 정지 · 리뷰 탭 포커스당 같은 리뷰 1회)
  const { height: winH, width: winW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fabCompact = isCompactFabScreen(winW, winH); // KB-777 B3-7
  const [impressions] = React.useState(() => new ImpressionTracker({ top: 0, bottom: winH, left: 0, right: winW }));
  React.useEffect(() => {
    impressions.setViewport({ top: headerH, bottom: winH - (TABBAR_CONTENT_H + insets.bottom), left: 0, right: winW });
  }, [impressions, headerH, winH, winW, insets.bottom]);
  useFocusEffect(
    React.useCallback(() => {
      impressions.focus();
      return () => impressions.blur();
    }, [impressions]),
  );
  const loadMore = () => {
    // Codex #58 P2-2: 에러 푸터가 콘텐츠 높이를 바꿔 onEndReached가 재발화 →
    // 자동 재시도 루프. 실패 상태에선 재시도 = 푸터 버튼만.
    if (feed.isFetchNextPageError) return;
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  };

  // P-194: 당겨서 새로고침 + 탭 포커스 시 stale 재조회(폴링 아님)
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    void feed.refetch().finally(() => setRefreshing(false));
  };
  const staleRef = React.useRef(false);
  // KB-657: 최신값 ref는 렌더 중이 아니라 커밋(layout effect)에서 동기화 — 리더는 전부 이벤트·리스너·passive effect(layout 뒤)
  React.useLayoutEffect(() => {
    staleRef.current = feed.isStale;
  });
  const refetch = feed.refetch;
  useFocusEffect(
    React.useCallback(() => {
      if (staleRef.current) void refetch();
    }, [refetch]),
  );

  const onPickFood = (f: FoodTagRef) => {
    setPickerOpen(false);
    track(EVENTS.review_write_tap, { source: 'feed' }); // P-213: 퍼널 유입 누락분
    router.push(`/food/${f.foodId}/review` as Href);
  };

  return (
    <View style={styles.root} testID="review-feed">
      <Animated.FlatList
        ListHeaderComponent={
          (
            <View>
              {/* KB-430 §2-2 → P-331: 컨트롤 행 — 좌 프로필 토글(같은 국적 필터,
                  게스트·국적 없음 = 미렌더) / 우 정렬 드롭다운 */}
              <View style={styles.controlRow}>
                {!isGuest && myNat ? (
                  <Pressable style={styles.toggleRow} onPress={() => setProfileFilter((v) => !v)} testID="feed-profile-toggle">
                    <View style={[styles.sw, profileFilter && styles.swOn]}>
                      <View style={[styles.knob, profileFilter && styles.knobOn]} />
                    </View>
                    {/* P-365(KB-528): 라벨 = 상세/리뷰 목록과 동일 "{국가} only"(9/5 Q12 판정 통일) */}
                    <Text style={styles.toggleLabel} numberOfLines={1}>{t('reviews.countryOnly', { code: myNat })}</Text>
                  </Pressable>
                ) : (
                  // P-371(KB-534): 게스트·국적 없음 = 토글 대신 라벨만(좌상단 빈자리 방지)
                  <Text style={styles.toggleLabel} numberOfLines={1} testID="feed-all-reviews-label">
                    {t('reviews.allReviews')}
                  </Text>
                )}
                <Pressable style={styles.sortBtn} onPress={() => setSortSheet(true)} testID="feed-sort">
                  <Text style={styles.sortLabel} numberOfLines={1}>{t(`reviews.sort_${sort}`)}</Text>
                  <IconChevronDown size={16} color="#4B4F58" />
                </Pressable>
              </View>
              {/* 9/5 예진 판정(Q1)·KB-435 쿼터 넛지 카드(4150:17089) — P-384(KB-442): 회원·무료 소진·미해금만 */}
              {!isGuest && isScanQuotaExhausted(me?.scanQuota) && (
                <View style={styles.nudge} testID="quota-nudge">
                  <IlloSpeechBubble height={40} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.nudgeTitle}>{t('scan.quotaTitle')}</Text>
                    <Text style={styles.nudgeBody}>{t('scan.quotaBody')}</Text>
                  </View>
                </View>
              )}
            </View>
          )
        }
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={[styles.list, { paddingTop: headerH + 4, paddingBottom: 96, flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => impressions.scrollBegin()}
        onScrollEndDrag={() => impressions.scrollEnd(false)}
        onMomentumScrollBegin={() => impressions.scrollBegin()}
        onMomentumScrollEnd={() => impressions.scrollEnd(true)}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink3} progressViewOffset={headerH} />}
        renderItem={({ item: row }) => row.kind === 'ad' ? (
          <FeedAd testID={`ad-feed-${row.slot}`} /> /* KB-739 ④-④ → KB-816: 글 5개마다 네이티브 광고(③과 같은 컴포넌트) */
        ) : (
          <ReviewCardRow
            key={row.item.id /* 셀 재사용 = 캐러셀 첫 장 리셋 */}
            review={row.item}
            position={positions.get(row.item.id) ?? 0}
            tracker={impressions}
            t={t}
            onOpen={(target) => openReview(row.item, target)}
            onOpenFood={() => { const href = reviewTargetHref(row.item, 'feed'); if (href) router.push(href); }} /* KB-812 2차: 가공식품 리뷰 = 제품 상세 */
          />
        )}
        ListEmptyComponent={
          feed.isLoading ? (
            <View style={styles.center}>
              <Spinner size={22} color={C.ink2} />
            </View>
          ) : null /* P-196 ②: 게이트/에러/빈 = 화면 정중앙 오버레이(아래) */
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={styles.center}>
              <Spinner size={18} color={C.ink3} />
            </View>
          ) : feed.isFetchNextPageError ? (
            /* Codex #58 P2: 다음 페이지 실패 = 푸터 소형 에러 — 기존 페이지가 남아
               전체 블록(빈 목록 전용)이 안 뜨므로 여기서만 재시도 표면화 */
            <View style={styles.footerErr} testID="feed-next-error">
              <Text style={styles.footerErrText}>{t('states.errorTitle')}</Text>
              <Pressable style={styles.footerRetry} onPress={() => void feed.fetchNextPage()} testID="feed-next-retry">
                <Text style={styles.footerRetryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      {/* KB-430 §2-1: AppBar = 홈과 동일 컴포넌트(로고+벨) */}
      <StickyHeader
        hidden={hidden}
        atTop={atTop}
        mode="brand"
        bell={FLAGS.notificationCenter}
        bellCount={unread}
        onBell={() => router.push('/notifications' as Href)}
      />

      {/* P-196 ②: 상태 블록 = 화면 기준 정중앙.
          P-297(9/7 예진 실기): 에러 오버레이는 **목록이 비었을 때만** — 캐시 페이지가
          있는 채 재조회만 실패(오프라인 복귀 등)하면 isError여도 리스트 유지(겹침 결함).
          재시도 경로 = pull-to-refresh 현행. */}
      {!feed.isLoading && feed.isError && reviews.length === 0 ? (
        <ScreenCenterFill>
          <QueryErrorBlock error={feed.error} onRetry={() => void feed.refetch()} />
        </ScreenCenterFill>
      ) : !feed.isLoading && reviews.length === 0 ? (
        <ScreenCenterFill>
          {/* P-359(KB-522): 구 StateBlock → EmptyBlock */}
          <EmptyBlock label={t(filterActive ? 'reviews.emptySameNat' : 'reviews.emptyTitle')} testID="feed-empty" />
        </ScreenCenterFill>
      ) : null}

      {/* KB-430 §2-5: 플로팅 "Write a review" 필(4150:17079) — 진입점 = 음식 픽커(현행) */}
      {/* KB-777 B3-7: 작은 화면(폭 < 360 또는 높이 < 700) = 아이콘만 36 원형 — 필이 본문을 넓게 가렸다. 라벨은 스크린리더 이름으로 유지 */}
      <Pressable
        style={[styles.fab, fabCompact && styles.fabCompact]}
        // Codex #306 P2: 원형 36 → 터치 44(시각 36 유지). 부모 = 화면 전체이고 right 14·bottom 18 여유라 hitSlop이 부모 안이다
        hitSlop={fabCompact ? FAB_COMPACT_SLOP : undefined}
        testID="feed-write-fab"
        accessibilityRole="button"
        accessibilityLabel={t('reviews.writeReview')}
        onPress={() => (isGuest ? setGateOpen('writeReview') : setPickerOpen(true))}
      >
        <IconEdit size={20} color="#fff" />
        {/* KB-818: 큰 글씨에서 iOS가 라벨을 실제보다 좁게 재서 "Write a revi"로 잘렸다 — 한 줄 + 들어가게 축소(탭 라벨과 같은 규칙) */}
        {!fabCompact && <Text style={styles.fabLabel} numberOfLines={1} adjustsFontSizeToFit testID="feed-write-fab-label">{t('reviews.writeReview')}</Text>}
      </Pressable>

      <TagPickerSheet
        context="review" /* P-225 ④: 리뷰 픽커 = 캡션 미렌더 */
        kind={pickerOpen ? 'food' : null}
        foodTags={[]}
        placeTag={null}
        onToggleFood={onPickFood}
        onTogglePlace={() => {}}
        onClose={() => setPickerOpen(false)}
        t={t}
      />
      {/* P-237: 소팅 시트 — 공용 ActionSheet 재사용(5종·현재값 표시) */}
      <ActionSheet
        open={sortSheet}
        testID="feed-sort-sheet"
        title={t('reviews.sortTitle')}
        items={SORT_OPTIONS.map((v) => ({
          key: v,
          label: t(`reviews.sort_${v}`),
          // 현재값 표시 = SVG 체크(기호 텍스트 렌더 금지 — CLAUDE.md·P-040 계열)
          icon: v === sort ? <IconCheck size={15} color={C.primary} /> : undefined,
          onPress: () => setSort(v),
        }))}
        onClose={() => setSortSheet(false)}
      />
      <AuthGateSheet context={gateOpen ?? 'helpful'} trigger="community" open={gateOpen != null} onClose={() => setGateOpen(null)} />
    </View>
  );
}

/** KB-802: 카드 + 노출 측정 노드 등록(원시값 의존 콜백 ref — 렌더마다 재등록·측정 타이머 재시작 없게) */
function ReviewCardRow({
  review,
  position,
  tracker,
  t,
  onOpen,
  onOpenFood,
}: {
  review: Review;
  position: number;
  tracker: ImpressionTracker;
  t: TFn;
  onOpen: (target: ReviewOpenTarget) => void;
  onOpenFood: () => void;
}) {
  const photoCount = review.photos?.length ?? 0;
  const id = review.id;
  const ref = React.useCallback(
    (node: View | null) => tracker.register({ kind: 'review', position, reviewId: id, photoCount }, node),
    [tracker, position, id, photoCount],
  );
  return <ReviewTabCard ref={ref} review={review} t={t} onOpen={onOpen} onOpenFood={onOpenFood} />;
}

// KB-431: FeedCard는 경량 모듈로 분리(@/features/review/FeedCard) — 홈 등 기존
// 소비처 호환을 위한 재수출(이 모듈은 compose 등 무거운 그래프를 끌고 온다).
export { FeedCard };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  list: { gap: 0 },
  // KB-430 §2-2: 컨트롤 행(4150:17070 — 좌 토글 + 우 드롭다운)
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 0, paddingBottom: 8 }, // A-RT-01(KB-486)
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1, minWidth: 0 }, // A-RT-02
  toggleLabel: { flexShrink: 1, fontSize: 14, fontWeight: '500', color: C.ink },
  // Button/Toggle md 44×24 — off 트랙 #D1D3D8 / on primary, 노브 20 흰 + 그림자 2/2 b4 15%
  sw: { width: 44, height: 24, borderRadius: 12, backgroundColor: C.inkDisabled, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 2, height: 2 }, elevation: 2 },
  knobOn: { alignSelf: 'flex-end' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2F3F6', borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 8 },
  sortLabel: { fontSize: 14, fontWeight: '700', color: '#4B4F58' },
  center: { paddingVertical: 30, alignItems: 'center' },
  // Codex #58 P2: 다음 페이지 실패 푸터 — 소형(리스트 흐름 유지), 색 = 정보성 회색
  footerErr: { paddingVertical: 20, alignItems: 'center', gap: 10 },
  footerErrText: { fontSize: 13, fontWeight: '500', color: C.inkInfo },
  footerRetry: { borderWidth: 1, borderColor: C.line2, borderRadius: radius.sm, paddingHorizontal: 20, paddingVertical: 8 },
  footerRetryText: { fontSize: 14, fontWeight: '600', color: C.ink },
  // Q1: 쿼터 넛지 카드(4150:17089) — mx 24, bg #FFFBF4 r16 pad 20/12/20/20
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 24, backgroundColor: '#FFFBF4', borderRadius: 16, paddingTop: 12, paddingBottom: 20, paddingHorizontal: 20 },
  nudgeTitle: { fontSize: 15, fontWeight: '700', color: '#262C31' },
  nudgeBody: { fontSize: 14, fontWeight: '400', color: '#4B4F58' },

  // KB-430 §2-5: 플로팅 필(4150:17079)
  // A-RT-03(KB-486): gap 4 · right 14 · bottom 18
  fab: {
    position: 'absolute',
    right: 14,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1C1E21',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  fabLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  fabCompact: { width: 36, height: 36, borderRadius: 18, paddingVertical: 0, paddingHorizontal: 0, justifyContent: 'center' }, // KB-777 B3-7
});

export default ReviewFeed;
