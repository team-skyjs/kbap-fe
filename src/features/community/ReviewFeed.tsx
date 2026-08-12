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
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { CardPhoto, Flag, MedalEmblem, Spinner, Stars, IconBubbleEmpty, IconFood, IconMore, IconPlus, IconProfile } from '@/components';
import { QueryErrorBlock, StateBlock, stateIconColor } from '@/components/StateBlock';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { useIsGuest } from '@/lib/auth/useSession';
import { useGlobalReviews } from '@/lib/data/useFoodReviews';
import { useBlockedUsers } from '@/lib/community/hooks';
import { useDeleteReview, useToggleReviewLike, useUpdateReview } from '@/lib/data/useReviewMutations';
import { TagPickerSheet } from '@/app/community/compose';
import { ExpandableBody, ReviewEditSheet, ReviewPhotoStrip } from '@/features/review/ReviewCellParts';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { useMe } from '@/lib/data/useMe';
import type { Review } from '@/lib/api/types';
import type { FoodTagRef } from '@/lib/community/types';

type TFn = ReturnType<typeof useTranslation>['t'];

export function ReviewFeed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isGuest = useIsGuest();
  const feed = useGlobalReviews(!isGuest); // 게스트 = 호출 0(인증 필수 계약)
  const toggleLike = useToggleReviewLike();
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();
  const myId = useMe().data?.id; // P-182: 본인 셀 ⋯ 판별
  const [gateOpen, setGateOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  const [editTarget, setEditTarget] = React.useState<Review | null>(null);

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

  const onPickFood = (f: FoodTagRef) => {
    setPickerOpen(false);
    router.push(`/food/${f.foodId}/review` as Href);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="review-feed">
      {/* 헤더 — 기존 커뮤니티 탭 문법. P-181: 장식 벨 제거(무동작) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('community.title')}</Text>
      </View>

      <FlatList
        data={isGuest ? [] : reviews}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: 96, flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        renderItem={({ item }) => (
          <FeedCard
            review={item}
            t={t}
            mine={item.memberId != null && item.memberId === myId}
            onOpenFood={() => item.foodId && router.push(`/food/${item.foodId}` as Href)}
            onHelpful={() => (isGuest ? setGateOpen(true) : toggleLike.mutate({ reviewId: item.id, foodId: item.foodId }))}
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
          isGuest ? (
            /* 게스트 — 전역 피드는 인증 필수(계약): 기존 게이트 카피 재사용 */
            <View style={styles.emptyFill}>
              <Pressable style={styles.guestGate} onPress={() => setGateOpen(true)} testID="feed-guest-gate">
                <Text style={styles.guestGateTitle}>{t('community.guestGateTitle')}</Text>
                <Text style={styles.guestGateSub}>{t('community.guestGateSub')}</Text>
              </Pressable>
            </View>
          ) : feed.isLoading ? (
            <View style={styles.center}>
              <Spinner size={22} color={C.ink2} />
            </View>
          ) : feed.isError ? (
            <QueryErrorBlock error={feed.error} onRetry={() => void feed.refetch()} />
          ) : (
            <StateBlock
              fill
              icon={<IconBubbleEmpty size={38} color={stateIconColor.default} />}
              title={t('reviews.emptyTitle')}
              body={t('reviews.emptyBody')}
            />
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={styles.center}>
              <Spinner size={18} color={C.ink3} />
            </View>
          ) : null
        }
      />

      {/* FAB = 리뷰 쓰기 — 음식 픽커(작성 시트 재사용) 경유 */}
      <Pressable
        style={styles.fab}
        testID="feed-write-fab"
        onPress={() => (isGuest ? setGateOpen(true) : setPickerOpen(true))}
      >
        <IconPlus size={24} color="#fff" />
      </Pressable>

      <TagPickerSheet
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
        onSave={({ rating, body }) => {
          if (!editTarget) return;
          updateReview.mutate(
            { reviewId: editTarget.id, foodId: editTarget.foodId, current: editTarget, changes: { rating, body } },
            { onSettled: () => setEditTarget(null) },
          );
        }}
        t={t}
      />
      <AuthGateSheet context="reviews" open={gateOpen} onClose={() => setGateOpen(false)} />
    </View>
  );
}

/** 카드 — P-169 아이템 문법(작성자 줄·별점·본문·사진·Helpful) + 음식 미니 카드(P-178 서버 food 체계). */
function FeedCard({
  review,
  t,
  mine,
  onOpenFood,
  onHelpful,
  onMore,
}: {
  review: Review;
  t: TFn;
  mine: boolean;
  onOpenFood: () => void;
  onHelpful: () => void;
  onMore: () => void;
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
        {!anon && (
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

      {!!review.body && <ExpandableBody body={review.body} t={t} />}
      <ReviewPhotoStrip photos={review.photos ?? []} />
      <Pressable hitSlop={8} onPress={onHelpful} testID={`feed-helpful-${review.id}`}>
        <Text style={[styles.helpful, review.myLike && styles.helpfulOn]}>
          {t('reviews.helpful', { count: review.likes ?? 0 })}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerTitle: { fontFamily: font.display, fontSize: 22, color: C.ink, letterSpacing: -0.3 },
  list: { paddingHorizontal: 18, gap: 12 },
  center: { paddingVertical: 30, alignItems: 'center' },
  emptyFill: { flex: 1, justifyContent: 'center' },

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
  helpful: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  helpfulOn: { color: C.primaryText },

  guestGate: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 18, alignItems: 'center', gap: 5, ...shadow.sh1 },
  guestGateTitle: { fontFamily: font.display, fontSize: 15.5, color: C.ink },
  guestGateSub: { fontFamily: font.body, fontSize: 12.5, color: C.ink3, textAlign: 'center' },

  fab: { position: 'absolute', right: 18, bottom: 18, width: 54, height: 54, borderRadius: 27, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', ...shadow.shPop },
});

export default ReviewFeed;
