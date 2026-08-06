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
import { color as C, font, radius, shadow } from '@/lib/theme';
import {
  StickyHeader,
  useStickyScroll,
  useHeaderHeight,
  Stars,
  Flag,
  Rosette,
  StateBlock,
  stateIconColor,
  Spinner,
  IconGlobe,
  IconProfile,
  IconBubbleEmpty,
  IconPlus,
  IconChevron,
  IconHeart,
  IconMapPin,
  IconMore,
} from '@/components';
import { useFoodReviews } from '@/lib/data/useFoodReviews';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet, type GateContext } from '@/components/AuthGateSheet';
import { IconLock } from '@/components/icons';
import { useReviewTranslation } from '@/lib/data/useReviewTranslation';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { useDeleteReview } from '@/lib/data/useReviewMutations';
import type { RatingAggregate, Review } from '@/lib/api/types';

const READER_LANG = 'en'; // MVP reader language

export default function FoodReviews() {
  // KB-148: 리뷰 MVP 제외 — 진입점이 없어도 딥링크/백스택으로 도달 가능하니 홈으로.
  // FLAGS는 컴파일 상수라 훅 순서에 영향 없음 (플래그 켜면 이 가드는 no-op)
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;

  const isGuest = useIsGuest();
  const [gateOpen, setGateOpen] = useState<GateContext | null>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { onScroll, hidden } = useStickyScroll();
  const headerH = useHeaderHeight();

  const { data: food } = useFoodDetail(id ?? '');
  const { data: me } = useMe();
  const deleteReview = useDeleteReview();

  const [sameNatOnly, setSameNatOnly] = useState(false);
  const [sort, setSort] = useState<'recent' | 'rating'>('recent');

  const nationality = me?.nationality ?? 'US';
  // P-085(KB-73): 같은 국적 필터 = 서버 countryCode 파라미터 (목 경로는 훅이 흉내).
  // keyset 커서 — 페이지 평탄화 + 하단 더보기(fetchNextPage).
  const reviewsQ = useFoodReviews(id ?? '', sameNatOnly ? nationality : undefined);
  const loaded = reviewsQ.data != null;
  const all = reviewsQ.data?.pages.flatMap((p) => p.items) ?? [];
  const items = [...all].sort((a, b) => {
    const recent = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return sort === 'rating' ? b.rating - a.rating || recent : recent;
  });
  // 평점 집계 = 음식 상세 서버값 (P-085 — 목 재계산·리스트 응답 집계 폐기)
  const overall = food?.overall ?? { average: null, count: 0 };
  const sameNat = food?.sameNationality ?? { average: null, count: 0 };
  // P-085: 내 리뷰 판별 = 서버 memberId (목 시절 내 리뷰 캐시 id 집합 폐기)
  const isMine = (r: Review) => r.memberId != null && r.memberId === me?.id;
  // P-095: 행 ⋯ → 공용 ModerationFlow (내 것 Edit/Delete·남 Report/Block)
  const [mod, setMod] = React.useState<ModTarget | null>(null);
  const openDetail = (r: Review) => router.push(`/review/${r.id}?foodId=${id}` as Href);
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
        {/* 게스트는 리뷰 개수와 무관하게 항상 잠금 (실기기 반려분 #3) —
            빈 상태(쓰기 CTA 포함)는 회원에게만 */}
        {loaded && (!isGuest && all.length === 0 && !sameNatOnly ? (
          // No reviews at all → drop the dish header/summary/filter/sort; the
          // empty state owns the whole screen, vertically centered.
          <View style={styles.emptyFill}>
            <StateBlock
              icon={<IconBubbleEmpty size={38} color={stateIconColor.default} />}
              title={t('reviews.emptyTitle')}
              body={t('reviews.emptyBody')}
              primary={{
                label: t('reviews.writeReview'),
                icon: <IconPlus size={17} color="#fff" />,
                onPress: () => router.push(`/food/${id}/review` as Href),
              }}
            />
          </View>
        ) : (
          <View style={styles.body}>
            {/* dish header */}
            <View>
              <Text style={styles.dishName}>{food?.name ?? ''}</Text>
              <Text style={styles.dishSub}>
                {food?.nameKo && food.nameKo !== food.name ? `${food.nameKo} · ` : ''}
                {t('reviews.subtitle', { count: overall.count })}
              </Text>
            </View>

            {/* rating summary — P-085: 서버 집계(음식 상세 averageRating 계열) */}
            <View style={styles.summary}>
              <RateCol label={t('reviews.overall')} agg={overall} />
              <View style={styles.divider} />
              <RateCol
                label={t('reviews.sameNationality')}
                agg={sameNat}
                left={<Flag code={nationality} size={14} />}
              />
            </View>

            {isGuest ? (
              /* KB-84: 게스트 — 요약(위)은 공개, 본문 리스트는 블러 고스트 +
                 lock CTA → 게이트 시트 (guest-access-policy §1) */
              <View>
                {/* 리뷰 0건이어도 lock-pop이 뜰 공간 확보 (게스트에겐 빈 상태 없음) */}
                <View pointerEvents="none" style={{ opacity: 0.3, gap: 12, minHeight: 180 }}>
                  {items.slice(0, 3).map((r) => (
                    <ReviewItem key={r.id} review={r} t={t} />
                  ))}
                </View>
                <View style={styles.lockPop}>
                  <View style={styles.lockPopIc}>
                    <IconLock size={20} color={C.ink2} />
                  </View>
                  <Text style={styles.lockPopTitle}>{t('lock.reviewsLocked')}</Text>
                  <Text style={styles.lockPopSub}>{t('gate.reviewsSub')}</Text>
                  <Pressable style={styles.lockPopBtn} onPress={() => setGateOpen('reviews')}>
                    <Text style={styles.lockPopBtnText}>{t('intro.signUp')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
            <>
            {/* controls — same-nationality filter + sort (translation is per-review) */}
            <View style={styles.filters}>
              <Pressable style={styles.filter} onPress={() => setSameNatOnly((v) => !v)}>
                <Flag code={nationality} size={16} />
                <Text style={styles.filterLbl} numberOfLines={1}>
                  {t('reviews.sameNationalityOnly', { country: nationality })}
                </Text>
                <Switch on={sameNatOnly} />
              </Pressable>
            </View>
            <View style={styles.sortRow}>
              <SortPill label={t('reviews.sortRecent')} on={sort === 'recent'} onPress={() => setSort('recent')} />
              <SortPill label={t('reviews.sortTopRated')} on={sort === 'rating'} onPress={() => setSort('rating')} />
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
                  onPress: () => router.push(`/food/${id}/review` as Href),
                }}
              />
            ) : (
              <View style={{ gap: 12 }}>
                {items.map((r) => (
                  <ReviewItem key={r.id} review={r} t={t} onOpen={() => openDetail(r)} onMore={() => openMenu(r)} />
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
      {/* P-095: 리뷰 ⋯ — 목록발 차단 = 재조회(무효화는 훅), 편집은 디테일로 */}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={(m) => router.push(`/review/${m.id}?foodId=${id}` as Href)}
        onDelete={(m) => deleteReview.mutate({ reviewId: m.id, foodId: id ?? '' })}
        onBlocked={() => void reviewsQ.refetch()}
      />
      <AuthGateSheet context={gateOpen ?? 'reviews'} open={gateOpen != null} onClose={() => setGateOpen(null)} />
    </View>
  );
}

type TFn = ReturnType<typeof useTranslation>['t'];

function RateCol({ label, agg, left }: { label: string; agg: RatingAggregate; left?: React.ReactNode }) {
  return (
    <View style={styles.rateCol}>
      <View style={styles.rateLblRow}>
        {left}
        <Text style={styles.rateLbl}>{label}</Text>
      </View>
      <Text style={styles.rateNum}>{agg.average?.toFixed(1) ?? '—'}</Text>
      <Stars value={agg.average ?? 0} size={14} />
      {/* P-085: sameCountry는 계약에 count 미제공(0 고정) — 0이면 표기 생략 */}
      {agg.count > 0 && <Text style={styles.rateCount}>{agg.count}</Text>}
    </View>
  );
}

function ReviewItem({ review, t, onOpen, onMore }: { review: Review; t: TFn; onOpen?: () => void; onMore?: () => void }) {
  // P-085 author 방어 3케이스: ① author null(탈퇴)=익명 ② nickname null(미설정)
  // → 국적 코드 폴백 ③ countryCode null(미보유) → 국기 대신 중립 아바타.
  const anon = review.anonymized;
  const name = anon ? t('reviews.anonymous') : (review.author?.nickname ?? review.authorNationality ?? t('reviews.anonymous'));
  const tx = useReviewTranslation(review, READER_LANG);
  const langName = t(`reviews.lang.${tx.fromLang}`, { defaultValue: tx.fromLang });

  return (
    <Pressable style={({ pressed }) => [styles.item, pressed && onOpen != null && styles.itemPressed]} onPress={onOpen} disabled={!onOpen}>
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
              <Rosette level={review.author?.level ?? 1} size={15} />
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

      {/* P-077: 첨부 사진(최대 3) — 목 단계는 로컬 URI */}
      {!!review.photos?.length && (
        <View style={styles.photoStrip}>
          {review.photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.photo} />
          ))}
        </View>
      )}

      {!!tx.text && (
        <Text style={[styles.reviewBody, review.bodyLanguage === 'ko' && styles.reviewBodyKo]}>{tx.text}</Text>
      )}

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
          {(review.likes ?? 0) > 0 && (
            <View style={styles.likeMeta}>
              <IconHeart size={12} color={C.ink3} />
              <Text style={styles.likeMetaText}>{review.likes}</Text>
            </View>
          )}
          {onOpen && <IconChevron size={14} color={C.ink3} />}
        </View>
      </View>
    </Pressable>
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

function SortPill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.sortPill, on && styles.sortPillOn]} onPress={onPress}>
      <Text style={[styles.sortPillText, on && styles.sortPillTextOn]}>{label}</Text>
    </Pressable>
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

  dishName: { fontFamily: font.display, fontSize: 22, color: C.ink },
  dishSub: { fontFamily: font.ko, fontSize: 13, color: C.ink2, marginTop: 3 },

  summary: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, padding: 16, ...shadow.sh1 },
  rateCol: { flex: 1, alignItems: 'center', gap: 4 },
  rateLblRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rateLbl: { fontFamily: font.body, fontSize: 11, letterSpacing: 0.3, color: C.ink3, textTransform: 'uppercase' },
  rateNum: { fontFamily: font.displayBlack, fontSize: 32, color: C.ink, lineHeight: 42 },
  rateCount: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  divider: { width: 1, backgroundColor: C.hair, marginHorizontal: 6 },

  filters: { flexDirection: 'row', gap: 10 },
  filter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, ...shadow.sh1 },
  filterLbl: { flex: 1, fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink },
  sortRow: { flexDirection: 'row', gap: 6, backgroundColor: C.surface2, borderRadius: 12, padding: 4 },
  sortPill: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  sortPillOn: { backgroundColor: C.card, ...shadow.sh1 },
  sortPillText: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 },
  sortPillTextOn: { color: C.primary },

  sw: { width: 34, height: 20, borderRadius: 10, backgroundColor: C.line, padding: 2, justifyContent: 'center' },
  swOn: { backgroundColor: C.primary },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },

  item: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 14, gap: 8, ...shadow.sh1 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemPressed: { opacity: 0.75 },
  placeLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  placeLineText: { fontFamily: font.body, fontSize: 12, color: C.ink2, flexShrink: 1 },
  itemFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemFootRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  likeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeMetaText: { fontFamily: font.bodyBold, fontSize: 11.5, color: C.ink3 },
  photoStrip: { flexDirection: 'row', gap: 8 },
  photo: { width: 84, height: 84, borderRadius: 10, backgroundColor: C.surface2 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  anonAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  whoName: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
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
