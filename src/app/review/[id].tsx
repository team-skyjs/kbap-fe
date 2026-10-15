/**
 * 리뷰 상세 (KB-802, 02_designer_spec 화면 ③ · Figma 14324:1889).
 *
 * KB-307(P-182)에서 "단건 GET 부재 — 목록 캐시 재렌더" 를 이유로 지웠던 화면을 되살린다. 이번엔 단건 쿼리(useReview,
 * 계약 C-1)가 정본이다: 리뷰 탭이 시드한 캐시로 첫 프레임을 그리고 마운트 때 백그라운드 갱신, 캐시가 없으면(딥링크·재진입)
 * 스켈레톤 → 단건 로드. REVIEW-001 = "볼 수 없는 리뷰" + 리스트 캐시에서 제거. 그 밖 오류는 데이터가 없을 때만 오류 블록.
 *
 * 골격: 헤더(뒤로 · "리뷰" · ⋯) → 작성자 줄 → 음식 칩 → peek 캐러셀(query photo 장부터, 탭 = PhotoViewer) → 평점 3줄 →
 * 구분선 → 본문 전문(번역 라벨) → 장소 줄 → Helpful. ⋯ = ModerationFlow(내 리뷰 수정·삭제 / 타인 신고·차단 / 탈퇴 신고만).
 * 헤더는 SubHeader(trailing 슬롯) — 스크롤 반응형이 필요 없다(designer 판단 위임 항목).
 */
import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '@/components/Pressable';
import { IconMore, SubHeader } from '@/components';
import { EmptyBlock, QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { SkeletonReviewDetail } from '@/components/Skeleton';
import { PhotoViewer } from '@/components/PhotoViewer';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { showTopToast } from '@/components/topToastStore';
import { color as C } from '@/lib/theme';
import { FLAGS } from '@/lib/flags';
import { useMe } from '@/lib/data/useMe';
import { isReviewNotFound, useReview } from '@/lib/data/useFoodReviews';
import { removeReviewFromFeeds, useDeleteReview } from '@/lib/data/useReviewMutations';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import {
  HelpfulButton,
  ReviewAuthorLine,
  ReviewBody,
  ReviewFoodChip,
  ReviewPlaceLine,
  ReviewRatingLines,
} from '@/features/review/ReviewCellParts';
import { ReviewPhotoCarousel } from '@/features/review/ReviewPhotoCarousel';

export default function ReviewDetailRoute() {
  // KB-148 문법: 리뷰 기능 off 빌드는 딥링크·백스택 방어(훅 없는 바깥에서 분기 — KB-604)
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;
  return <ReviewDetail />;
}

function ReviewDetail() {
  const { id = '', photo } = useLocalSearchParams<{ id: string; photo?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data: review, error, refetch } = useReview(id);
  const myId = useMe().data?.id;
  const deleteReview = useDeleteReview();
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  const [viewerAt, setViewerAt] = React.useState<number | null>(null);
  const [gateOpen, setGateOpen] = React.useState(false);

  // 봉인 플래그 off = 네트워크 0 — 시드가 없으면 볼 수 없는 리뷰로 취급
  const notFound = isReviewNotFound(error) || (!FLAGS.reviewsLiveEnabled && !review);
  React.useEffect(() => {
    if (isReviewNotFound(error)) removeReviewFromFeeds(qc, id); // 뒤로 가도 리스트에 남지 않게
  }, [error, qc, id]);

  const mine = review?.memberId != null && review.memberId === myId;
  const back = () => router.back();
  const startIndex = Math.max(0, Number.parseInt(photo ?? '0', 10) || 0);

  const header = (
    <SubHeader
      title={t('reviewDetail.title')}
      onBack={back}
      trailing={
        review && !notFound ? (
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('reviewDetail.moreA11y')}
            testID="review-detail-more"
            onPress={() =>
              setMod({
                type: 'review',
                id: review.id,
                author: { id: review.author?.memberId ?? review.memberId ?? `rv-${review.id}`, nickname: review.author?.nickname ?? null, nationality: review.authorNationality },
                mine, // P-186: 실값 — 타인 = 신고/차단
                anonymized: review.anonymized === true, // P-339 ②: 탈퇴 = 신고만
              })
            }
          >
            <IconMore size={24} color={C.ink} />
          </Pressable>
        ) : undefined
      }
    />
  );

  if (notFound) {
    return (
      <View style={styles.root}>
        {header}
        <ScreenCenterFill>
          <EmptyBlock label={t('reviewDetail.notFound')} testID="review-detail-not-found" />
        </ScreenCenterFill>
      </View>
    );
  }
  if (!review) {
    return (
      <View style={styles.root}>
        {header}
        {error ? (
          <View style={styles.center}>
            <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={back} />
          </View>
        ) : (
          <SkeletonReviewDetail />
        )}
      </View>
    );
  }

  const photos = review.photos ?? [];
  return (
    <View style={styles.root} testID="review-detail">
      {header}
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 34 }]} showsVerticalScrollIndicator={false}>
        <ReviewAuthorLine review={review} t={t} />
        <ReviewFoodChip review={review} t={t} onOpen={() => review.foodId && router.push(`/food/${review.foodId}?src=review_detail` as Href)} />
        {photos.length > 0 && (
          <ReviewPhotoCarousel
            photos={photos}
            initialIndex={startIndex}
            onPressPhoto={setViewerAt}
            a11yLabel={t('reviewDetail.photoA11y')}
            testID="review-detail-photo"
          />
        )}
        <ReviewRatingLines review={review} t={t} />
        <View style={styles.divider} />
        <ReviewBody review={review} t={t} expanded />
        <ReviewPlaceLine place={review.place ?? null} />
        <View style={styles.helpfulRow}>
          <HelpfulButton review={review} mine={mine} t={t} onGuest={() => setGateOpen(true)} />
        </View>
      </ScrollView>

      {viewerAt != null && <PhotoViewer uris={photos} index={viewerAt} onClose={() => setViewerAt(null)} />}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={() => router.push(`/food/${review.foodId}/review?reviewId=${review.id}` as Href)} /* P-358 편집 진입 */
        onDelete={() =>
          deleteReview.mutate(
            { reviewId: review.id, foodId: review.foodId },
            { onSuccess: back, onError: () => showTopToast(t('review.deleteError'), { error: true }) },
          )
        }
        onBlocked={() => {
          void qc.invalidateQueries({ queryKey: ['reviews', 'global'] }); // 차단 작성자 리뷰가 피드에서 빠지게 재조회
          back();
          showTopToast(t('community.blockedToast'));
        }}
      />
      <AuthGateSheet context="helpful" trigger="community" open={gateOpen} onClose={() => setGateOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  center: { flex: 1, justifyContent: 'center' },
  divider: { height: 1, backgroundColor: C.line },
  helpfulRow: { flexDirection: 'row' },
});
