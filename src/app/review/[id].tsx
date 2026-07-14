/**
 * My review detail (KB-85) — opened by tapping a card in the My reviews list or
 * the profile tab. Read-only "조회" view by default: the reviewed dish, the
 * author's rating + written text, and the posted date. Tapping "Edit review"
 * flips the SAME screen into an inline edit form (rating picker + textarea);
 * "Delete this review" removes it.
 *
 * Data via useMyReviews() (MOCK_MODE); dish name/nameKo/risk joined from
 * useFoods() by foodId. Save/Delete mutate the React Query cache so the change
 * is reflected immediately in the list — real persistence (PATCH/DELETE review)
 * is KB-73 / BE-blocked.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow, type RiskState } from '@/lib/theme';
import { SubHeader, Btn, Star, Stars, RiskMark, IconCheck, IconEdit, IconTrash, IconChevron } from '@/components';
import { useMe, useMyReviews } from '@/lib/data/useMe';
import { useFoods } from '@/lib/data/useFoods';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { personalRisk } from '@/lib/risk';
import type { Review } from '@/lib/api/types';

const MAX = 500;

export default function ReviewDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: reviews } = useMyReviews();
  const { data: foods } = useFoods();
  const { data: me } = useMe();

  const review = (reviews ?? []).find((r) => r.id === id);
  const food = foods?.find((f) => f.foodId === review?.foodId);
  const hasR = (me?.restrictions.length ?? 0) > 0;
  const labels = (t('review.labels', { returnObjects: true }) as string[]) ?? [];

  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const isGuest = useIsGuest();

  function startEdit() {
    if (!review) return;
    setRating(review.rating);
    setBody(review.body ?? '');
    setEditing(true);
  }

  function save() {
    qc.setQueryData<Review[]>(['me', 'reviews'], (prev) =>
      (prev ?? []).map((r) => (r.id === id ? { ...r, rating, body: body.trim() || null } : r)),
    );
    setEditing(false);
  }

  function confirmDelete() {
    Alert.alert(t('editReview.deleteConfirmTitle'), t('editReview.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('editReview.delete'),
        style: 'destructive',
        onPress: () => {
          qc.setQueryData<Review[]>(['me', 'reviews'], (prev) => (prev ?? []).filter((r) => r.id !== id));
          router.back();
        },
      },
    ]);
  }

  // 라우트 자체 가드 (⑧-b) — 진입로는 프로필 경유(게이트)뿐이지만 딥링크 이중 방어.
  // 게스트는 콘텐츠(mock 포함) 미마운트, 시트 닫으면 뒤로.
  if (isGuest) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('editReview.viewTitle')} onBack={() => router.back()} />
        <AuthGateSheet context="profile" open onClose={() => router.back()} />
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
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* dish — tappable in view mode (→ food detail); static while editing */}
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
                    <Star size={44} fillPct={i <= rating ? 100 : 0} fillColor={C.primary} emptyColor={C.ink3} />
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.starCap, !rating && styles.starCapEmpty]}>
                {rating ? t('review.ratingValue', { value: rating, label: labels[rating] ?? '' }) : t('review.tapToRate')}
              </Text>
            </View>

            {/* body — editable */}
            <View style={styles.block}>
              <Text style={styles.label}>{t('review.reviewLabel')}</Text>
              <TextInput
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
            {/* rating — read-only */}
            <View style={styles.ratingView}>
              <Stars value={review.rating} size={30} />
              <Text style={styles.ratingCap}>
                {t('review.ratingValue', { value: review.rating, label: labels[review.rating] ?? '' })}
              </Text>
            </View>

            {/* body — read-only */}
            <View style={styles.bodyCard}>
              {review.body ? (
                <Text style={styles.bodyText}>{review.body}</Text>
              ) : (
                <Text style={styles.bodyEmpty}>{t('editReview.noBody')}</Text>
              )}
            </View>
            <Text style={styles.postedTag}>{posted}</Text>

            <View style={{ marginTop: 8, gap: 10 }}>
              <Btn variant="ghost" icon={<IconEdit size={17} color={C.ink} />} onPress={startEdit}>
                {t('editReview.title')}
              </Btn>
              <Pressable style={styles.delRow} onPress={confirmDelete}>
                <View style={styles.delIc}>
                  <IconTrash size={17} color={C.riskDanger} />
                </View>
                <Text style={styles.delText}>{t('editReview.delete')}</Text>
                <IconChevron size={16} color={C.riskDanger} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
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
  body: { padding: 18, gap: 20 },

  saveLink: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary, marginRight: 8 },

  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12, ...shadow.sh1 },
  foodPh: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.surface2 },
  foodName: { fontFamily: font.display, fontSize: 16, color: C.ink },
  foodKo: { fontFamily: font.ko, fontSize: 12, color: C.ink2, marginTop: 1 },

  // read-only rating
  ratingView: { alignItems: 'center', gap: 8, paddingVertical: 6 },
  ratingCap: { fontFamily: font.bodyBold, fontSize: 15, color: C.primary },

  // read-only body
  bodyCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: 13, padding: 16, ...shadow.sh1 },
  bodyText: { fontFamily: font.body, fontSize: 14.5, color: C.ink, lineHeight: 22 },
  bodyEmpty: { fontFamily: font.body, fontSize: 14, color: C.ink3, fontStyle: 'italic' },
  postedTag: { fontFamily: font.body, fontSize: 11.5, color: C.ink3, marginTop: -8 },

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

  delRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fdecea', borderWidth: 1, borderColor: '#f3cdc8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  delIc: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  delText: { flex: 1, fontFamily: font.bodyBold, fontSize: 14.5, color: C.riskDanger },

  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  missingText: { fontFamily: font.body, fontSize: 14, color: C.ink2, textAlign: 'center' },
});
