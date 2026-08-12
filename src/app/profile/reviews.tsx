/**
 * My reviews list (mockup Screen I7) — reached from "See all" on the profile
 * tab's My reviews section (KB-85). Stat header (count + avg given) + Recent/
 * Top-rated sort + review cards. Tapping a card opens that dish's detail
 * (review editing is KB-73, out of scope here). Empty state when no reviews.
 *
 * Data via useMyReviews(). P-165(#144): 음식 이름·썸네일 = **서버 food 요약 우선**
 * (lang 해석) → 카탈로그 캐시 폴백 → 중립 라벨(P-150 ④) 최후. risk는 캐시 조인만
 * (서버 요약에 위험도 없음) — personalRisk() (false-safe guard) 경유.
 * Helpful-votes / "most helpful" sort from the design are omitted — not in the
 * review contract yet (BE 논의).
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useRouter, type Href } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow, type RiskState } from '@/lib/theme';
import { SubHeader, RiskMark, Stars, IconFood, IconMore, CardPhoto } from '@/components';
import { useMe, useMyReviews } from '@/lib/data/useMe';
import { useFoods } from '@/lib/data/useFoods';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { QueryErrorBlock } from '@/components/StateBlock';
import { ExpandableBody, ReviewEditSheet } from '@/features/review/ReviewCellParts';
import { useDeleteReview, useUpdateReview } from '@/lib/data/useReviewMutations';
import { Alert } from 'react-native';
import { personalRisk } from '@/lib/risk';
import type { FoodCard, Review } from '@/lib/api/types';

type TFn = ReturnType<typeof useTranslation>['t'];
type SortKey = 'recent' | 'rating';

export default function MyReviews() {
  // KB-148: 리뷰 MVP 제외 — 진입점이 없어도 딥링크/백스택으로 도달 가능하니 홈으로.
  // FLAGS는 컴파일 상수라 훅 순서에 영향 없음 (플래그 켜면 이 가드는 no-op)
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;

  const router = useRouter();
  const { t } = useTranslation();
  const { data: reviews, error: reviewsError, refetch: refetchReviews } = useMyReviews(); // P-164
  const { data: foods } = useFoods();
  const { data: me } = useMe();
  const [sort, setSort] = useState<SortKey>('recent');
  // P-182: 디테일 소멸 — 수정/삭제는 셀 ⋯(항상 본인 화면)
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();
  const [editTarget, setEditTarget] = useState<Review | null>(null);
  const confirmDelete = (rv: Review) => {
    Alert.alert(t('editReview.deleteConfirmTitle'), t('editReview.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('editReview.delete'), style: 'destructive', onPress: () => deleteReview.mutate({ reviewId: rv.id, foodId: rv.foodId }) },
    ]);
  };

  const foodMap = useMemo(() => new Map((foods ?? []).map((f) => [f.foodId, f])), [foods]);
  const hasR = (me?.restrictions.length ?? 0) > 0;

  const list = useMemo(() => {
    const arr = [...(reviews ?? [])];
    arr.sort((a, b) => {
      const recent = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === 'rating' ? b.rating - a.rating || recent : recent;
    });
    return arr;
  }, [reviews, sort]);

  const count = reviews?.length ?? 0;
  const avg = count ? (reviews as Review[]).reduce((s, r) => s + r.rating, 0) / count : null;
  const isGuest = useIsGuest();

  // 라우트 자체 가드 (⑧-b) — 진입로는 프로필 탭(게이트)뿐이지만 딥링크 이중 방어.
  // 게스트는 콘텐츠(mock 포함) 미마운트, 시트 닫으면 뒤로.
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
            <View style={styles.stat}>
              <StatBig value={String(count)} label={t('myReviews.statReviews')} />
              <View style={styles.sd} />
              <StatBig value={(avg ?? 0).toFixed(1)} label={t('myReviews.statAvgGiven')} color={C.primary} />
            </View>

            <View style={styles.sortRow}>
              <SortPill label={t('reviews.sortRecent')} on={sort === 'recent'} onPress={() => setSort('recent')} />
              <SortPill label={t('reviews.sortTopRated')} on={sort === 'rating'} onPress={() => setSort('rating')} />
            </View>

            <View style={{ gap: 10 }}>
              {list.map((rv) => (
                <ReviewCard
                  key={rv.id}
                  review={rv}
                  food={foodMap.get(rv.foodId)}
                  hasR={hasR}
                  when={relativeDate(rv.createdAt, t)}
                  onOpenFood={() => rv.foodId && router.push(`/food/${rv.foodId}` as Href)}
                  onEdit={() => setEditTarget(rv)}
                  onDelete={() => confirmDelete(rv)}
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
        onSave={({ rating, body }) => {
          if (!editTarget) return;
          updateReview.mutate(
            { reviewId: editTarget.id, foodId: editTarget.foodId, current: editTarget, changes: { rating, body } },
            { onSettled: () => setEditTarget(null) },
          );
        }}
        t={t}
      />
    </View>
  );
}

function StatBig({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.big}>
      <Text style={[styles.bigNum, color ? { color } : null]}>{value}</Text>
      <Text style={styles.bigLbl}>{label}</Text>
    </View>
  );
}

function SortPill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.pill, on && styles.pillOn]} onPress={onPress} hitSlop={6}>
      <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ReviewCard({ review, food, hasR, when, onOpenFood, onEdit, onDelete }: { review: Review; food?: FoodCard; hasR: boolean; when: string; onOpenFood: () => void; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation(); // P-150 ④: 중립 라벨용
  // P-178 ②: 캐시 미스 = 뱃지 숨김 — unable 의미 예약(재료 정보 부족) 오염 방지.
  // BE food.riskStatus(개인화) 배포 시 서버값 스왑.
  const risk: RiskState | null = food ? personalRisk(food.risk, hasR) : null;
  // P-182: 전체 탭 제거 — 음식 영역 탭 = 음식 상세, ⋯ = 수정/삭제(기존 액션시트 문법)
  const onMore = () => {
    Alert.alert(review.foodName ?? food?.name ?? t('myReviews.viewDish'), undefined, [
      { text: t('editReview.title'), onPress: onEdit },
      { text: t('editReview.delete'), style: 'destructive', onPress: onDelete },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };
  return (
    <View style={styles.card}>
      <Pressable style={styles.thumb} onPress={onOpenFood} testID={`my-food-${review.id}`}>
        {/* P-165: 서버 썸네일 우선 — 부재 시 기존 플레이스홀더 */}
        {review.foodImageUrl ? <CardPhoto uri={review.foodImageUrl} borderRadius={12} /> : <IconFood size={22} color={C.ink3} />}
        {risk != null && (
          <View style={styles.bdg}>
            <RiskMark state={risk} size={14} />
          </View>
        )}
      </Pressable>
      <View style={styles.main}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {review.foodName ?? food?.name ?? t('myReviews.viewDish') /* P-165: 서버 이름(lang) 우선 → 캐시 → 중립 라벨(P-150 ④ — id 숫자 노출 금지) */}
          </Text>
          <Stars value={review.rating} size={13} />
        </View>
        {!!review.body && <ExpandableBody body={review.body} t={t} style={styles.cardBody} />}
        <View style={styles.foot}>
          <Text style={styles.tag}>{when}</Text>
        </View>
      </View>
      {/* P-182: ⋯ = 수정/삭제(항상 본인 화면) — chevron(디테일 진입) 소멸 */}
      <Pressable hitSlop={10} onPress={onMore} style={{ alignSelf: 'flex-start' }} testID={`my-more-${review.id}`}>
        <IconMore size={16} color={C.ink3} />
      </Pressable>
    </View>
  );
}

function relativeDate(iso: string, t: TFn): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return t('reviews.today');
  if (days < 7) return t('reviews.daysAgo', { count: days });
  return t('reviews.weeksAgo', { count: Math.floor(days / 7) });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32, gap: 14 },

  stat: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 15, ...shadow.sh1 },
  big: { flex: 1, alignItems: 'center', gap: 3 },
  bigNum: { fontFamily: font.display, fontSize: 30, color: C.ink, lineHeight: 40 },
  bigLbl: { fontFamily: font.body, fontSize: 10.5, color: C.ink3 },
  sd: { width: 1, alignSelf: 'stretch', backgroundColor: C.hair },

  sortRow: { flexDirection: 'row', gap: 8 },
  pill: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  pillOn: { backgroundColor: C.primary, borderColor: C.primary },
  pillText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 },
  pillTextOn: { color: '#fff' },

  card: { flexDirection: 'row', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12, ...shadow.sh1 },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bdg: { position: 'absolute', bottom: -3, right: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  main: { flex: 1, minWidth: 0, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  cardBody: { fontFamily: font.body, fontSize: 13, color: C.ink2, lineHeight: 19 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 }, // P-154 ②: 상하 센터(앱 통일)
  emptyIc: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: font.display, fontSize: 19, color: C.ink, textAlign: 'center' },
  emptyBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, textAlign: 'center', lineHeight: 20 },
});
