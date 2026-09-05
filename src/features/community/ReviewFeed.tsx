/**
 * ReviewFeed (P-179/KB-307 → KB-430 D-2) — 리뷰 탭 = 전역 최신 리뷰 피드.
 * 디자인 4차(4150:17070): AppBar(로고+벨, 홈 공용 StickyHeader) · 컨트롤 행 =
 * 정렬 드롭다운(FeedSort 5종 — 커맨드 센터 판정) · 리뷰 카드(4150:13934) ·
 * 플로팅 "Write a review" 필. 9/5 예진 확정("싹 다 시안대로"): "Filter by profile"
 * 토글은 시안대로 렌더(서버 파라미터 부재 = 무동작). 구 국가·음식·별점 칩은
 * 시안 컨트롤 행 부재로 숨김 유지(훅 계약은 무변).
 *
 * 게스트: 열람 개방(P-235) — 쓰기·Helpful 게이트 유지(AuthGateSheet).
 */
import * as React from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, radius } from '@/lib/theme';
import { Spinner, StickyHeader, useHeaderHeight, useStickyScroll, IconBubbleEmpty, IconChevronDown, IconCheck, IconEdit } from '@/components';
import { QueryErrorBlock, ScreenCenterFill, StateBlock, stateIconColor } from '@/components/StateBlock';
import { AuthGateSheet, type GateContext } from '@/components/AuthGateSheet';
import { ActionSheet } from '@/components/ActionSheet';
import { useIsGuest } from '@/lib/auth/useSession';
import { useGlobalReviews, type FeedSort } from '@/lib/data/useFoodReviews';
import { useBlockedUsers } from '@/lib/community/hooks';
import { useDeleteReview, useUpdateReview } from '@/lib/data/useReviewMutations';
import { TagPickerSheet } from '@/app/community/compose';
import { ReviewEditSheet } from '@/features/review/ReviewCellParts';
import { FeedCard } from '@/features/review/FeedCard';
import { IlloSpeechBubble } from '@/components/design4Assets';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { useMe } from '@/lib/data/useMe';
import { useUnreadCount } from '@/lib/notifications/inbox';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import type { Review } from '@/lib/api/types';
import type { FoodTagRef } from '@/lib/community/types';

type TFn = ReturnType<typeof useTranslation>['t'];

const INK_TITLE = '#2F3137'; // 시안 gray-900(D-1 Chip과 동일 명시값)
const SORT_OPTIONS: FeedSort[] = ['latest', 'rating_high', 'rating_low', 'food_review_count', 'helpful'];
// Q1(9/5)·KB-435: GET /api/members/me/profile(MyProfileResponse)에 scanCount·
// freeScanLimit·scanUnlocked·scanRemaining 추가 예정(BE PR #234) — prod 배포 후
// `me.scanUnlocked === false && me.scanRemaining === 0`으로 교체(그 전까지 숨김).
const SHOW_QUOTA_NUDGE = false;

export function ReviewFeed() {
  const router = useRouter();
  const { t } = useTranslation();
  const isGuest = useIsGuest();
  // KB-430 → 9/5 예진 확정: "Filter by profile" 토글도 시안대로 렌더 — 서버 파라미터
  // 부재라 무동작(토글 상태만, 결과 = 현재 유지). 구 국가·음식·별점 칩은 시안 부재 = 숨김 유지.
  const [sort, setSort] = React.useState<FeedSort>('latest');
  const [sortSheet, setSortSheet] = React.useState(false);
  const [profileFilter, setProfileFilter] = React.useState(false); // 무동작(시안 렌더 전용)
  const feed = useGlobalReviews(true, { sort });
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();
  const myId = useMe().data?.id;
  const unread = useUnreadCount();
  const [gateOpen, setGateOpen] = React.useState<GateContext | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  const [editTarget, setEditTarget] = React.useState<Review | null>(null);
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();

  // P-186: 차단 회원 리뷰 클라 숨김 — 서버 필터링 미검증이라 보조(확인되면 제거)
  const { data: blockedUsers } = useBlockedUsers();
  const blockedIds = React.useMemo(() => new Set((blockedUsers ?? []).map((u) => u.id)), [blockedUsers]);
  const reviews = (feed.data?.pages ?? []).flatMap((p) => p.items).filter((r) => {
    const author = r.author?.memberId ?? r.memberId;
    return author == null || !blockedIds.has(author);
  });
  const loadMore = () => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  };

  // P-194: 당겨서 새로고침 + 탭 포커스 시 stale 재조회(폴링 아님)
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    void feed.refetch().finally(() => setRefreshing(false));
  };
  const staleRef = React.useRef(false);
  staleRef.current = feed.isStale;
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
              {/* KB-430 §2-2: 컨트롤 행 — 좌 프로필 토글(4150:17070 — 무동작) / 우 정렬 드롭다운 */}
              <View style={styles.controlRow}>
                <Pressable style={styles.toggleRow} onPress={() => setProfileFilter((v) => !v)} testID="feed-profile-toggle">
                  <View style={[styles.sw, profileFilter && styles.swOn]}>
                    <View style={[styles.knob, profileFilter && styles.knobOn]} />
                  </View>
                  <Text style={styles.toggleLabel} numberOfLines={1}>{t('reviews.filterByProfile')}</Text>
                </Pressable>
                <Pressable style={styles.sortBtn} onPress={() => setSortSheet(true)} testID="feed-sort">
                  <Text style={styles.sortLabel} numberOfLines={1}>{t(`reviews.sort_${sort}`)}</Text>
                  <IconChevronDown size={16} color="#4B4F58" />
                </Pressable>
              </View>
              {/* 9/5 예진 판정(Q1)·KB-435: 쿼터 넛지 카드(4150:17089) — 구현해두고 숨김.
                  배선 지점: 위 SHOW_QUOTA_NUDGE (profile 응답 scanUnlocked/scanRemaining). */}
              {SHOW_QUOTA_NUDGE && (
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
        data={reviews}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingTop: headerH + 4, paddingBottom: 96, flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink3} />}
        renderItem={({ item }) => (
          <FeedCard
            review={item}
            t={t}
            mine={item.memberId != null && item.memberId === myId}
            onOpenFood={() => item.foodId && router.push(`/food/${item.foodId}?src=feed` as Href)}
            onGuestHelpful={() => setGateOpen('helpful')}
            onMore={() =>
              setMod({
                type: 'review',
                id: item.id,
                author: { id: item.author?.memberId ?? item.memberId ?? `rv-${item.id}`, nickname: item.author?.nickname ?? null, nationality: item.authorNationality },
                mine: item.memberId != null && item.memberId === myId, // P-186: 실값 — 타인 = 신고/차단
              })
            }
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
          ) : null
        }
      />

      {/* KB-430 §2-1: AppBar = 홈과 동일 컴포넌트(로고+벨) */}
      <StickyHeader
        hidden={hidden}
        mode="brand"
        bell={FLAGS.notificationCenter}
        bellCount={unread}
        onBell={() => router.push('/notifications' as Href)}
      />

      {/* P-196 ②: 상태 블록 = 화면 기준 정중앙 */}
      {!feed.isLoading && feed.isError ? (
        <ScreenCenterFill>
          <QueryErrorBlock error={feed.error} onRetry={() => void feed.refetch()} />
        </ScreenCenterFill>
      ) : !feed.isLoading && reviews.length === 0 ? (
        <ScreenCenterFill>
          <StateBlock
            fill
            icon={<IconBubbleEmpty size={38} color={stateIconColor.default} />}
            title={t('reviews.emptyTitle')}
            body={t('reviews.emptyBody')}
          />
        </ScreenCenterFill>
      ) : null}

      {/* KB-430 §2-5: 플로팅 "Write a review" 필(4150:17079) — 진입점 = 음식 픽커(현행) */}
      <Pressable
        style={styles.fab}
        testID="feed-write-fab"
        onPress={() => (isGuest ? setGateOpen('writeReview') : setPickerOpen(true))}
      >
        <IconEdit size={20} color="#fff" />
        <Text style={styles.fabLabel}>{t('reviews.writeReview')}</Text>
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
      {/* P-182: 본인 셀 ⋯ → 기존 액션시트(수정/삭제) + 공용 수정 시트 */}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => setEditTarget(reviews.find((r) => r.id === m.id) ?? null)}
        onDelete={(m) => {
          const r = reviews.find((x) => x.id === m.id);
          if (r) deleteReview.mutate({ reviewId: r.id, foodId: r.foodId });
        }}
        onBlocked={() => void feed.refetch()}
      />
      <ReviewEditSheet
        review={editTarget}
        onClose={() => setEditTarget(null)}
        saving={updateReview.isPending}
        onSave={({ rating, body, place, extras }) => {
          if (!editTarget) return;
          updateReview.mutate(
            { reviewId: editTarget.id, foodId: editTarget.foodId, current: editTarget, changes: { rating, body, place, extras } },
            { onSettled: () => setEditTarget(null) },
          );
        }}
        t={t}
      />
      {/* P-237: 소팅 시트 — 공용 ActionSheet 재사용(5종·현재값 표시) */}
      <ActionSheet
        open={sortSheet}
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

// KB-431: FeedCard는 경량 모듈로 분리(@/features/review/FeedCard) — 홈 등 기존
// 소비처 호환을 위한 재수출(이 모듈은 compose 등 무거운 그래프를 끌고 온다).
export { FeedCard };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  list: { gap: 0 },
  // KB-430 §2-2: 컨트롤 행(4150:17070 — 좌 토글 + 우 드롭다운)
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  toggleLabel: { flexShrink: 1, fontSize: 14, fontWeight: '500', color: C.ink },
  // Button/Toggle md 44×24 — off 트랙 #D1D3D8 / on primary, 노브 20 흰 + 그림자 2/2 b4 15%
  sw: { width: 44, height: 24, borderRadius: 12, backgroundColor: C.inkDisabled, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 2, height: 2 }, elevation: 2 },
  knobOn: { alignSelf: 'flex-end' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2F3F6', borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 8 },
  sortLabel: { fontSize: 14, fontWeight: '700', color: '#4B4F58' },
  center: { paddingVertical: 30, alignItems: 'center' },
  // Q1: 쿼터 넛지 카드(4150:17089) — mx 24, bg #FFFBF4 r16 pad 20/12/20/20
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 24, backgroundColor: '#FFFBF4', borderRadius: 16, paddingTop: 12, paddingBottom: 20, paddingHorizontal: 20 },
  nudgeTitle: { fontSize: 15, fontWeight: '700', color: '#262C31' },
  nudgeBody: { fontSize: 14, fontWeight: '400', color: '#4B4F58' },

  // KB-430 §2-5: 플로팅 필(4150:17079)
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C1E21',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  fabLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default ReviewFeed;
