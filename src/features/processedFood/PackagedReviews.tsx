/**
 * 가공식품 상세 리뷰 섹션 (KB-812 2차, P-507 · D-32 상세 보드 리뷰 = "보존 시안 → 현행 공통 리뷰 매핑": 평점·본문·사진·좋아요·신고·번역만).
 * 음식 상세 리뷰 프리뷰와 같은 부품(FeedCard·ModerationFlow) — 대상 칩(자기 자신) 숨김, 서빙·친절 축은 0이라 카드가 그리지 않는다.
 * - KB-865 v4(시안 08 · README "기본 리뷰 요약과 무한 스크롤 리뷰 목록, Read reviews 버튼 제거"): 요약 = 음식 상세 RatingSummaryBox 그대로,
 *   축 라벨만 Taste·Spiciness·Sweetness(KB-869 #461 — overall = 별점 평균 = taste, 축 없음 = 숨김). 요약 null(구서버)·0건 = 박스 없음.
 * - 목록: 받은 페이지 전부 · 화면이 바닥 근처에 오면 다음 페이지(loadMoreRef — 상세 ScrollView가 부른다, 서버 50건 keyset).
 *   다음 페이지 실패 = 안내 + 다시 시도(자동 재요청 멈춤).
 * - 쓰기 버튼 = FLAGS.packagedReviewWrite(서버 쓰기 플래그가 켜진 채널만) — 게스트 게이트·403 안내는 작성 화면 몫(음식과 같음).
 * - 신고 입력은 ModerationFlow 모달 안(음식 상세와 같은 예외 사유 — reviewKeyboard700).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Shimmer } from '@/components/Skeleton';
import { QueryErrorBlock } from '@/components/StateBlock';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { color as C } from '@/lib/theme';
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
  const [gate, setGate] = React.useState(false);
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
          showFood={false} /* 자기 자신 대상 칩 무의미 — 음식 상세와 같음 */
          onOpenFood={() => {}}
          onGuestHelpful={() => setGate(true)}
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
      {list}
      {q.isFetchingNextPage && <View style={s.btnRow}><Shimmer style={s.skelCard} /></View>}
      {q.isFetchNextPageError && (
        <View style={s.btnRow}>
          <Btn variant="ghost" onPress={() => void q.fetchNextPage()} testID="pf-reviews-more-retry">{t('common.tryAgain')}</Btn>
        </View>
      )}
      {FLAGS.packagedReviewWrite && FLAGS.reviewsLiveEnabled && ( /* 롤백 스위치(reviewsLiveEnabled off) = 가공식품 쓰기 경로 없음 — 버튼째 숨김(Codex #314) */
        <View style={s.btnRow}>
          <Btn variant="ghost" onPress={write} testID="pf-write-review">{t('reviews.writeReview')}</Btn>
        </View>
      )}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => router.push(`/processed-foods/${productId}/review?reviewId=${m.id}` as Href)}
        onDelete={(m) => deleteReview.mutate({ reviewId: m.id, foodId: '' })} /* 무효화가 ['processedFoods'] 리뷰·상세 프리픽스를 잡는다 */
        onBlocked={() => void q.refetch()}
      />
      <AuthGateSheet context="helpful" open={gate} onClose={() => setGate(false)} />
    </View>
  );
}

// 이 화면 거터는 부모 pad(20)라 카드 자체 좌우 20을 음수 마진으로 상쇄
const s = StyleSheet.create({
  root: { marginHorizontal: -20, gap: 0 },
  // 시안 08: 버튼 아래 16 · 박스 335 #F7F8FA(음식 상세와 같은 부품) → 카드 목록
  summary: { paddingHorizontal: 20, paddingBottom: 8 },
  beFirst: { fontSize: 14, fontWeight: '600', color: C.ink2, textAlign: 'center', paddingTop: 16 },
  btnRow: { paddingHorizontal: 20, paddingTop: 16 },
  skel: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  skelCard: { height: 96, borderRadius: 8 },
});
