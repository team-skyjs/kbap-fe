/**
 * ReviewTabCard (KB-802) — 리뷰 탭 전용 사진 중심 카드(02_designer_spec 화면 ①, Figma 14324:1366).
 *
 * 작성자 줄 → 음식 칩(한국어 부제) → 사진 peek 스트립(KB-817 ReviewPhotoStrip, 탭 = PhotoViewer) → 평점 3줄 → "도움돼요 (n)" + "리뷰 읽기 ›".
 * 본문·⋯·Helpful 버튼·장소 칩 없음(전부 상세로). 높이 = 사진 없음 236 + 사진(타일 폭×3/4 + gap)(구분선은 높이 밖 절대 위치).
 * 카드·"리뷰 읽기" = onOpen(target). 음식 칩 = onOpenFood. 눌림 = 배경색만(C.hair).
 * 접근성: 카드를 한 요소로 묶지 않는다(음식 칩 버튼에 닿게) — "리뷰 읽기" 줄이 대표 버튼, 사진·평점은 숨김.
 * 다른 표면(홈·음식 상세·내 리뷰)은 FeedCard 그대로 — 이 카드는 리뷰 탭에서만.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { IconChevron } from '@/components';
import { color as C } from '@/lib/theme';
import { ReviewAuthorLine, ReviewFoodChip, ReviewPhotoStrip, ReviewRatingLines } from '@/features/review/ReviewCellParts';
import type { Review } from '@/lib/api/types';

type TFn = (k: string, o?: Record<string, unknown>) => string;

export type ReviewOpenTarget = 'card' | 'read';

const HIDE = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

export function ReviewTabCard({
  review,
  t,
  onOpen,
  onOpenFood,
  ref,
}: {
  review: Review;
  t: TFn;
  onOpen: (target: ReviewOpenTarget) => void;
  onOpenFood: () => void;
  /** 노출 계측(review_card_view) 측정 노드 */
  ref?: React.Ref<View>;
}) {
  const photos = review.photos ?? [];
  const pts = (v: number) => (v > 0 ? t('reviews.ratingPoints', { n: v }) : t('reviews.ratingNone'));
  const name = review.anonymized ? t('reviews.anonymous') : (review.author?.nickname ?? review.authorNationality ?? t('reviews.anonymous'));
  const food = review.foodName ?? t('myReviews.viewDish');
  const a11y = `${t('reviews.cardA11y', { name, food })}, ${t('reviews.cardA11yDetail', {
    photos: photos.length,
    taste: pts(review.rating),
    speed: pts(review.servingSpeed ?? 0),
    service: pts(review.staffKindness ?? 0),
    helpful: review.likes ?? 0,
  })}`;
  return (
    <Pressable
      ref={ref}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed /* 눌림 = 배경색만 */]}
      onPress={() => onOpen('card')}
      accessible={false}
      testID={`review-card-${review.id}`}
    >
      <ReviewAuthorLine review={review} t={t} />
      <ReviewFoodChip review={review} t={t} onOpen={onOpenFood} />
      {photos.length > 0 && (
        <View {...HIDE} testID={`review-card-photo-${review.id}`}>
          {/* 사진 영역 = 리뷰 탭 기존 peek 스트립 그대로(탭 = 뷰어) — 본문은 상세에서 */}
          <ReviewPhotoStrip photos={photos} size={104} radius={4} variant="peek" />
        </View>
      )}
      <View {...HIDE}>
        <ReviewRatingLines review={review} t={t} />
      </View>
      <Pressable
        style={styles.footer}
        onPress={() => onOpen('read')}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        testID={`review-card-read-${review.id}`}
      >
        <Text style={styles.helpful} numberOfLines={1}>{t('reviews.helpful', { count: review.likes ?? 0 })}</Text>
        <View style={styles.read}>
          <Text style={styles.readText} numberOfLines={1}>{t('reviews.readReview')}</Text>
          <IconChevron size={12} color={C.ink} />
        </View>
      </Pressable>
      <View style={styles.divider} pointerEvents="none" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 패딩 위 16 / 아래 8, 좌우 20, gap 12 — 하단 줄 앞만 gap 4(footer marginTop −8)
  card: { paddingTop: 16, paddingBottom: 8, paddingHorizontal: 20, gap: 12, backgroundColor: C.surface },
  cardPressed: { backgroundColor: C.hair },
  footer: { height: 44, marginTop: -8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  helpful: { flexShrink: 1, fontSize: 12, fontWeight: '400', color: C.inkInfo },
  read: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  readText: { fontSize: 14, fontWeight: '600', color: C.ink },
  // 하단 1px 구분선 — 레이아웃 높이 밖(절대 위치)
  divider: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: C.line },
});

export default ReviewTabCard;
