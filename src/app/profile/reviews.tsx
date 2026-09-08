/**
 * My reviews — KB-434 D-6(4150:14525). AppBar "My Reviews" → 위험 칩(All·Safe·Avoid)
 * → 리뷰 카드 = D-2 FeedCard(Variant3 — 우측 ⋮ 더보기: 수정/삭제 ActionSheet 현 로직,
 * helpful은 본인 = 카운트 표시 전용 P-196 공용 분기).
 *
 * 구 통계 헤더·정렬 필·위험 칩 소멸(P-336 — 칩 위험도 캐시 조인(personalRisk false-safe
 * 가드 — 서버 리뷰 요약에 위험도 없음, 캐시 미스는 All에서만 표시).
 * Data via useMyReviews() — 수정/삭제 뮤테이션·시트 무변.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useRouter, type Href } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { SubHeader, IconFood } from '@/components';
import { useMyReviews } from '@/lib/data/useMe';
import { useFoods } from '@/lib/data/useFoods';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { EmptyBlock, QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { SkeletonMyReviews } from '@/components/Skeleton';
import { FeedCard } from '@/features/review/FeedCard';
import { ReviewEditSheet } from '@/features/review/ReviewCellParts';
import { useDeleteReview, useUpdateReview } from '@/lib/data/useReviewMutations';
import { Alert } from 'react-native';
import type { Review } from '@/lib/api/types';

export default function MyReviews() {
  // KB-148: 리뷰 MVP 제외 — 진입점이 없어도 딥링크/백스택으로 도달 가능하니 홈으로.
  // FLAGS는 컴파일 상수라 훅 순서에 영향 없음 (플래그 켜면 이 가드는 no-op)
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;

  const router = useRouter();
  const { t } = useTranslation();
  const { data: reviews, isLoading: reviewsLoading, error: reviewsError, refetch: refetchReviews } = useMyReviews(); // P-164
  const { data: foods } = useFoods();
  // P-182: 수정/삭제는 셀 ⋮(항상 본인 화면) — ActionSheet 현 로직
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();
  const [editTarget, setEditTarget] = useState<Review | null>(null);
  const confirmDelete = (rv: Review) => {
    Alert.alert(t('editReview.deleteConfirmTitle'), t('editReview.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('editReview.delete'), style: 'destructive', onPress: () => deleteReview.mutate({ reviewId: rv.id, foodId: rv.foodId }) },
    ]);
  };
  const onMore = (rv: Review) => {
    Alert.alert(rv.foodName ?? foodMap.get(rv.foodId)?.name ?? t('myReviews.viewDish'), undefined, [
      { text: t('editReview.title'), onPress: () => setEditTarget(rv) },
      { text: t('editReview.delete'), style: 'destructive', onPress: () => confirmDelete(rv) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const foodMap = useMemo(() => new Map((foods ?? []).map((f) => [f.foodId, f])), [foods]);

  // P-336(9/8 예진): 위험 칩 필터 소멸 — 목록 = 전체(최신순). 시안 2200:21038 칩은 B(유지 이탈).
  const list = useMemo(() => {
    const arr = [...(reviews ?? [])];
    arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [reviews]);

  const count = reviews?.length ?? 0;
  const isGuest = useIsGuest();

  // 라우트 자체 가드 (⑧-b) — 진입로는 프로필 탭(게이트)뿐이지만 딥링크 이중 방어.
  if (isGuest) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('myReviews.title')} onBack={() => router.back()} />
        <AuthGateSheet context="profile" open onClose={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SubHeader title={t('myReviews.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.body, count === 0 && { flexGrow: 1 }]} showsVerticalScrollIndicator={false}>
        {/* P-164: 로드 실패 = 공용 에러(+재시도) — 빈 상태로 위장 금지 */}
        {reviewsError && !reviews ? (
          <QueryErrorBlock error={reviewsError} onRetry={() => void refetchReviews()} onGoBack={() => router.back()} />
        ) : reviewsLoading && !reviews ? (
          /* P-287(4003:12753): 첫 로드 = 스켈레톤(공백·팝인 금지 규칙) */
          <SkeletonMyReviews />
        ) : (
          <>

            <View>
              {list.map((rv) => (
                <FeedCard
                  key={rv.id}
                  review={rv}
                  t={t}
                  mine
                  onOpenFood={() => rv.foodId && router.push(`/food/${rv.foodId}?src=my_reviews` as Href)}
                  onGuestHelpful={() => {}}
                  onMore={() => onMore(rv)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {/* P-330(Codex #90 2R): 빈 상태 = 화면 루트 형제(ScreenCenterFill 계약 — 스크롤
          영역 기준이 아닌 화면 기준 센터, 칩 행은 위에 그대로) */}
      {!reviewsError && !reviewsLoading && count === 0 && (
        <ScreenCenterFill>
          <EmptyBlock label={t('myReviews.emptyTitle')} testID="myrev-empty" />
        </ScreenCenterFill>
      )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingBottom: 32 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 }, // P-154 ②: 상하 센터(앱 통일)
  emptyIc: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 19, fontWeight: '600', color: C.ink, textAlign: 'center' },
  emptyBody: { fontSize: 13.5, fontWeight: '400', color: C.ink2, textAlign: 'center', lineHeight: 20 },
});
