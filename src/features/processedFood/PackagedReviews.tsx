/**
 * 가공식품 상세 리뷰 섹션 (KB-812 2차, P-507 · D-32 상세 보드 리뷰 = "보존 시안 → 현행 공통 리뷰 매핑": 평점·본문·사진·좋아요·신고·번역만).
 * 음식 상세 리뷰 프리뷰와 같은 부품(FeedCard·ModerationFlow) — 대상 칩(자기 자신) 숨김, 서빙·친절 축은 0이라 카드가 그리지 않는다.
 * - KB-865 v4(시안 08 · README "기본 리뷰 요약과 무한 스크롤 리뷰 목록, Read reviews 버튼 제거"): 요약 = 음식 상세 RatingSummaryBox 그대로,
 *   축 라벨만 Taste·Spiciness·Sweetness(KB-869 #461 — overall = 별점 평균 = taste, 축 없음 = 숨김). 요약 null(구서버)·0건 = 박스 없음.
 * - 목록: 받은 페이지 전부 · 화면이 바닥 근처에 오면 다음 페이지(loadMoreRef — 상세 ScrollView가 부른다, 서버 50건 keyset).
 *   다음 페이지 실패 = 안내 + 다시 시도(자동 재요청 멈춤).
 * - KB-865 ④(시안 31·46): 요약 아래 헤더 행 'Reviews' + 우측 텍스트 링크 'Write a review'(구 하단 ghost 버튼 대체) · 빈 별 + `평균 (건수)` 행(요약 0건·null = 행 없음).
 * - 쓰기 버튼 = FLAGS.packagedReviewWrite(서버 쓰기 플래그가 켜진 채널만) — 게스트 게이트·403 안내는 작성 화면 몫(음식과 같음).
 * - 신고 입력은 ModerationFlow 모달 안(음식 상세와 같은 예외 사유 — reviewKeyboard700).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Pressable } from '@/components/Pressable';
import { Star } from '@/components';
import { Shimmer } from '@/components/Skeleton';
import { QueryErrorBlock } from '@/components/StateBlock';
import { AuthGateSheet, type GateContext } from '@/components/AuthGateSheet';
import { useIsGuest } from '@/lib/auth/useSession';
import { photoRemovalHref } from '@/lib/review/reviewTarget';
import { color as C, radius } from '@/lib/theme';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { useMe } from '@/lib/data/useMe';
import { useProcessedReviews } from '@/lib/data/useFoodReviews';
import { useDeleteReview } from '@/lib/data/useReviewMutations';
import { FeedCard } from '@/features/review/FeedCard';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { RatingSummaryBox } from '@/features/review/RatingSummaryBox';
import type { ProcessedFoodDetail } from '@/lib/api/processedFoodAdapter';

export function PackagedReviews({ productId, summary, loadMoreRef }: { productId: string; summary: ProcessedFoodDetail['reviewSummary']; loadMoreRef?: React.RefObject<(() => void) | null> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useProcessedReviews(productId);
  const { data: me } = useMe();
  const deleteReview = useDeleteReview();
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  const [gate, setGate] = React.useState<GateContext | null>(null);
  const isGuest = useIsGuest();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = q;
  // 바닥 근처 = 다음 페이지 — 실패 중엔 멈춘다(수동 다시 시도만, Codex #308 문법)
  React.useEffect(() => {
    if (!loadMoreRef) return;
    loadMoreRef.current = () => { if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage(); };
    return () => { loadMoreRef.current = null; };
  }, [loadMoreRef, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  const write = () => {
    track(EVENTS.review_write_tap, { source: 'detail', target_type: 'packaged' });
    router.push(`/processed-foods/${productId}/review` as Href);
  };

  let list: React.ReactNode;
  if (q.isPending) {
    list = (
      <View style={s.skel} testID="pf-reviews-skeleton">
        <Shimmer style={s.skelCard} />
        <Shimmer style={s.skelCard} />
      </View>
    );
  } else if (q.isError && items.length === 0) {
    list = (
      <View testID="pf-reviews-error">
        <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      </View>
    );
  } else if (items.length === 0) {
    list = <Text style={s.beFirst} testID="pf-reviews-empty">{t('detail.beFirstReview')}</Text>;
  } else {
    list = items.map((r) => {
      const mine = r.memberId != null && r.memberId === me?.id;
      return (
        <FeedCard
          key={r.id}
          review={r}
          t={t}
          mine={mine}
          youAsName /* 시안 46 */
          showFood={false} /* 자기 자신 대상 칩 무의미 — 음식 상세와 같음 */
          onOpenFood={() => {}}
          onGuestHelpful={() => setGate('helpful')}
          onMore={() =>
            setMod({
              type: 'review',
              id: r.id,
              author: { id: r.author?.memberId ?? r.memberId ?? `rv-${r.id}`, nickname: r.author?.nickname ?? null, nationality: r.authorNationality },
              mine,
              anonymized: r.anonymized === true,
            })
          }
        />
      );
    });
  }

  return (
    <View style={s.root} testID="pf-reviews">
      {/* 요약 null(구서버)·0건 = 박스 없음(아래 "첫 리뷰" 문구가 말한다) */}
      {summary != null && summary.overall.count > 0 && (
        <View style={s.summary} testID="pf-reviews-summary">
          <RatingSummaryBox
            overall={summary.overall}
            axes={{ taste: summary.taste?.average ?? null, speed: summary.spiciness?.average ?? null, service: summary.sweetness?.average ?? null }}
            axisLabels={{ speed: t('review.spiciness'), service: t('review.sweetness') }}
            t={t}
          />
        </View>
      )}
      {/* KB-865 ④ 시안 31: 헤더 행 — 쓰기 링크는 서버 쓰기 플래그 + 롤백 스위치(reviewsLiveEnabled off = 쓰기 경로 없음, Codex #314) */}
      <View style={s.head}>
        <Text style={s.heading} accessibilityRole="header">{t('reviews.headerTitle')}</Text>
        {FLAGS.packagedReviewWrite && FLAGS.reviewsLiveEnabled && (
          <Pressable onPress={write} hitSlop={12} accessibilityRole="button" testID="pf-write-review">
            <Text style={s.writeLink}>{t('reviews.writeReview')}</Text>
          </Pressable>
        )}
      </View>
      {summary != null && summary.overall.count > 0 && summary.overall.average != null && (
        <View style={s.countRow} testID="pf-reviews-count">
          <Star size={16} fillPct={0} />
          <Text style={s.countText}>{`${summary.overall.average.toFixed(1)} (${summary.overall.count})`}</Text>
        </View>
      )}
      {list}
      {q.isFetchingNextPage && <View style={s.btnRow}><Shimmer style={s.skelCard} /></View>}
      {q.isFetchNextPageError && (
        <View style={s.btnRow}>
          <Btn variant="ghost" onPress={() => void q.fetchNextPage()} testID="pf-reviews-more-retry">{t('common.tryAgain')}</Btn>
        </View>
      )}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => router.push(`/processed-foods/${productId}/review?reviewId=${m.id}` as Href)}
        onDelete={(m) => deleteReview.mutate({ reviewId: m.id, foodId: '' })} /* 무효화가 ['processedFoods'] 리뷰·상세 프리픽스를 잡는다 */
        onBlocked={() => void q.refetch()}
        onPhotoRemoval={(m) => { // KB-814 F3: 남의 가공식품 리뷰 — 게스트 = 로그인 게이트
          if (isGuest) { setGate('photoRemoval'); return; }
          const rv = items.find((r) => r.id === m.id);
          const href = rv && photoRemovalHref(rv);
          if (href) router.push(href);
        }}
      />
      <AuthGateSheet context={gate ?? 'helpful'} open={gate != null} onClose={() => setGate(null)} />
    </View>
  );
}

// 이 화면 거터는 부모 pad(20)라 카드 자체 좌우 20을 음수 마진으로 상쇄
const s = StyleSheet.create({
  root: { marginHorizontal: -20, gap: 0 },
  // 시안 08: 버튼 아래 16 · 박스 335 #F7F8FA(음식 상세와 같은 부품) → 카드 목록
  summary: { paddingHorizontal: 20, paddingBottom: 8 },
  // 시안 31: 요약 아래 16 · 헤더 18/700 + 링크 15 ink2 · 빈 별 16 + 14 ink3 · 카드 위 8
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 16 },
  heading: { flexShrink: 1, fontSize: 18, fontWeight: '700', color: C.ink },
  writeLink: { fontSize: 16, fontWeight: '400', color: C.ink2 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  countText: { fontSize: 16, fontWeight: '400', color: C.ink3 },
  beFirst: { fontSize: 16, fontWeight: '600', color: C.ink2, textAlign: 'center', paddingTop: 16 },
  btnRow: { paddingHorizontal: 20, paddingTop: 16 },
  skel: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  skelCard: { height: 96, borderRadius: radius.md },
});
