/**
 * My reviews — KB-434 D-6(4150:14525). AppBar "My Reviews" → 위험 칩(All·Safe·Avoid)
 * → 리뷰 카드 = D-2 FeedCard(Variant3 — 우측 ⋮ 더보기: 수정/삭제 ActionSheet 현 로직,
 * helpful은 본인 = 카운트 표시 전용 P-196 공용 분기).
 *
 * 구 통계 헤더·정렬 필·위험 칩 소멸(P-336 — 칩 위험도 캐시 조인(personalRisk false-safe
 * 가드 — 서버 리뷰 요약에 위험도 없음, 캐시 미스는 All에서만 표시).
 * Data via useMyReviews() — 수정/삭제 뮤테이션·시트 무변.
 */
// ⚠️ KB-602 래칫 기록(2026-09-21): 아래 `FLAGS.*` early return이 **훅 호출보다 위**에 있다 —
// `react-hooks/rules-of-hooks`가 이 파일에서 위반으로 잡는다(현재 warn으로 내려둔 상태).
// 지금 안전한 이유는 **FLAGS가 빌드 상수**라 한 빌드 안에서 분기가 고정된다는 것 하나뿐이다.
// 플래그가 런타임 값(원격 컨피그·A/B 등)이 되는 순간 훅 순서가 깨진다. 소진 발주(KB-603~)에서
// early return을 훅 아래로 내리거나 래퍼 컴포넌트로 분리할 것.
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useRouter } from 'expo-router';
import { reviewEditHref, reviewTargetHref } from '@/lib/review/reviewTarget';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, radius } from '@/lib/theme';
import { SubHeader, IconFood } from '@/components';
import { useMyReviews } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { EmptyBlock, QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { SkeletonMyReviews } from '@/components/Skeleton';
import { FeedCard } from '@/features/review/FeedCard';
import { useDeleteReview } from '@/lib/data/useReviewMutations';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import type { Review } from '@/lib/api/types';

export default function MyReviews() {
  // KB-148: 리뷰 MVP 제외 — 진입점이 없어도 딥링크/백스택으로 도달 가능하니 홈으로.
  // KB-604: 가드는 **훅 없는 바깥 컴포넌트**에(review.tsx KB-620 문법) — off면 내 리뷰·음식 쿼리가 마운트되지 않는다(전과 동일).
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;
  return <MyReviewsScreen />;
}

function MyReviewsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: reviews, isLoading: reviewsLoading, error: reviewsError, refetch: refetchReviews } = useMyReviews(); // P-164
  // P-182: 수정/삭제는 셀 ⋮(항상 본인 화면) — ActionSheet 현 로직
  const deleteReview = useDeleteReview();
  // KB-777 B2-6: 본인 리뷰 ⋯ = 피드와 같은 공용 하단 시트(ModerationFlow mine — 수정·삭제, 삭제 = 위험색).
  // 종전 OS Alert 3버튼(안드: 취소가 위·위험색 없음)이 피드 시트와 달랐다. 삭제 동작도 피드와 같다(시트에서 바로).
  const [mod, setMod] = useState<ModTarget | null>(null);
  const onMore = (rv: Review) =>
    setMod({ type: 'review', id: rv.id, author: { id: rv.memberId ?? `rv-${rv.id}`, nickname: null, nationality: rv.authorNationality }, mine: true });
  const byId = (id: string) => (reviews ?? []).find((r) => r.id === id);

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
                  onOpenFood={() => { const href = reviewTargetHref(rv, 'my_reviews'); if (href) router.push(href); }} /* KB-812 2차: 가공식품 = 제품 상세 */
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
      {/* 열 때만 마운트(신고 뮤테이션 훅 등 — 닫힌 동안 비용 0) */}
      {mod && <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => { const rv = byId(m.id); const href = rv && reviewEditHref(rv); if (href) router.push(href); }} /* P-358 · KB-812 2차: 대상별 작성 화면 */
        onDelete={(m) => { const rv = byId(m.id); if (rv) deleteReview.mutate({ reviewId: rv.id, foodId: rv.foodId }); }}
        onBlocked={() => {}}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingBottom: 32 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 }, // P-154 ②: 상하 센터(앱 통일)
  emptyIc: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 19, fontWeight: '600', color: C.ink, textAlign: 'center' },
  emptyBody: { fontSize: 14, fontWeight: '400', color: C.ink2, textAlign: 'center', lineHeight: 21 },
});
