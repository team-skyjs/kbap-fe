/**
 * Food reviews (mockup Screen G2, FR-023) — reviews for one dish with a
 * same-nationality filter and a translate (original ↔ reader-language) toggle.
 * Reached from the detail rating cards. No risk rendering here.
 *
 * Anonymized reviews hide author identity (nationality/name). Scroll-aware back
 * header (§6); no emoji (SVG); reader text via i18n (English only for MVP).
 */
import * as React from 'react';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Animated from 'react-native-reanimated';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { EVENTS, track } from '@/lib/analytics';
import { EligibilityGate } from '@/features/review/EligibilityGate';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  Stars,
  Flag,
  MedalEmblem,
  StateBlock,
  QueryErrorBlock,
  stateIconColor,
  Spinner,
  IconGlobe,
  IconProfile,
  IconBubbleEmpty,
  IconPlus,
  IconCheck,
  IconChevron,
  IconChevronDown,
  IconMapPin,
  IconMore,
  CardPhoto,
} from '@/components';
import { ActionSheet } from '@/components/ActionSheet';
import { useFoodReviews } from '@/lib/data/useFoodReviews';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';
import { IconLock } from '@/components/icons';
import { useReviewTranslation } from '@/lib/data/useReviewTranslation';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { useBlockedUsers } from '@/lib/community/hooks';
import { ExpandableBody, HelpfulButton, ReviewEditSheet, ReviewPhotoStrip, ReviewExtrasLine, ReviewPlaceLine } from '@/features/review/ReviewCellParts';
import { useDeleteReview, useUpdateReview } from '@/lib/data/useReviewMutations';
import type { RatingAggregate, Review } from '@/lib/api/types';

const READER_LANG = 'en'; // MVP reader language

export default function FoodReviews() {
  // KB-148: 리뷰 MVP 제외 — 진입점이 없어도 딥링크/백스택으로 도달 가능하니 홈으로.
  // FLAGS는 컴파일 상수라 훅 순서에 영향 없음 (플래그 켜면 이 가드는 no-op)
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;

  const isGuest = useIsGuest();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();

  const { data: food } = useFoodDetail(id ?? '');
  // P-251: 리뷰 자격 게이트 — 회원 && reviewEligible === false만(게스트 = 빈 상태 CTA 자체 미노출)
  const [eligGate, setEligGate] = useState(false);
  const writeReview = () => {
    if (!isGuest && food?.reviewEligible === false) {
      setEligGate(true);
      return;
    }
    track(EVENTS.review_write_tap, { source: 'list' });
    router.push(`/food/${id}/review` as Href);
  };
  const { data: me } = useMe();
  const deleteReview = useDeleteReview();

  const [sameNatOnly, setSameNatOnly] = useState(false);
  const [sort, setSort] = useState<'recent' | 'rating'>('recent');
  const [sortSheet, setSortSheet] = useState(false); // KB-431 §2-4: 드롭다운 → ActionSheet

  const nationality = me?.nationality ?? 'US';
  // P-085(KB-73): 같은 국적 필터 = 서버 countryCode 파라미터 (목 경로는 훅이 흉내).
  // keyset 커서 — 페이지 평탄화 + 하단 더보기(fetchNextPage).
  const reviewsQ = useFoodReviews(id ?? '', sameNatOnly ? nationality : undefined);
  const loaded = reviewsQ.data != null;
  // P-186: 차단 회원 리뷰 클라 숨김 — 서버 필터링 미검증 보조(확인되면 제거)
  const { data: blockedUsers } = useBlockedUsers();
  const blockedIds = React.useMemo(() => new Set((blockedUsers ?? []).map((u) => u.id)), [blockedUsers]);
  const all = (reviewsQ.data?.pages.flatMap((p) => p.items) ?? []).filter((r) => {
    const author = r.author?.memberId ?? r.memberId;
    return author == null || !blockedIds.has(author);
  });
  const items = [...all].sort((a, b) => {
    const recent = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return sort === 'rating' ? b.rating - a.rating || recent : recent;
  });
  // 평점 집계 = 음식 상세 서버값 (P-085 — 목 재계산·리스트 응답 집계 폐기)
  const overall = food?.overall ?? { average: null, count: 0 };
  // KB-431 §2-3: 축 평균 — Taste = 서버 overall / Speed·Service = 서버 축 집계 부재라
  // 로드된 리뷰(값 있는 것만) 클라 평균. 무데이터 축 = null(바 미표시).
  const axisAverages = React.useMemo(() => {
    const avg = (pick: (r: Review) => number | undefined) => {
      const vals = all.map(pick).filter((v): v is number => typeof v === 'number' && v > 0);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return {
      taste: overall.average,
      speed: avg((r) => r.servingSpeed),
      service: avg((r) => r.staffKindness),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewsQ.data, blockedIds, overall.average]); // Codex #30 P2: 차단 필터 반영
  // P-085: 내 리뷰 판별 = 서버 memberId (목 시절 내 리뷰 캐시 id 집합 폐기)
  const isMine = (r: Review) => r.memberId != null && r.memberId === me?.id;
  // P-095: 행 ⋯ → 공용 ModerationFlow (내 것 Edit/Delete·남 Report/Block)
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  // P-182: 개별 디테일 소멸 — 셀 확장이 전문·사진·수정을 담당
  const updateReview = useUpdateReview();
  const [editTarget, setEditTarget] = useState<Review | null>(null);
  const openMenu = (r: Review) =>
    setMod({
      type: 'review',
      id: r.id,
      author: {
        id: r.author?.memberId ?? r.memberId ?? `rv-${r.id}`,
        nickname: r.author?.nickname ?? null,
        nationality: r.authorNationality,
      },
      mine: isMine(r),
    });

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 40, flexGrow: 1 }}
      >
        {/* P-164: 로드 실패 = 공용 에러(+재시도) — loaded 게이트 밖(에러 시 헤더만
            남던 빈 화면이 바로 이 구멍). 로드된 항목이 있으면 그 목록 유지. */}
        <EligibilityGate open={eligGate} onClose={() => setEligGate(false)} />
        {reviewsQ.isError && all.length === 0 ? (
          <QueryErrorBlock error={reviewsQ.error} onRetry={() => void reviewsQ.refetch()} onGoBack={() => router.back()} />
        ) : null}
        {/* 게스트는 리뷰 개수와 무관하게 항상 잠금 (실기기 반려분 #3) —
            빈 상태(쓰기 CTA 포함)는 회원에게만 */}
        {!(reviewsQ.isError && all.length === 0) && loaded && (!isGuest && all.length === 0 && !sameNatOnly ? (
          // No reviews at all → drop the dish header/summary/filter/sort; the
          // empty state owns the whole screen, vertically centered.
          <StateBlock
            fill
            icon={<IconBubbleEmpty size={38} color={stateIconColor.default} />}
            title={t('reviews.emptyTitle')}
            body={t('reviews.emptyBody')}
            primary={{
              label: t('reviews.writeReview'),
              icon: <IconPlus size={17} color="#fff" />,
              onPress: writeReview, // P-144 계측 + P-251 자격 게이트
            }}
          />
        ) : (
          <View style={styles.body}>
            {/* KB-431 §2-2: 음식 요약 카드 — 이미지 48 + 이름 + "ko · n reviews" */}
            <View style={styles.dishCard}>
              <View style={styles.dishThumb}>
                {food?.photoUrl ? <CardPhoto uri={food.photoUrl} borderRadius={4} /> : <IconBubbleEmpty size={20} color={C.ink3} />}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.dishName} numberOfLines={1}>{food?.name ?? ''}</Text>
                {/* 시안의 " · " 구분은 P-196 ④(가운뎃점 전수 제거) 잠금과 충돌 — 공백 유지(REPORTS) */}
                <Text style={styles.dishSub} numberOfLines={1}>
                  {food?.nameKo && food.nameKo !== food.name ? `${food.nameKo} ` : ''}
                  {t('reviews.subtitle', { count: overall.count })}
                </Text>
              </View>
            </View>

            {/* KB-431 §2-3: 평점 요약 박스(4150:16775) — 좌 총점 / 우 3축 세로 바.
                축 평균: Taste = 서버 overall · Speed/Service = 로드된 리뷰 클라 평균
                (서버 축 집계 부재 — REPORTS). 값 없는 축 = 미표시. */}
            <RatingSummaryBox overall={overall} axes={axisAverages} t={t} />

            {/* P-235: 게스트 열람 개방(무토큰 200 실측) — 블러 고스트·lock CTA 소멸.
                같은 국적 필터는 국적 미상이라 게스트 미노출(멘토 "내 국가 필터만 제외").
                쓰기·Helpful은 기존 게이트 유지. */}
            {false ? (
              <View />
            ) : (
            <>
            {/* KB-431 §2-4: 컨트롤 행 — 좌 토글(회원만 — 게스트 국적 미상, P-235) /
                우 정렬 드롭다운(현 2옵션 → ActionSheet). "KR only" 시안 = 현
                같은 국적 필터에 매핑(전용 KR 파라미터 아님 — 카피는 현 키). */}
            <View style={styles.controlRow}>
              {!isGuest ? (
                /* 9/5 예진 판정(Q12): 라벨 = "{국가코드} only"(reviews.countryOnly) — 필터 의미는
                   현 같은 국적 리뷰(서버 countryCode 파라미터) 그대로 */
                <Pressable style={styles.filterToggle} onPress={() => setSameNatOnly((v) => !v)} testID="same-nat-toggle">
                  <Switch on={sameNatOnly} />
                  <Text style={styles.filterLbl} numberOfLines={1}>
                    {t('reviews.countryOnly', { code: nationality })}
                  </Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable style={styles.sortBtn} onPress={() => setSortSheet(true)} testID="reviews-sort">
                <Text style={styles.sortLabel} numberOfLines={1}>
                  {t(sort === 'recent' ? 'reviews.sortRecent' : 'reviews.sortTopRated')}
                </Text>
                <IconChevronDown size={16} color={C.ink2} />
              </Pressable>
            </View>

            {/* filtered to empty — KC-0329 B: 국적 필터 빈 상태는 전용 문구 */}
            {items.length === 0 ? (
              <StateBlock
                icon={<IconBubbleEmpty size={38} color={stateIconColor.default} />}
                title={t('reviews.emptyTitle')}
                body={t(sameNatOnly ? 'reviews.emptySameNat' : 'reviews.emptyBody')}
                primary={{
                  label: t('reviews.writeReview'),
                  icon: <IconPlus size={17} color="#fff" />,
                  onPress: writeReview, // P-144 계측 + P-251 자격 게이트
                }}
              />
            ) : (
              <View style={{ gap: 12 }}>
                {items.map((r) => (
                  <ReviewItem key={r.id} review={r} t={t} mine={isMine(r)} foodId={id ?? ''} onMore={!r.anonymized ? () => openMenu(r) : undefined} /* P-186: 타인 = 신고/차단(익명 제외) */ />
                ))}
                {/* P-085: keyset 더보기 — hasNext일 때만 */}
                {reviewsQ.hasNextPage && (
                  <Pressable
                    style={styles.loadMore}
                    onPress={() => void reviewsQ.fetchNextPage()}
                    disabled={reviewsQ.isFetchingNextPage}
                  >
                    {reviewsQ.isFetchingNextPage ? (
                      <Spinner size={16} color={C.ink2} />
                    ) : (
                      <Text style={styles.loadMoreText}>{t('reviews.loadMore')}</Text>
                    )}
                  </Pressable>
                )}
              </View>
            )}
            </>
            )}
          </View>
        ))}
      </Animated.ScrollView>

      <StickyHeader hidden={hidden} mode="back" title={t('reviews.headerTitle')} onBack={() => router.back()} />
      {/* KB-431 §2-4: 정렬 시트 — 공용 ActionSheet(현 2옵션·현재값 체크) */}
      <ActionSheet
        open={sortSheet}
        title={t('reviews.sortTitle')}
        items={(['recent', 'rating'] as const).map((v) => ({
          key: v,
          label: t(v === 'recent' ? 'reviews.sortRecent' : 'reviews.sortTopRated'),
          icon: v === sort ? <IconCheck size={15} color={C.primary} /> : undefined,
          onPress: () => setSort(v),
        }))}
        onClose={() => setSortSheet(false)}
      />
      {/* P-095: 리뷰 ⋯ — 목록발 차단 = 재조회(무효화는 훅), 편집은 디테일로 */}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => setEditTarget(all.find((r) => r.id === m.id) ?? null)} /* P-182: 공용 수정 시트 */
        onDelete={(m) => deleteReview.mutate({ reviewId: m.id, foodId: id ?? '' })}
        onBlocked={() => void reviewsQ.refetch()}
      />
      <ReviewEditSheet
        review={editTarget}
        onClose={() => setEditTarget(null)}
        saving={updateReview.isPending}
        onSave={({ rating, body, place, extras }) => {
          if (!editTarget) return;
          updateReview.mutate(
            { reviewId: editTarget.id, foodId: id ?? '', current: editTarget, changes: { rating, body } },
            { onSettled: () => setEditTarget(null) },
          );
        }}
        t={t}
      />
    </View>
  );
}

type TFn = ReturnType<typeof useTranslation>['t'];

/** KB-431 §2-3: 세로 바 1개 — 뱃지(최고값 강조) + 바(fill 높이 = 점수/5 × 46) + 라벨. */
export function AxisBar({ label, value, top, testID }: { label: string; value: number; top: boolean; testID?: string }) {
  const fillH = Math.max(0, Math.min(1, value / 5)) * 46;
  return (
    <View style={styles.axisCol} testID={testID}>
      <View style={[styles.axisBadge, top ? styles.axisBadgeTop : styles.axisBadgeRest]}>
        <Text style={[styles.axisBadgeText, top && { color: '#FFFFFF' }]}>{value.toFixed(1)}</Text>
      </View>
      <View style={styles.axisTrack}>
        <View style={[styles.axisFill, { height: fillH }, top ? styles.axisFillTop : styles.axisFillRest]} testID={testID ? `${testID}-fill` : undefined} />
      </View>
      <Text style={styles.axisLbl} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** KB-431 §2-3: 평점 요약 박스(4150:16775). */
function RatingSummaryBox({
  overall,
  axes,
  t,
}: {
  overall: RatingAggregate;
  axes: { taste: number | null; speed: number | null; service: number | null };
  t: TFn;
}) {
  const bars: [string, string, number][] = [
    ['taste', t('review.extrasTaste'), axes.taste],
    ['speed', t('review.extrasSpeed'), axes.speed],
    ['service', t('review.extrasService'), axes.service],
  ].flatMap(([key, label, v]) => (v != null ? [[key as string, label as string, v as number]] : []));
  const max = Math.max(...bars.map((b) => b[2]), 0);
  return (
    <View style={styles.summaryBox} testID="rating-summary-box">
      <View style={styles.summaryLeft}>
        <Stars value={overall.average ?? 0} size={16} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
          <Text style={styles.bigScore}>{overall.average?.toFixed(1) ?? '—'}</Text>
          <Text style={styles.bigScoreOf}>/ 5</Text>
        </View>
        <Text style={styles.overallLbl}>{t('reviews.overall').toUpperCase()}</Text>
      </View>
      {bars.length > 0 && (
        <View style={styles.summaryRight}>
          {bars.map(([key, label, value]) => (
            <AxisBar key={key} label={label} value={value} top={value === max} testID={`axis-${key}`} />
          ))}
        </View>
      )}
    </View>
  );
}

function ReviewItem({ review, t, mine, foodId, onMore }: { review: Review; t: TFn; mine: boolean; foodId: string; onMore?: () => void }) {
  // P-085 author 방어 3케이스: ① author null(탈퇴)=익명 ② nickname null(미설정)
  // → 국적 코드 폴백 ③ countryCode null(미보유) → 국기 대신 중립 아바타.
  const anon = review.anonymized;
  const name = anon ? t('reviews.anonymous') : (review.author?.nickname ?? review.authorNationality ?? t('reviews.anonymous'));
  const tx = useReviewTranslation(review, READER_LANG);
  const langName = t(`reviews.lang.${tx.fromLang}`, { defaultValue: tx.fromLang });

  return (
    /* P-182 ②: 카드 전체 탭 제거 — 요소별 액션만 */
    <View style={styles.item}>
      <View style={styles.itemTop}>
        <View style={styles.who}>
          {anon || !review.authorNationality ? (
            <View style={styles.anonAvatar}>
              <IconProfile size={14} color={C.ink3} />
            </View>
          ) : (
            <Flag code={review.authorNationality} size={20} />
          )}
          <Text style={styles.whoName} numberOfLines={1}>{name}</Text>
          {!anon && !!review.authorRankTier && (
            <View style={styles.rankPill}>
              <MedalEmblem level={review.author?.level ?? 1} size={15} />
              <Text style={styles.rankText}>{review.authorRankTier}</Text>
            </View>
          )}
        </View>
        <View style={styles.itemTopRight}>
          <Stars value={review.rating} size={14} />
          {onMore && (
            <Pressable hitSlop={10} onPress={onMore}>
              <IconMore size={16} color={C.ink3} />
            </Pressable>
          )}
        </View>
      </View>

      {/* P-182 ②: 사진 = 공용 스트립+풀스크린 뷰어 */}
      <ReviewPhotoStrip photos={review.photos ?? []} />
      <ReviewPlaceLine place={review.place ?? null} />
      <ReviewExtrasLine review={review} mine={mine} />

      {!!tx.text && <ExpandableBody body={tx.text} t={t} />}

      {/* per-review translation control — P-085 지시 7: 번역 계약 미배포, 플래그 비노출
          (useReviewTranslation 코드는 보존 — 계약 배포 시 플래그 복원) */}
      {FLAGS.reviewTranslationEnabled && tx.canTranslate && (
        <View style={styles.txRow}>
          {tx.loading ? (
            <View style={styles.txInline}>
              <Spinner size={14} color={C.accent} />
              <Text style={styles.txMuted}>{t('reviews.translating')}</Text>
            </View>
          ) : tx.error ? (
            <View style={styles.txInline}>
              <Text style={styles.txError}>{t('reviews.translateFailed')}</Text>
              <Text style={styles.dot}>·</Text>
              <Pressable onPress={tx.retry} hitSlop={6}>
                <Text style={styles.txLink}>{t('reviews.retry')}</Text>
              </Pressable>
            </View>
          ) : tx.showingTranslated ? (
            <View style={styles.txInline}>
              <Text style={styles.txMuted}>{t('reviews.translatedFrom', { lang: langName })}</Text>
              <Text style={styles.dot}>·</Text>
              <Pressable onPress={tx.showOriginal} hitSlop={6}>
                <Text style={styles.txLink}>{t('reviews.showOriginal')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.txInline} onPress={tx.translate} hitSlop={6}>
              <IconGlobe size={14} color={C.accent} />
              <Text style={styles.txLink}>{t('reviews.translate')}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* P-095: 장소 한 줄(핀+이름 — 태그 있을 때만) */}
      {/* P-116: 장소 한 줄 — placeTagsEnabled 숨김(KB-274 대기) */}
      {FLAGS.placeTagsEnabled && review.place && (
        <View style={styles.placeLine}>
          <IconMapPin size={12} color={C.ink3} />
          <Text style={styles.placeLineText} numberOfLines={1}>{review.place.name}</Text>
        </View>
      )}
      <View style={styles.itemFoot}>
        <Text style={styles.when}>{relativeDate(review.createdAt, t)}</Text>
        <View style={styles.itemFootRight}>
          {/* P-196: Helpful = 공용 단일 경유(HelpfulButton) — 표면별 배선 금지 */}
          <HelpfulButton review={review} mine={mine} foodId={foodId} t={t} />
        </View>
      </View>
    </View>
  );
}

function relativeDate(iso: string, t: TFn): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return t('reviews.today');
  if (days < 7) return t('reviews.daysAgo', { count: days });
  return t('reviews.weeksAgo', { count: Math.floor(days / 7) });
}

function Switch({ on }: { on: boolean }) {
  return (
    <View style={[styles.sw, on && styles.swOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 4, gap: 16 },

  emptyFill: { flex: 1, justifyContent: 'center' },
  // KB-84 게스트 lock-pop
  lockPop: { position: 'absolute', left: 12, right: 12, top: 24, alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 18, ...shadow.sh2 },
  lockPopIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  lockPopTitle: { fontFamily: font.bodyBold, fontSize: 15, color: C.ink, textAlign: 'center' },
  lockPopSub: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, textAlign: 'center', lineHeight: 18 },
  lockPopBtn: { backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
  lockPopBtnText: { fontFamily: font.bodyBold, fontSize: 13.5, color: '#fff' },

  // KB-431 §2-2: 음식 요약 카드
  dishCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: C.line2, borderRadius: radius.sm, padding: 8 },
  dishThumb: { width: 48, height: 48, borderRadius: 4, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dishName: { fontSize: 14, fontWeight: '600', color: C.ink },
  dishSub: { fontSize: 13, fontWeight: '400', color: C.ink3 },

  // KB-431 §2-3: 평점 요약 박스
  summaryBox: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: radius.sm, padding: 16, gap: 29 },
  summaryLeft: { flex: 1, gap: 6, justifyContent: 'center' },
  bigScore: { fontSize: 34, fontWeight: '700', color: C.ink, lineHeight: 42 },
  bigScoreOf: { fontSize: 20, fontWeight: '400', color: C.inkMute },
  overallLbl: { fontSize: 13, fontWeight: '500', color: C.ink3 },
  axisCol: { alignItems: 'center', gap: 5 },
  axisBadge: { width: 34, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  axisBadgeTop: { backgroundColor: '#2F3137' },
  axisBadgeRest: { backgroundColor: C.inkDisabled },
  axisBadgeText: { fontSize: 12, fontWeight: '600', color: '#2F3137' },
  axisTrack: { width: 8, height: 46, borderRadius: 4, backgroundColor: C.hair, justifyContent: 'flex-end', overflow: 'hidden' },
  axisFill: { width: 8, borderRadius: 4 },
  axisFillTop: { backgroundColor: '#2F3137' },
  axisFillRest: { backgroundColor: C.inkDisabled },
  axisLbl: { fontSize: 10, fontWeight: '500', color: C.ink3 },
  summaryRight: { flexDirection: 'row', gap: 13, alignItems: 'flex-end' },

  // KB-431 §2-4: 컨트롤 행
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  filterLbl: { flexShrink: 1, fontSize: 14, fontWeight: '500', color: C.ink },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2F3F6', borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 8 },
  sortLabel: { fontSize: 14, fontWeight: '700', color: C.ink2 },

  // 시안 Button/Toggle md 44×24 — off 트랙 #D1D3D8 / on 트랙 primary, 노브 20 흰
  sw: { width: 44, height: 24, borderRadius: 12, backgroundColor: C.inkDisabled, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', ...shadow.sh1 },
  knobOn: { alignSelf: 'flex-end' },

  item: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 14, gap: 8, ...shadow.sh1 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  itemPressed: { opacity: 0.75 },
  placeLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  placeLineText: { fontFamily: font.body, fontSize: 12, color: C.ink2, flexShrink: 1 },
  itemFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemFootRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  likeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  photoStrip: { flexDirection: 'row', gap: 8 },
  photo: { width: 84, height: 84, borderRadius: 10, backgroundColor: C.surface2 },
  // P-158 ②: i18n 가변 길이 내성 — 이름만 말줄임(shrink), 필·별점은 고정폭(겹침 0)
  who: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, marginRight: 8 },
  anonAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  whoName: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink, flexShrink: 1 },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0 },
  rankText: { fontFamily: font.bodyBold, fontSize: 11, color: C.ink2 },
  reviewBody: { fontFamily: font.body, fontSize: 14, color: C.ink, lineHeight: 20 },
  reviewBodyKo: { fontFamily: font.ko },
  txRow: { flexDirection: 'row', alignItems: 'center' },
  txInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txLink: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.accent },
  txMuted: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  txError: { fontFamily: font.body, fontSize: 12, color: C.riskDanger },
  dot: { fontFamily: font.body, fontSize: 12, color: C.ink3 },
  when: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  // P-085 keyset 더보기
  loadMore: { alignItems: 'center', paddingVertical: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12 },
  loadMoreText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2 },
});
