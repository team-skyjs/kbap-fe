/**
 * 가공식품 상세 리뷰 섹션 (KB-812 2차, P-507 · D-32 상세 보드 리뷰 = "보존 시안 → 현행 공통 리뷰 매핑": 평점·본문·사진·좋아요·신고·번역만).
 * 음식 상세 리뷰 프리뷰와 같은 부품(FeedCard·ModerationFlow) — 대상 칩(자기 자신) 숨김, 서빙·친절 축은 0이라 카드가 그리지 않는다.
 * - 요약(서버 reviewSummary): null(구서버) = 별·수 숨김 · 0건 = "첫 리뷰" 문구.
 * - 목록: 최신 3개 → "Load more reviews"로 받은 페이지 전부 → 다음 페이지도 같은 문구(서버 50건 keyset). reviews.seeMore = 본문 접기 토글 전용(expandToggle578).
 * - 쓰기 버튼 = FLAGS.packagedReviewWrite(서버 쓰기 플래그가 켜진 채널만) — 게스트 게이트·403 안내는 작성 화면 몫(음식과 같음).
 * - 신고 입력은 ModerationFlow 모달 안(음식 상세와 같은 예외 사유 — reviewKeyboard700).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { Btn } from '@/components/Btn';
import { Stars } from '@/components';
import { Shimmer } from '@/components/Skeleton';
import { QueryErrorBlock } from '@/components/StateBlock';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { color as C, font } from '@/lib/theme';
import { FLAGS } from '@/lib/flags';
import { EVENTS, track } from '@/lib/analytics';
import { useMe } from '@/lib/data/useMe';
import { useProcessedReviews } from '@/lib/data/useFoodReviews';
import { useDeleteReview } from '@/lib/data/useReviewMutations';
import { FeedCard } from '@/features/review/FeedCard';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import type { ProcessedFoodDetail } from '@/lib/api/processedFoodAdapter';

export const PACKAGED_REVIEW_PREVIEW_N = 3;

export function PackagedReviews({ productId, summary }: { productId: string; summary: ProcessedFoodDetail['reviewSummary'] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useProcessedReviews(productId);
  const { data: me } = useMe();
  const deleteReview = useDeleteReview();
  const [expanded, setExpanded] = React.useState(false);
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  const [gate, setGate] = React.useState(false);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const shown = expanded ? items : items.slice(0, PACKAGED_REVIEW_PREVIEW_N);
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
    list = shown.map((r) => {
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

  const hiddenLoaded = !expanded && items.length > PACKAGED_REVIEW_PREVIEW_N;
  return (
    <View style={s.root} testID="pf-reviews">
      <View style={s.divider} />
      <View style={s.head}>
        <Text style={s.h2}>{t('reviews.headerTitle')}</Text>
        {/* 요약 null(구서버) = 숨김 · 0건 = 별 없이(아래 "첫 리뷰" 문구가 말한다) */}
        {summary != null && summary.count > 0 && (
          <View style={s.score} testID="pf-reviews-summary">
            <Stars value={summary.avgRating ?? 0} size={16} />
            <Text style={s.scoreText}>
              {summary.avgRating != null ? summary.avgRating.toFixed(1) : '—'} ({summary.count})
            </Text>
          </View>
        )}
      </View>
      {list}
      {(hiddenLoaded || (expanded && q.hasNextPage)) && (
        <View style={s.btnRow}>
          {hiddenLoaded ? (
            <Btn variant="ghost" onPress={() => setExpanded(true)} testID="pf-reviews-more">{t('reviews.loadMore')}</Btn>
          ) : (
            <Btn variant="ghost" busy={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} testID="pf-reviews-load-more">{t('reviews.loadMore')}</Btn>
          )}
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

// 음식 상세 리뷰 섹션 값(디바이더 8 #F5F5F5 · 별↔점수 2 · 점수 13/600) — 이 화면 거터는 부모 pad(20)라 카드 자체 좌우 20을 음수 마진으로 상쇄
const s = StyleSheet.create({
  root: { marginHorizontal: -20, gap: 0 },
  divider: { height: 8, backgroundColor: '#F5F5F5' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20 },
  h2: { flex: 1, fontFamily: font.bodySemi, fontSize: 16, lineHeight: 24, color: C.ink },
  score: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  scoreText: { fontSize: 13, fontWeight: '600', color: '#2F3137' },
  beFirst: { fontSize: 14, fontWeight: '600', color: C.ink2, textAlign: 'center', paddingTop: 16 },
  btnRow: { paddingHorizontal: 20, paddingTop: 16 },
  skel: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  skelCard: { height: 96, borderRadius: 8 },
});
