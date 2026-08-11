/**
 * Review detail (KB-85 내 리뷰 조회 → P-095/KB-257 D-08 범용 디테일).
 *
 * 목록 행 탭·프로필 내 리뷰에서 진입. 작성자 행(아바타·이름·랭킹 필·시간·⋯) ·
 * 정수 별점+n/5 · 본문 · 사진 3장 스와이프 캐러셀(카운트+도트) · 좋아요(하트
 * 채움 전환 — 목, 정렬 미반영 캡션) · 장소 섹션(태그 있을 때만 — 3사 지도
 * 중립 글리프 딥링크). ⋯ = 공용 ActionSheet('context') — 내 것 Edit(인라인
 * 편집)/Delete, 남의 것 Report/Block(**리뷰발 차단 = 리스트 복귀 + 재조회**).
 * 데이터 = 목/봉인 경로 그대로(P-086) — 좋아요·장소는 목 전용(스왑 주석 참조).
 */
import { useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow, type RiskState } from '@/lib/theme';
import {
  SubHeader,
  Btn,
  Flag,
  MedalEmblem,
  Star,
  Stars,
  RiskMark,
  IconCheck,
  IconChevron,
  IconMapPin,
  IconMore,
  IconProfile, Input } from '@/components';
import { useMe, useMyReviews } from '@/lib/data/useMe';
import { useFoodReviews } from '@/lib/data/useFoodReviews';
import { useFoods } from '@/lib/data/useFoods';
import { useDeleteReview, useToggleReviewLike, useUpdateReview } from '@/lib/data/useReviewMutations';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { QueryErrorBlock } from '@/components/StateBlock';
import { personalRisk } from '@/lib/risk';
import { ModerationFlow, type ModTarget } from '@/features/community/moderation';
import { openMap, type MapApp } from '@/features/community/tagSheets';
import type { Review } from '@/lib/api/types';

const MAX = 1000; // P-085: 계약 확정값

export default function ReviewDetail() {
  // KB-148: 리뷰 MVP 제외 이력 — 딥링크/백스택 방어 (플래그 켜면 no-op)
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;

  const { id, foodId } = useLocalSearchParams<{ id: string; foodId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const { data: myReviews, error: myReviewsError, refetch: refetchMyReviews } = useMyReviews(); // P-164
  const foodReviewsQ = useFoodReviews(foodId ?? '');
  const { data: foods } = useFoods();
  const { data: me } = useMe();
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();
  const toggleLike = useToggleReviewLike();

  // 조회: 내 리뷰 우선(mine 판별 겸) → 목록 진입이면 음식 리뷰 캐시
  const mine = (myReviews ?? []).find((r) => r.id === id);
  const fromList = (foodReviewsQ.data?.pages ?? []).flatMap((p) => p.items).find((r) => r.id === id);
  const review: Review | undefined = mine ?? fromList;
  const isMine = mine != null;

  const food = foods?.find((f) => f.foodId === review?.foodId);
  const hasR = (me?.restrictions.length ?? 0) > 0;
  const labels = (t('review.labels', { returnObjects: true }) as string[]) ?? [];

  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [mod, setMod] = useState<ModTarget | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const isGuest = useIsGuest();
  const carouselW = useRef(width - 36); // body padding 18×2

  function startEdit() {
    if (!review) return;
    setRating(review.rating);
    setBody(review.body ?? '');
    setEditing(true);
  }

  // P-085: PATCH 풀 페이로드(buildReviewUpdate — 생략=제거 함정 봉쇄) / 목은 캐시
  function save() {
    if (!review || updateReview.isPending) return;
    updateReview.mutate(
      { reviewId: review.id, foodId: review.foodId, current: review, changes: { rating, body } },
      { onSuccess: () => setEditing(false), onError: () => Alert.alert(t('review.postError')) },
    );
  }

  function confirmDelete() {
    if (!review) return;
    Alert.alert(t('editReview.deleteConfirmTitle'), t('editReview.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('editReview.delete'),
        style: 'destructive',
        onPress: () =>
          deleteReview.isPending
            ? undefined
            : deleteReview.mutate(
            { reviewId: review.id, foodId: review.foodId },
            { onSuccess: () => router.back(), onError: () => Alert.alert(t('review.deleteError')) }, // KC-0302 B
          ),
      },
    ]);
  }

  const openMenu = () => {
    if (!review) return;
    setMod({
      type: 'review',
      id: review.id,
      author: {
        id: review.author?.memberId ?? review.memberId ?? `rv-${review.id}`,
        nickname: review.author?.nickname ?? null,
        nationality: review.authorNationality,
      },
      mine: isMine,
    });
  };

  if (isGuest) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('editReview.viewTitle')} onBack={() => router.back()} />
        <AuthGateSheet context="profile" open onClose={() => router.back()} />
      </View>
    );
  }

  // P-164: 캐시 미발견이 "로드 실패" 때문이면 not-found 위장 금지 — 공용 에러(+재시도)
  if (!review && (myReviewsError || foodReviewsQ.isError)) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('editReview.viewTitle')} onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <QueryErrorBlock
            error={myReviewsError ?? foodReviewsQ.error}
            onRetry={() => {
              void refetchMyReviews();
              void foodReviewsQ.refetch();
            }}
            onGoBack={() => router.back()}
          />
        </View>
      </View>
    );
  }

  if (!review) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('editReview.viewTitle')} onBack={() => router.back()} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>{t('editReview.notFound')}</Text>
        </View>
      </View>
    );
  }

  const risk: RiskState = food ? personalRisk(food.risk, hasR) : 'unable';
  const posted = t('editReview.posted', { when: relativeDate(review.createdAt, t) });
  const authorLabel = review.anonymized
    ? t('reviews.anonymous')
    : (review.author?.nickname ?? review.authorNationality ?? t('reviews.anonymous'));
  const photos = review.photos ?? [];

  return (
    <View style={styles.root}>
      <SubHeader
        title={editing ? t('editReview.title') : t('editReview.viewTitle')}
        onBack={editing ? () => setEditing(false) : () => router.back()}
        trailing={
          editing ? (
            <Pressable onPress={save} hitSlop={8}>
              <Text style={styles.saveLink}>{t('common.save')}</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* 작성자 행 — 아바타(국기/중립)·이름·랭킹 필·시간·⋯ (D-08) */}
        {!editing && (
          <View style={styles.authorRow}>
            {review.anonymized || !review.authorNationality ? (
              <View style={styles.anonAvatar}>
                <IconProfile size={16} color={C.ink3} />
              </View>
            ) : (
              <Flag code={review.authorNationality} size={28} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {authorLabel}
                </Text>
                {!review.anonymized && !!review.authorRankTier && (
                  <View style={styles.rankPill}>
                    <MedalEmblem level={review.author?.level ?? 1} size={14} />
                    <Text style={styles.rankText}>{review.authorRankTier}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.when}>{posted}</Text>
            </View>
            <Pressable hitSlop={10} onPress={openMenu}>
              <IconMore size={18} color={C.ink3} />
            </Pressable>
          </View>
        )}

        {/* dish chip — 조회 시 탭하면 음식 상세 */}
        {editing ? (
          <View style={styles.foodChip}>
            <View style={styles.foodPh} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.foodName} numberOfLines={1}>{food?.name ?? review.foodId}</Text>
              {!!food?.nameKo && food.nameKo !== food.name && <Text style={styles.foodKo}>{food.nameKo}</Text>}
            </View>
            <RiskMark state={risk} size={22} />
          </View>
        ) : (
          <Pressable style={styles.foodChip} onPress={() => router.push(`/food/${review.foodId}` as Href)}>
            <View style={styles.foodPh} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.foodName} numberOfLines={1}>{food?.name ?? review.foodId}</Text>
              {!!food?.nameKo && food.nameKo !== food.name && <Text style={styles.foodKo}>{food.nameKo}</Text>}
            </View>
            <RiskMark state={risk} size={22} />
            <IconChevron size={16} color={C.ink3} />
          </Pressable>
        )}

        {editing ? (
          <>
            {/* rating — editable */}
            <View style={styles.block}>
              <Text style={styles.label}>{t('review.ratingLabel')}</Text>
              <View style={styles.starPick}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Pressable key={i} onPress={() => setRating(i)} hitSlop={4}>
                    <Star size={44} fillPct={i <= rating ? 100 : 0} fillColor={C.primary} />
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.starCap, !rating && styles.starCapEmpty]}>
                {rating ? t('review.ratingValue', { value: rating, label: labels[rating] ?? '' }) : t('review.tapToRate')}
              </Text>
            </View>
            <View style={styles.block}>
              <Text style={styles.label}>{t('review.reviewLabel')}</Text>
              <Input
                value={body}
                onChangeText={(v) => setBody(v.slice(0, MAX))}
                placeholder={t('review.placeholder')}
                placeholderTextColor={C.ink3}
                multiline
                style={styles.textarea}
                textAlignVertical="top"
              />
              <View style={styles.metaRow}>
                <Text style={styles.tag}>{posted}</Text>
                <Text style={styles.tag}>{t('review.charCount', { count: body.length })}</Text>
              </View>
            </View>
            <View style={{ marginTop: 4, gap: 10 }}>
              <Btn icon={<IconCheck size={17} color="#fff" />} onPress={save}>
                {t('editReview.save')}
              </Btn>
              <Pressable style={styles.ghostRow} onPress={() => setEditing(false)}>
                <Text style={styles.ghostText}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {/* rating — 정수 별점 + n/5 (D-08) */}
            <View style={styles.ratingRow}>
              <Stars value={review.rating} size={22} />
              <Text style={styles.ratingScore}>{t('review.ratingOutOf', { value: review.rating })}</Text>
            </View>

            {review.body ? (
              <Text style={styles.bodyText}>{review.body}</Text>
            ) : (
              <Text style={styles.bodyEmpty}>{t('editReview.noBody')}</Text>
            )}

            {/* 사진 캐러셀 — 스와이프 + 카운트/도트 (D-08) */}
            {photos.length > 0 && (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) =>
                    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / carouselW.current))
                  }
                >
                  {photos.map((uri) => (
                    <Image key={uri} source={{ uri }} style={[styles.carouselPhoto, { width: carouselW.current }]} />
                  ))}
                </ScrollView>
                {photos.length > 1 && (
                  <>
                    <View style={styles.photoCount}>
                      <Text style={styles.photoCountText}>{`${photoIndex + 1}/${photos.length}`}</Text>
                    </View>
                    <View style={styles.dots}>
                      {photos.map((_, i) => (
                        <View key={i} style={[styles.dot, i === photoIndex && styles.dotOn]} />
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* P-169 ⑤: Helpful (n) 텍스트 버튼 — 하트 소멸(같은 좋아요 API, 상태 전환은 색만) */}
            <View style={styles.likeBlock}>
              <Pressable
                style={styles.likeBtn}
                hitSlop={8}
                onPress={() => toggleLike.mutate({ reviewId: review.id, foodId: review.foodId })}
                testID="helpful-toggle"
              >
                <Text style={[styles.likeCount, review.myLike && styles.likeCountOn]}>
                  {t('reviews.helpful', { count: review.likes ?? 0 })}
                </Text>
              </Pressable>
            </View>

            {/* 장소 섹션 — 태그 있을 때만 (D-08, 3사 지도 중립 글리프) */}
            {/* P-116: 장소 섹션 — placeTagsEnabled 숨김(KB-274 대기) */}
            {FLAGS.placeTagsEnabled && review.place && (
              <View style={styles.placeCard}>
                <View style={styles.placeTop}>
                  <View style={styles.placeIc}>
                    <IconMapPin size={17} color={C.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.placeName} numberOfLines={1}>{review.place.name}</Text>
                    <Text style={styles.placeAddr} numberOfLines={2}>{review.place.roadAddress}</Text>
                  </View>
                </View>
                <View style={styles.mapRow}>
                  {(['naver', 'kakao', 'google'] as MapApp[]).map((kind) => (
                    <Pressable key={kind} style={styles.mapBtn} onPress={() => review.place && void openMap(kind, review.place)}>
                      <IconMapPin size={15} color={C.ink2} />
                      <Text style={styles.mapBtnText}>{t(`community.map.${kind}`)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ⋯ — 공용 ActionSheet: 내 것 Edit/Delete · 남의 것 Report/Block */}
      <ModerationFlow
        target={mod}
        onClose={() => setMod(null)}
        onEdit={() => startEdit()}
        onDelete={() => confirmDelete()}
        onBlocked={() => {
          // 리뷰발 차단 = 리스트 복귀 + 재조회 (확정 정책) — 차단 유저 필터는
          // BE 몫(실연결 시), 목 단계는 재조회 시맨틱만 유지
          void qc.invalidateQueries({ queryKey: ['food', review.foodId, 'reviews'] });
          void qc.invalidateQueries({ queryKey: ['me', 'reviews'] });
          router.back();
        }}
      />
    </View>
  );
}

type TFn = ReturnType<typeof useTranslation>['t'];
function relativeDate(iso: string, t: TFn): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return t('reviews.today');
  if (days < 7) return t('reviews.daysAgo', { count: days });
  return t('reviews.weeksAgo', { count: Math.floor(days / 7) });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { padding: 18, gap: 16 },
  saveLink: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary, marginRight: 8 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  anonAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  authorName: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink, flexShrink: 1 },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2.5 },
  rankText: { fontFamily: font.bodyBold, fontSize: 10.5, color: C.ink2 },
  when: { fontFamily: font.body, fontSize: 11.5, color: C.ink3, marginTop: 1 },

  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12, ...shadow.sh1 },
  foodPh: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface2 },
  foodName: { fontFamily: font.display, fontSize: 15.5, color: C.ink },
  foodKo: { fontFamily: font.ko, fontSize: 12, color: C.ink2, marginTop: 1 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  ratingScore: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink2 },
  bodyText: { fontFamily: font.body, fontSize: 14.5, color: C.ink, lineHeight: 22 },
  bodyEmpty: { fontFamily: font.body, fontSize: 14, color: C.ink3, fontStyle: 'italic' },

  carouselPhoto: { aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: C.surface2 },
  photoCount: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  photoCountText: { fontFamily: font.bodyBold, fontSize: 11, color: '#fff' },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.line },
  dotOn: { backgroundColor: C.primary },

  likeBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  likeCount: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 },
  likeCountOn: { color: C.primaryText },
  likeCaption: { flex: 1, fontFamily: font.body, fontSize: 11.5, color: C.ink3 },

  placeCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 13, gap: 11, ...shadow.sh1 },
  placeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeIc: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(14,154,167,0.1)', alignItems: 'center', justifyContent: 'center' },
  placeName: { fontFamily: font.bodyBold, fontSize: 14, color: C.ink },
  placeAddr: { fontFamily: font.body, fontSize: 12, color: C.ink2, marginTop: 1 },
  mapRow: { flexDirection: 'row', gap: 8 },
  mapBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 9 },
  mapBtnText: { fontFamily: font.bodyBold, fontSize: 11.5, color: C.ink },

  block: { gap: 12 },
  label: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  starPick: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 4 },
  starCap: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary, textAlign: 'center' },
  starCapEmpty: { color: C.ink3 },
  textarea: { minHeight: 120, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, padding: 14, fontFamily: font.body, fontSize: 14.5, color: C.ink, lineHeight: 21, ...shadow.sh1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tag: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  ghostRow: { alignItems: 'center', paddingVertical: 12 },
  ghostText: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink2 },

  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  missingText: { fontFamily: font.body, fontSize: 14, color: C.ink2, textAlign: 'center' },
});
