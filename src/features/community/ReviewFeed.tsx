/**
 * ReviewFeed (P-179/KB-307 → KB-430 D-2) — 리뷰 탭 = 전역 최신 리뷰 피드.
 * 디자인 4차(4150:17070): AppBar(로고+벨, 홈 공용 StickyHeader) · 컨트롤 행 =
 * 정렬 드롭다운(FeedSort 5종 — 커맨드 센터 판정) · 리뷰 카드(4150:13934) ·
 * 플로팅 "Write a review" 필. 프로필 필터 토글·쿼터 넛지 카드는 서버 파라미터/
 * 클라 상태 부재로 숨김, 구 국가·음식·별점 칩도 시안 컨트롤 행 부재로 숨김 —
 * 전부 REPORTS [P-275] 기재(훅 계약은 무변).
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
import { CardPhoto, Flag, RankMedal, Spinner, Star, StickyHeader, useHeaderHeight, useStickyScroll, IconBubbleEmpty, IconChevron, IconChevronDown, IconCheck, IconEdit, IconFood, IconMore, IconProfile } from '@/components';
import { QueryErrorBlock, ScreenCenterFill, StateBlock, stateIconColor } from '@/components/StateBlock';
import { AuthGateSheet, type GateContext } from '@/components/AuthGateSheet';
import { ActionSheet } from '@/components/ActionSheet';
import { useIsGuest } from '@/lib/auth/useSession';
import { useGlobalReviews, type FeedSort } from '@/lib/data/useFoodReviews';
import { useBlockedUsers } from '@/lib/community/hooks';
import { useDeleteReview, useUpdateReview } from '@/lib/data/useReviewMutations';
import { TagPickerSheet } from '@/app/community/compose';
import { ExpandableBody, HelpfulButton, ReviewEditSheet, ReviewPhotoStrip, ReviewPlaceLine } from '@/features/review/ReviewCellParts';
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

export function ReviewFeed() {
  const router = useRouter();
  const { t } = useTranslation();
  const isGuest = useIsGuest();
  // KB-430: 서버 필터 = sort만 노출(커맨드 센터 판정 — 프로필/국가/음식/별점 칩 숨김, 훅 계약 무변)
  const [sort, setSort] = React.useState<FeedSort>('latest');
  const [sortSheet, setSortSheet] = React.useState(false);
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
            /* KB-430 §2-2: 컨트롤 행 — 우측 정렬 드롭다운(bg #F2F3F6 r8, 14/700) */
            <View style={styles.controlRow}>
              <Pressable style={styles.sortBtn} onPress={() => setSortSheet(true)} testID="feed-sort">
                <Text style={styles.sortLabel} numberOfLines={1}>{t(`reviews.sort_${sort}`)}</Text>
                <IconChevronDown size={16} color="#4B4F58" />
              </Pressable>
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

/** 평점 축 1개 — 라벨 13/500 + 별 16 + 수치 13/600 (KB-430 4150:13934). */
function RatingAxis({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.axis}>
      <Text style={styles.axisLabel}>{label}</Text>
      <Star size={16} fillPct={100} />
      <Text style={styles.axisValue}>{value}</Text>
    </View>
  );
}

/**
 * 리뷰 카드 (4150:13934, KB-430 재작성) — pad 22/20 + 하단 line 1px(카드 보더·그림자
 * 소멸 — 리스트 구분선형). 상단 작성자 행 + Helpful · 평점 3축(Taste=총점 ·
 * Speed/Service = P-236 2축, 0=미평가 비표시) · 본문 · 사진 104 · 음식/장소 칩.
 */
export function FeedCard({
  review,
  t,
  mine,
  onOpenFood,
  onGuestHelpful,
  onMore,
  showMore = true,
}: {
  review: Review;
  t: TFn;
  mine: boolean;
  onOpenFood: () => void;
  onGuestHelpful: () => void;
  onMore: () => void;
  /** P-216: 모더레이션 없는 표면(홈 프리뷰)은 ⋯ 숨김(동작 없는 버튼 금지) */
  showMore?: boolean;
}) {
  const anon = review.anonymized;
  const name = anon ? t('reviews.anonymous') : (review.author?.nickname ?? review.authorNationality ?? t('reviews.anonymous'));
  return (
    <View style={styles.card} testID={`feed-${review.id}`}>
      <View style={styles.cardTop}>
        <View style={styles.who}>
          {anon || !review.authorNationality ? (
            <View style={styles.anonAvatar}>
              <IconProfile size={14} color={C.ink3} />
            </View>
          ) : (
            <Flag code={review.authorNationality} size={24} />
          )}
          <Text style={styles.whoName} numberOfLines={1}>{name}</Text>
          {!anon && !!review.authorRankTier && <RankMedal level={review.author?.level ?? 1} size={16} />}
        </View>
        {/* P-196: Helpful = 공용 단일 경유(HelpfulButton) — 표면별 배선 금지 */}
        <HelpfulButton review={review} mine={mine} t={t} onGuest={onGuestHelpful} />
        {!anon && showMore && (
          <Pressable hitSlop={10} onPress={onMore} testID={`feed-more-${review.id}`}>
            <IconMore size={15} color={C.ink3} />
          </Pressable>
        )}
      </View>

      {/* 평점 행 — Taste(총점) 항상 · Speed/Service는 값 있을 때만(0 = 미평가, P-236) */}
      <View style={styles.axisRow}>
        <RatingAxis label={t('review.extrasTaste')} value={review.rating} />
        {!!review.servingSpeed && <RatingAxis label={t('review.extrasSpeed')} value={review.servingSpeed} />}
        {!!review.staffKindness && <RatingAxis label={t('review.extrasService')} value={review.staffKindness} />}
      </View>

      {!!review.body && <ExpandableBody body={review.body} t={t} style={styles.body} />}
      <ReviewPhotoStrip photos={review.photos ?? []} size={104} radius={4} />

      {/* 음식 칩 행 — 탭 = 음식 상세 (구 미니 카드 대체) */}
      <Pressable style={styles.foodChip} onPress={onOpenFood} testID={`feed-food-${review.id}`}>
        {review.foodImageUrl ? (
          <View style={styles.foodChipThumb}>
            <CardPhoto uri={review.foodImageUrl} borderRadius={4} />
          </View>
        ) : (
          <IconFood size={16} color={C.ink2} />
        )}
        <Text style={styles.foodChipName} numberOfLines={1}>
          {review.foodName ?? t('myReviews.viewDish')}
        </Text>
        <IconChevron size={12} color={C.ink3} />
      </Pressable>
      {/* P-201: 장소 칩 — 탭 = 지도 시트 */}
      <ReviewPlaceLine place={review.place ?? null} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  list: { gap: 0 },
  // KB-430 §2-2: 컨트롤 행
  controlRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2F3F6', borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 8 },
  sortLabel: { fontSize: 14, fontWeight: '700', color: '#4B4F58' },
  center: { paddingVertical: 30, alignItems: 'center' },

  // 카드(4150:13934) — 구분선형(보더·그림자 소멸)
  card: { paddingVertical: 22, paddingHorizontal: 20, gap: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  whoName: { flexShrink: 1, fontSize: 15, fontWeight: '500', color: C.ink },
  anonAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },

  axisRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  axis: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  axisLabel: { fontSize: 13, fontWeight: '500', color: C.ink2 },
  axisValue: { fontSize: 13, fontWeight: '600', color: INK_TITLE },

  body: { fontSize: 14, fontWeight: '400', color: INK_TITLE, lineHeight: 20 },

  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  foodChipThumb: { width: 16, height: 16, borderRadius: 4, overflow: 'hidden', backgroundColor: C.surface2 },
  foodChipName: { flexShrink: 1, fontSize: 12, fontWeight: '500', color: C.ink2 },

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
