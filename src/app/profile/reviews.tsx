/**
 * My reviews — KB-434 D-6(4150:14525). AppBar "My Reviews" → 위험 칩(All·Safe·Avoid)
 * → 리뷰 카드 = D-2 FeedCard(Variant3 — 우측 ⋮ 더보기: 수정/삭제 ActionSheet 현 로직,
 * helpful은 본인 = 카운트 표시 전용 P-196 공용 분기).
 *
 * 구 통계 헤더·정렬 필 소멸(시안 부재). 칩 위험도 = 캐시 조인(personalRisk false-safe
 * 가드 — 서버 리뷰 요약에 위험도 없음, 캐시 미스는 All에서만 표시).
 * Data via useMyReviews() — 수정/삭제 뮤테이션·시트 무변.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useRouter, type Href } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, type RiskState } from '@/lib/theme';
import { SubHeader, IconFood } from '@/components';
import { Chip } from '@/components/Chip';
import { useMe, useMyReviews } from '@/lib/data/useMe';
import { useFoods } from '@/lib/data/useFoods';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { QueryErrorBlock } from '@/components/StateBlock';
import { FeedCard } from '@/features/review/FeedCard';
import { ReviewEditSheet } from '@/features/review/ReviewCellParts';
import { useDeleteReview, useUpdateReview } from '@/lib/data/useReviewMutations';
import { Alert } from 'react-native';
import { personalRisk } from '@/lib/risk';
import type { Review } from '@/lib/api/types';

type RiskChip = 'all' | RiskState;
const RISK_CHIPS: RiskChip[] = ['all', 'safe', 'danger']; // 시안: All·Safe·Avoid

export default function MyReviews() {
  // KB-148: 리뷰 MVP 제외 — 진입점이 없어도 딥링크/백스택으로 도달 가능하니 홈으로.
  // FLAGS는 컴파일 상수라 훅 순서에 영향 없음 (플래그 켜면 이 가드는 no-op)
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;

  const router = useRouter();
  const { t } = useTranslation();
  const { data: reviews, error: reviewsError, refetch: refetchReviews } = useMyReviews(); // P-164
  const { data: foods } = useFoods();
  const { data: me } = useMe();
  const [chip, setChip] = useState<RiskChip>('all');
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
  const hasR = (me?.restrictions.length ?? 0) > 0;

  const list = useMemo(() => {
    const arr = [...(reviews ?? [])];
    arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (chip === 'all') return arr;
    // 위험 칩 = 캐시 조인(personalRisk) — 캐시 미스(위험 미상)는 필터에서 제외
    return arr.filter((rv) => {
      const food = foodMap.get(rv.foodId);
      return food != null && personalRisk(food.risk, hasR) === chip;
    });
  }, [reviews, chip, foodMap, hasR]);

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
        ) : count === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIc}>
              <IconFood size={30} color={C.ink3} />
            </View>
            <Text style={styles.emptyTitle}>{t('myReviews.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('myReviews.emptyBody')}</Text>
          </View>
        ) : (
          <>
            {/* 위험 칩 행 — All·Safe·Avoid(D-2 칩 공용) */}
            <View style={styles.chipRow}>
              {RISK_CHIPS.map((c) => (
                <Chip
                  key={c}
                  label={c === 'all' ? t('home.filterAll') : t(`risk.${c}`)}
                  selected={chip === c}
                  onPress={() => setChip(c)}
                  testID={`myrev-chip-${c}`}
                />
              ))}
            </View>

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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, paddingVertical: 12 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 }, // P-154 ②: 상하 센터(앱 통일)
  emptyIc: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 19, fontWeight: '600', color: C.ink, textAlign: 'center' },
  emptyBody: { fontSize: 13.5, fontWeight: '400', color: C.ink2, textAlign: 'center', lineHeight: 20 },
});
