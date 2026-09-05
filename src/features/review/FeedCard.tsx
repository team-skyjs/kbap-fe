/**
 * FeedCard (KB-430 4150:13934 → KB-431 분리) — 리뷰 카드 공용(피드·홈 프리뷰·
 * 음식 상세 프리뷰). ReviewFeed에서 분리한 이유: ReviewFeed 모듈은 작성 픽커
 * (community/compose)·전역 피드 훅 등 무거운 그래프를 끌고 와 상세가 카드 하나
 * 때문에 전체를 의존하게 된다(placeMap 분리와 같은 계열, P-201).
 *
 * 구분선형(pad 22/20 + 하단 line — 카드 보더·그림자 소멸) · 작성자 행 + Helpful
 * (공용 단일 경유 — 표면별 배선 금지 P-196) · 평점 3축(Taste=총점 ·
 * Speed/Service=P-236 2축, 0=미평가 비표시) · 본문 · 사진 104 · 음식/장소 칩.
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C } from '@/lib/theme';
import { CardPhoto, RankMedal, Star, IconChevron, IconFood, IconMore, IconProfile } from '@/components';
import { ExpandableBody, HelpfulButton, ReviewPhotoStrip, ReviewPlaceLine } from '@/features/review/ReviewCellParts';
import type { Review } from '@/lib/api/types';

type TFn = (k: string, o?: Record<string, unknown>) => string;

const INK_TITLE = '#2F3137'; // 시안 gray-900(D-1 계열 명시값)

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

export function FeedCard({
  review,
  t,
  mine,
  onOpenFood,
  onGuestHelpful,
  onMore,
  showMore = true,
  showFood = true,
}: {
  review: Review;
  t: TFn;
  mine: boolean;
  onOpenFood: () => void;
  onGuestHelpful: () => void;
  onMore: () => void;
  /** P-216: 모더레이션 없는 표면(홈 프리뷰)은 ⋯ 숨김(동작 없는 버튼 금지) */
  showMore?: boolean;
  /** KB-431: 음식 상세 프리뷰 = 자기 자신 칩 무의미 — 숨김 */
  showFood?: boolean;
}) {
  const anon = review.anonymized;
  const name = anon ? t('reviews.anonymous') : (review.author?.nickname ?? review.authorNationality ?? t('reviews.anonymous'));
  return (
    <View style={styles.card} testID={`feed-${review.id}`}>
      <View style={styles.cardTop}>
        <View style={styles.who}>
          {/* 9/5 예진 판정(Q3): 아바타 = 현 아바타 컴포넌트 24 통일(국기 대체).
              프로필 사진 URL은 리뷰 작성자 계약에 없음 — 실사진은 BE 필드 추가 시. */}
          <View style={styles.avatar}>
            <IconProfile size={14} color={C.ink3} />
          </View>
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
      {showFood && (
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
      )}
      {/* P-201: 장소 칩 — 탭 = 지도 시트 */}
      <ReviewPlaceLine place={review.place ?? null} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 카드(4150:13934) — 구분선형(보더·그림자 소멸)
  card: { paddingVertical: 22, paddingHorizontal: 20, gap: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  whoName: { flexShrink: 1, fontSize: 15, fontWeight: '500', color: C.ink },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },

  axisRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  axis: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  axisLabel: { fontSize: 13, fontWeight: '500', color: C.ink2 },
  axisValue: { fontSize: 13, fontWeight: '600', color: INK_TITLE },

  body: { fontSize: 14, fontWeight: '400', color: INK_TITLE, lineHeight: 20 },

  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  foodChipThumb: { width: 16, height: 16, borderRadius: 4, overflow: 'hidden', backgroundColor: C.surface2 },
  foodChipName: { flexShrink: 1, fontSize: 12, fontWeight: '500', color: C.ink2 },
});

export default FeedCard;
