/**
 * ReviewFeed (P-179/KB-307) — 커뮤니티 탭 = 전역 최신 리뷰 피드 (멘토 #18·33).
 * GET /api/reviews (foodId 생략) 무한스크롤. 카드 = P-169 리뷰 아이템 문법 재사용
 * (작성자 국기·닉네임·뱃지 + 별점 + 음식 미니 카드(서버 food) + 본문 접기 + 사진 +
 * Helpful(n)) — 새 시각 문법 발명 0. 카드 탭 = 리뷰 디테일, 음식 카드 탭 = 음식 상세.
 * FAB = 리뷰 쓰기(음식 픽커 = 커뮤니티 작성 TagPickerSheet 재사용 → 작성 화면).
 *
 * 게스트: 계약이 bearerAuth 필수(전역 피드 인증) — 열람 불가 확인, 기존 게이트
 * 문법(guestGate 카피+AuthGateSheet)으로 가입 유도. production 채널은 탭 자체가
 * FLAGS.communityEnabled(!PROD_CHANNEL)로 숨김 — 이 화면 도달 불가(채널 분기).
 */
import * as React from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, radius, shadow } from '@/lib/theme';
import { CardPhoto, Flag, MedalEmblem, Spinner, Stars, StickyHeader, useHeaderHeight, useStickyScroll, IconBubbleEmpty, IconClose, IconFood, IconMore, IconPlus, IconProfile } from '@/components';
import { QueryErrorBlock, ScreenCenterFill, StateBlock, stateIconColor } from '@/components/StateBlock';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { useIsGuest } from '@/lib/auth/useSession';
import { useGlobalReviews } from '@/lib/data/useFoodReviews';
import { useBlockedUsers } from '@/lib/community/hooks';
import { useDeleteReview, useUpdateReview } from '@/lib/data/useReviewMutations';
import { TagPickerSheet } from '@/app/community/compose';
import { ExpandableBody, HelpfulButton, ReviewEditSheet, ReviewPhotoStrip, ReviewExtrasLine, ReviewPlaceLine } from '@/features/review/ReviewCellParts';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { useMe } from '@/lib/data/useMe';
import { EVENTS, track } from '@/lib/analytics';
import type { Review } from '@/lib/api/types';
import type { FoodTagRef } from '@/lib/community/types';

type TFn = ReturnType<typeof useTranslation>['t'];

export function ReviewFeed() {
  const router = useRouter();
  const { t } = useTranslation();
  const isGuest = useIsGuest();
  // P-229: 피드 필터 — 국가(같은 국적 토글 = 음식별 목록 문법 재사용)·음식(픽커 재사용).
  // 서버 파라미터 2종뿐(스웨거 실측) — 소팅·별점은 BE 대기(be-agenda).
  const [sameNatOnly, setSameNatOnly] = React.useState(false);
  const [foodFilter, setFoodFilter] = React.useState<FoodTagRef | null>(null);
  const [filterPickerOpen, setFilterPickerOpen] = React.useState(false);
  const nationality = useMe().data?.nationality ?? null;
  const feed = useGlobalReviews(!isGuest, {
    countryCode: sameNatOnly ? nationality : null,
    foodId: foodFilter?.foodId ?? null,
  }); // 게스트 = 호출 0(인증 필수 계약)
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();
  const myId = useMe().data?.id; // P-182: 본인 셀 ⋯ 판별(위 nationality와 같은 캐시 — 중복 호출 아님)
  const [gateOpen, setGateOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  const [editTarget, setEditTarget] = React.useState<Review | null>(null);
  // P-211 ④: 헤더 = 타 탭 공용 StickyHeader(스크롤 반응) — 자체 헤더 소멸
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

  // P-194: 당겨서 새로고침(1페이지부터 재조회) + 탭 포커스 시 stale 재조회(KB-68 문법 —
  // 탭 화면은 언마운트되지 않아 재진입만으론 재조회 없음. fresh면 no-op, 폴링 아님).
  // 게스트 가드 — refetch는 enabled를 우회하므로(인증 필수 계약, 호출 0 유지) 별도 차단.
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    void feed.refetch().finally(() => setRefreshing(false));
  };
  const staleRef = React.useRef(false);
  staleRef.current = !isGuest && feed.isStale;
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
          isGuest ? null : (
            <View style={styles.filterRow}>
              {/* 국가 — 음식별 리뷰 목록의 같은 국적 토글 문법 재사용 */}
              {!!nationality && (
                <Pressable
                  style={[styles.filterChip, sameNatOnly && styles.filterChipOn]}
                  onPress={() => setSameNatOnly((v) => !v)}
                  testID="feed-filter-country"
                >
                  <Flag code={nationality} size={14} />
                  <Text style={[styles.filterChipText, sameNatOnly && styles.filterChipTextOn]} numberOfLines={1}>
                    {t('reviews.sameNationality')}
                  </Text>
                </Pressable>
              )}
              {/* 음식 — 픽커 재사용, 선택 시 이름 칩 + 해제 */}
              {foodFilter ? (
                <Pressable style={[styles.filterChip, styles.filterChipOn]} onPress={() => setFoodFilter(null)} testID="feed-filter-food-clear">
                  <Text style={[styles.filterChipText, styles.filterChipTextOn]} numberOfLines={1}>{foodFilter.name}</Text>
                  <IconClose size={12} color={C.primaryText} />
                </Pressable>
              ) : (
                <Pressable style={styles.filterChip} onPress={() => setFilterPickerOpen(true)} testID="feed-filter-food">
                  <IconFood size={13} color={C.ink2} />
                  <Text style={styles.filterChipText} numberOfLines={1}>{t('reviews.filterByFood')}</Text>
                </Pressable>
              )}
            </View>
          )
        }
        data={isGuest ? [] : reviews}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingTop: headerH + 4, paddingBottom: 96, flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        refreshControl={isGuest ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink3} />}
        renderItem={({ item }) => (
          <FeedCard
            review={item}
            t={t}
            mine={item.memberId != null && item.memberId === myId}
            onOpenFood={() => item.foodId && router.push(`/food/${item.foodId}?src=feed` as Href)}
            onGuestHelpful={() => setGateOpen(true)}
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
          !isGuest && feed.isLoading ? (
            <View style={styles.center}>
              <Spinner size={22} color={C.ink2} />
            </View>
          ) : null /* P-196 ②: 게이트/에러/빈 = 화면 정중앙 오버레이(아래) — 리스트 영역 센터 폐기 */
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={styles.center}>
              <Spinner size={18} color={C.ink3} />
            </View>
          ) : null
        }
      />

      {/* P-211 ④: 타이틀 유지 — 브랜드 모드 + 센터 타이틀(공용 title 슬롯) */}
      <StickyHeader hidden={hidden} mode="brand" title={t('tabs.community')} /> {/* P-225: 헤더 = 탭 라벨 키 재사용(Reviews) — 단일 소스 */}

      {/* P-196 ②: 상태 블록 = 화면 기준 정중앙(4탭 공용 기준 — ScreenCenterFill) */}
      {isGuest ? (
        /* 게스트 — 전역 피드는 인증 필수(계약): 기존 게이트 카피 재사용 */
        <ScreenCenterFill>
          <Pressable style={styles.guestGate} onPress={() => setGateOpen(true)} testID="feed-guest-gate">
            <Text style={styles.guestGateTitle}>{t('community.guestGateTitle')}</Text>
            <Text style={styles.guestGateSub}>{t('community.guestGateSub')}</Text>
          </Pressable>
        </ScreenCenterFill>
      ) : !feed.isLoading && feed.isError ? (
        <ScreenCenterFill>
          <QueryErrorBlock error={feed.error} onRetry={() => void feed.refetch()} />
        </ScreenCenterFill>
      ) : !feed.isLoading && reviews.length === 0 ? (
        <ScreenCenterFill>
          <StateBlock
            fill
            icon={<IconBubbleEmpty size={38} color={stateIconColor.default} />}
            title={t('reviews.emptyTitle')}
            body={t(sameNatOnly || foodFilter ? 'reviews.emptyFiltered' : 'reviews.emptyBody')}
            primary={
              sameNatOnly || foodFilter
                ? { label: t('reviews.clearFilters'), onPress: () => { setSameNatOnly(false); setFoodFilter(null); } }
                : undefined
            }
          />
        </ScreenCenterFill>
      ) : null}

      {/* FAB = 리뷰 쓰기 — 음식 픽커(작성 시트 재사용) 경유 */}
      <Pressable
        style={styles.fab}
        testID="feed-write-fab"
        onPress={() => (isGuest ? setGateOpen(true) : setPickerOpen(true))}
      >
        <IconPlus size={24} color="#fff" />
      </Pressable>

      {/* P-229: 음식 필터 픽커 — 작성 픽커와 동일 컴포넌트 재사용(선택 = 필터) */}
      <TagPickerSheet
        context="review"
        kind={filterPickerOpen ? 'food' : null}
        foodTags={foodFilter ? [foodFilter] : []}
        placeTag={null}
        onToggleFood={(f) => { setFoodFilter(f); setFilterPickerOpen(false); }}
        onTogglePlace={() => {}}
        onClose={() => setFilterPickerOpen(false)}
        t={t}
      />
      <TagPickerSheet
        context="review" /* P-225 ④: 리뷰 픽커 = 캡션 미렌더(3태그 정책은 글 작성 전용) */
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
        onSave={({ rating, body, place }) => {
          if (!editTarget) return;
          updateReview.mutate(
            { reviewId: editTarget.id, foodId: editTarget.foodId, current: editTarget, changes: { rating, body, place } },
            { onSettled: () => setEditTarget(null) },
          );
        }}
        t={t}
      />
      {/* P-213: 커뮤니티 표면 게이트 = trigger community(카피는 reviews 유지) */}
      <AuthGateSheet context="reviews" trigger="community" open={gateOpen} onClose={() => setGateOpen(false)} />
    </View>
  );
}

/** 카드 — P-169 아이템 문법(작성자 줄·별점·본문·사진·Helpful) + 음식 미니 카드(P-178 서버 food 체계). */
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
  /** P-216: 홈 프리뷰처럼 모더레이션이 없는 표면은 ⋯ 숨김(동작 없는 버튼 금지) */
  showMore?: boolean;
}) {
  const anon = review.anonymized;
  const name = anon ? t('reviews.anonymous') : (review.author?.nickname ?? review.authorNationality ?? t('reviews.anonymous'));
  return (
    /* P-182 ②: 카드 전체 탭 제거 — 요소별 액션만 */
    <View style={styles.card} testID={`feed-${review.id}`}>
      <View style={styles.cardTop}>
        <View style={styles.who}>
          {anon || !review.authorNationality ? (
            <View style={styles.anonAvatar}>
              <IconProfile size={14} color={C.ink3} />
            </View>
          ) : (
            <Flag code={review.authorNationality} size={20} />
          )}
          <Text style={styles.whoName} numberOfLines={1}>{name}</Text>
          {!anon && !!review.authorRankTier && (
            <View style={styles.rankPill}>
              <MedalEmblem level={review.author?.level ?? 1} size={15} />
            </View>
          )}
        </View>
        <Stars value={review.rating} size={14} />
        {/* P-186: ⋯ = 본인+타인(익명 제외) */}
        {!anon && showMore && (
          <Pressable hitSlop={10} onPress={onMore} testID={`feed-more-${review.id}`}>
            <IconMore size={15} color={C.ink3} />
          </Pressable>
        )}
      </View>

      {/* 음식 미니 카드 — 서버 food(P-178 체계), 탭 = 음식 상세 */}
      <Pressable style={styles.foodMini} onPress={onOpenFood} testID={`feed-food-${review.id}`}>
        {review.foodImageUrl ? (
          <View style={styles.foodThumb}>
            <CardPhoto uri={review.foodImageUrl} borderRadius={10} />
          </View>
        ) : (
          <View style={[styles.foodThumb, styles.foodThumbFb]}>
            <IconFood size={16} color={C.ink3} />
          </View>
        )}
        <Text style={styles.foodMiniName} numberOfLines={1}>
          {review.foodName ?? t('myReviews.viewDish')}
        </Text>
      </Pressable>

      {/* P-201: 장소 줄 — 음식 미니카드 아래(발주 권장), 탭 = 지도 시트 */}
      <ReviewPlaceLine place={review.place ?? null} />
      <ReviewExtrasLine review={review} mine={mine} />
      {!!review.body && <ExpandableBody body={review.body} t={t} />}
      <ReviewPhotoStrip photos={review.photos ?? []} />
      {/* P-196: Helpful = 공용 단일 경유(HelpfulButton) — 표면별 배선 금지 */}
      <HelpfulButton review={review} mine={mine} t={t} onGuest={onGuestHelpful} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  list: { paddingHorizontal: 18, gap: 12 },
  // P-229: 필터 행 — 칩 문법(음식별 목록 필터 톤)
  filterRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 200 },
  filterChipOn: { backgroundColor: primaryTint, borderColor: C.primary },
  filterChipText: { flexShrink: 1, fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  filterChipTextOn: { color: C.primaryText },
  center: { paddingVertical: 30, alignItems: 'center' },

  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 14, gap: 10, ...shadow.sh1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  whoName: { flexShrink: 1, fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
  anonAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  rankPill: { flexShrink: 0 },

  foodMini: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.surface2, borderRadius: 12, padding: 8 },
  foodThumb: { width: 34, height: 34, borderRadius: 10, overflow: 'hidden', backgroundColor: C.card },
  foodThumbFb: { alignItems: 'center', justifyContent: 'center' },
  foodMiniName: { flex: 1, fontFamily: font.bodyBold, fontSize: 13, color: C.ink },

  body: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19 },

  guestGate: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 18, alignItems: 'center', gap: 5, ...shadow.sh1 },
  guestGateTitle: { fontFamily: font.display, fontSize: 15.5, color: C.ink },
  guestGateSub: { fontFamily: font.body, fontSize: 12.5, color: C.ink3, textAlign: 'center' },

  fab: { position: 'absolute', right: 18, bottom: 18, width: 54, height: 54, borderRadius: 27, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', ...shadow.shPop },
});

export default ReviewFeed;
