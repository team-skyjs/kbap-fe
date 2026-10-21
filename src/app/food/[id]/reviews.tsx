/**
 * Food reviews (mockup Screen G2, FR-023) — reviews for one dish with a
 * same-nationality filter and a translate (original ↔ reader-language) toggle.
 * Reached from the detail rating cards. No risk rendering here.
 *
 * Anonymized reviews hide author identity (nationality/name). Scroll-aware back
 * header (§6); no emoji (SVG); reader text via i18n (English only for MVP).
 */
// ⚠️ KB-602 래칫 기록(2026-09-21): 아래 `FLAGS.*` early return이 **훅 호출보다 위**에 있다 —
// `react-hooks/rules-of-hooks`가 이 파일에서 위반으로 잡는다(현재 warn으로 내려둔 상태).
// 지금 안전한 이유는 **FLAGS가 빌드 상수**라 한 빌드 안에서 분기가 고정된다는 것 하나뿐이다.
// 플래그가 런타임 값(원격 컨피그·A/B 등)이 되는 순간 훅 순서가 깨진다. 소진 발주(KB-603~)에서
// early return을 훅 아래로 내리거나 래퍼 컴포넌트로 분리할 것.
import * as React from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { TopToastHost } from '@/components/TopToast';
import Animated from 'react-native-reanimated';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { EVENTS, track } from '@/lib/analytics';
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  Btn,
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  QueryErrorBlock,
  Spinner,
  IconBubbleEmpty,
  IconCheck,
  IconChevronDown,
  CardPhoto,
} from '@/components';
import { EmptyBlock, ScreenCenterFill } from '@/components/StateBlock';
import { ActionSheet } from '@/components/ActionSheet';
import { useFoodReviews } from '@/lib/data/useFoodReviews';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useIsFoodHidden } from '@/lib/data/hiddenFoods';
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { useBlockedUsers } from '@/lib/community/hooks';
import { FeedCard } from '@/features/review/FeedCard';
import { RatingSummaryBox, serverAxes } from '@/features/review/RatingSummaryBox';
import { useDeleteReview } from '@/lib/data/useReviewMutations';
import type { Review } from '@/lib/api/types';


export default function FoodReviews() {
  // KB-148: 리뷰 MVP 제외 — 진입점이 없어도 딥링크/백스택으로 도달 가능하니 홈으로.
  // ⚠️ 가드는 **훅 없는 바깥 컴포넌트**에 둔다(KB-626 — review.tsx KB-620과 같은 처리). 전엔 모든 훅
  // 앞에 early return이 있었다: FLAGS가 컴파일 상수라 런타임 순서는 안 바뀌지만 린터는 rules-of-hooks로
  // 잡고 React Compiler도 최적화하지 못한다. 분리하면 규칙이 구조적으로 선다.
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;
  return <FoodReviewsScreen />;
}

function FoodReviewsScreen() {
  const isGuest = useIsGuest();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { onScroll, hidden, atTop } = useStickyScroll();
  const headerH = useHeaderHeight();

  const { data: food } = useFoodDetail(id ?? '');
  const writeReview = () => {
    // P-392(KB-584): 자격 게이트 폐기 — 회원이면 스캔 여부 무관
    track(EVENTS.review_write_tap, { source: 'list' });
    router.push(`/food/${id}/review` as Href);
  };
  const { data: me } = useMe();
  const deleteReview = useDeleteReview();

  const [sameNatOnly, setSameNatOnly] = useState(false);
  const [sort, setSort] = useState<'recent' | 'rating'>('recent');
  const [sortSheet, setSortSheet] = useState(false); // KB-431 §2-4: 드롭다운 → ActionSheet

  // P-323(KB-448): 'US' 폴백 폐기 — 국적 미상(게스트·구계정 null)이면 토글 자체가
  // 무의미해 미렌더(게이트 아님). null이면 sameNatOnly는 false로 남는다.
  const nationality = me?.nationality ?? null;
  // P-085(KB-73): 같은 국적 필터 = 서버 countryCode 파라미터 (목 경로는 훅이 흉내).
  // keyset 커서 — 페이지 평탄화 + 하단 더보기(fetchNextPage).
  const reviewsQ = useFoodReviews(id ?? '', sameNatOnly && nationality ? nationality : undefined);
  const loaded = reviewsQ.data != null;
  // KB-626: 서버가 이 음식을 **지금** 거부했는가(FOOD-001 — 상세·리뷰 목록·북마크 어느 원천이든). 원천이 거부를
  // 받은 자리에서 세운 신호(hiddenFoods) **하나**로 판정한다 — 이 화면의 쿼리 에러를 따로 보지 않는다
  // (Codex #185: 리뷰 에러만 보면 상세 거부 + 리뷰 캐시 신선일 때 게이트가 안 선다. 신호는 둘 다 덮는다).
  // 일반 에러와 달리 받아 둔 목록도 보이지 않게 한다 — 막는 장치는 아래 내용 분기 차단 하나.
  const foodHidden = useIsFoodHidden(id ?? '');
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
  // P-360(KB-523): KR only ON = 같은 국적 서버 집계(reviewSummary.sameCountry — 이미 매핑)
  const sameNat = food?.sameNationality ?? { average: null, count: 0 };
  const summaryAgg = sameNatOnly ? sameNat : overall;
  // KB-431 §2-3: 축 평균 — Taste = 서버 overall / Speed·Service = 서버 축 집계 부재라
  // 로드된 리뷰(값 있는 것만) 클라 평균. 무데이터 축 = null(바 미표시).
  // P-360: Taste = 토글 ON이면 같은 국적 평균(OFF = overall) · KB-848 AG3: 서버 집계 축만(상세 요약 박스와 같은 값)
  const axisAverages = serverAxes(summaryAgg.average);
  // P-085: 내 리뷰 판별 = 서버 memberId (목 시절 내 리뷰 캐시 id 집합 폐기)
  const isMine = (r: Review) => r.memberId != null && r.memberId === me?.id;
  // P-095: 행 ⋯ → 공용 ModerationFlow (내 것 Edit/Delete·남 Report/Block)
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  // P-182: 개별 디테일 소멸 — 셀 확장이 전문·사진·수정을 담당
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
      anonymized: r.anonymized === true, // Codex #100 2R: 탈퇴 = 신고만(차단 = NaN id 실버그 봉인)
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
        {foodHidden ? (
          // KB-626: 재시도 버튼·에러 계측·판정 글리프 없는 중립 안내(상세와 같은 문구). 쓰기 CTA도 없다 —
          // 아래 빈 상태 분기는 isError·all 0이라 저절로 막힌다. 뒤로는 StickyHeader(mode="back")가 맡는다.
          <ScreenCenterFill>
            <EmptyBlock label={t('detail.foodHidden')} testID="reviews-food-hidden" />
          </ScreenCenterFill>
        ) : reviewsQ.isError && all.length === 0 ? (
          <QueryErrorBlock error={reviewsQ.error} onRetry={() => void reviewsQ.refetch()} onGoBack={() => router.back()} />
        ) : null}
        {/* 게스트는 리뷰 개수와 무관하게 항상 잠금 (실기기 반려분 #3) —
            빈 상태(쓰기 CTA 포함)는 회원에게만 */}
        {/* KB-626: 숨김이면 이 분기 전체를 막는다 — 상세만 거부(리뷰 쿼리는 정상)일 때 all=[]이 되어 아래
            "첫 리뷰를 써 보세요" CTA가 뜨면 숨겨진 음식에 작성을 권하게 된다. */}
        {!foodHidden && !(reviewsQ.isError && all.length === 0) && loaded && (!isGuest && all.length === 0 && !sameNatOnly ? (
          // No reviews at all → drop the dish header/summary/filter/sort; the
          // empty state owns the whole screen, vertically centered.
          // P-359(KB-522): 구 StateBlock → 디자이너 EmptyBlock. 헤더에 쓰기 진입점이
          // 없어 CTA는 ghost 1개 유지(스캔 safeEmpty 문법 — REPORTS 기록).
          <ScreenCenterFill>
            <EmptyBlock label={t('reviews.emptyTitle')} testID="reviews-empty" />
            <Btn variant="ghost" onPress={writeReview} testID="reviews-empty-write">
              {t('reviews.writeReview')}
            </Btn>
          </ScreenCenterFill>
        ) : (
          <View style={styles.body}>
            {/* KB-431 §2-2: 음식 요약 카드 — 이미지 48 + 이름 + "ko · n reviews" */}
            <View style={styles.dishCard}>
              <View style={styles.dishThumb}>
                {food?.photoUrl ? <CardPhoto uri={food.photoUrl} borderRadius={4} /> : <IconBubbleEmpty size={20} color={C.ink3} />}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>{/* A-RL-02 */}
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
            {/* P-360: 토글 ON = 같은 국적 값·라벨 전환, 같은 국적 0건 = 박스 미렌더 */}
            {!(sameNatOnly && sameNat.count === 0) && (
              <RatingSummaryBox overall={summaryAgg} sameNat={sameNatOnly} axes={axisAverages} t={t} />
            )}

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
              {!isGuest && nationality ? (
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
              /* P-359: 필터 0건 = 통계·컨트롤 유지, 목록 자리만 EmptyBlock(CTA 없음 —
                 토글 OFF면 리뷰가 있다) */
              <View style={{ paddingVertical: 24 }}>
                <EmptyBlock label={t(sameNatOnly ? 'reviews.emptySameNat' : 'reviews.emptyBody')} testID="reviews-filter-empty" />
              </View>
            ) : (
              <View>
                {/* KB-848: 리뷰 탭과 같은 카드(FeedCard · peek) — 카드 자체 좌우 20·구분선이라 본문 패딩(20) 밖으로 꺼낸다. 자기 음식 칩은 숨김(상세 프리뷰와 같음) */}
                <View style={styles.cards}>
                  {items.map((r) => (
                    <FeedCard
                      key={r.id}
                      review={r}
                      t={t}
                      mine={isMine(r)}
                      photoVariant="peek"
                      showFood={false} /* Codex #327: extras 줄(속도·서비스) = 카드 평점 축과 같은 값이라 붙이지 않는다 */
                      onOpenFood={() => {}}
                      onGuestHelpful={() => {}} /* 게스트 Helpful = 무동작(옛 목록 그대로 — 게이트 시트 없는 화면) */
                      onMore={() => openMenu(r)} /* P-339 ②: 탈퇴 포함 전 카드 ⋯(신고만 — 차단은 플로우가 가드) */
                    />
                  ))}
                </View>
                {/* P-085: keyset 더보기 — hasNext일 때만 */}
                {reviewsQ.hasNextPage && (
                  <Pressable
                    testID="reviews-load-more"
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

      <StickyHeader hidden={hidden} atTop={atTop} mode="back" title={t('reviews.headerTitle')} onBack={() => router.back()} />
      {/* KB-431 §2-4: 정렬 시트 — 공용 ActionSheet(현 2옵션·현재값 체크) */}
      <ActionSheet
        open={sortSheet}
        testID="reviews-sort-sheet"
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
        onEdit={(m) => router.push(`/food/${id}/review?reviewId=${m.id}` as Href)} /* P-358: 편집 = 작성 화면 편집 모드 */
        onDelete={(m) => deleteReview.mutate({ reviewId: m.id, foodId: id ?? '' })}
        onBlocked={() => void reviewsQ.refetch()}
      />
      {/* P-370(KB-533): 모달 컨텍스트 토스트 호스트(스택 top — 언마운트 시 루트 복원) */}
      <TopToastHost />
    </View>
  );
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
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 9 }, // A-RL-01/03(KB-486: 카드→통계 9)

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

  // KB-431 §2-4: 컨트롤 행
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1, minWidth: 0 }, // A-RL-07
  filterLbl: { flexShrink: 1, fontSize: 14, fontWeight: '500', color: C.ink },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2F3F6', borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 8 },
  sortLabel: { fontSize: 14, fontWeight: '700', color: C.ink2 },

  // 시안 Button/Toggle md 44×24 — off 트랙 #D1D3D8 / on 트랙 primary, 노브 20 흰
  sw: { width: 44, height: 24, borderRadius: 12, backgroundColor: C.inkDisabled, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', ...shadow.sh1 },
  knobOn: { alignSelf: 'flex-end' },

  // P-158 ②: i18n 가변 길이 내성 — 이름만 말줄임(shrink), 필·별점은 고정폭(겹침 0)
  cards: { marginHorizontal: -20 }, // KB-848: FeedCard = 자체 좌우 20(리뷰 탭과 같은 폭)
  // P-085 keyset 더보기
  loadMore: { alignItems: 'center', paddingVertical: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12 },
  loadMoreText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2 },
});
