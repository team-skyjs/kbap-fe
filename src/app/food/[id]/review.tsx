/**
 * Review compose (mockup Screen H) — rate 1–5 + write a review for a dish.
 * Compose state → submitted confirmation (counts toward ranking).
 *
 * P-085(KB-73): 실연결 — 사진 presigned 업로드(purpose REVIEW) → POST /reviews,
 * 성공 시 서버 재조회(무효화)가 진실 (목 캐시 삽입 폐기). Rating required
 * (1–5 integer). No emoji; reader text i18n'd; risk colors fixed.
 */
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { SubHeader, Btn, Star, Stars, Rosette, RiskMark, IconCheck, IconClose, IconPlus } from '@/components';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { useCreateReview } from '@/lib/data/useReviewMutations';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { personalRisk } from '@/lib/risk';
import { EVENTS, track } from '@/lib/analytics';
import { addReviewPhotos, canPostReview, removeReviewPhoto, REVIEW_MAX_PHOTOS, uploadReviewImages } from '@/lib/review/reviewPhotos';

const MAX = 1000; // P-085: 계약 확정값 (구 500)

export default function ReviewCompose() {
  // KB-148: 리뷰 MVP 제외 — 진입점이 없어도 딥링크/백스택으로 도달 가능하니 홈으로.
  // FLAGS는 컴파일 상수라 훅 순서에 영향 없음 (플래그 켜면 이 가드는 no-op)
  if (!FLAGS.reviewsEnabled) return <Redirect href="/" />;

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: food } = useFoodDetail(id ?? '');
  const { data: me } = useMe();

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [postError, setPostError] = useState(false);
  const isGuest = useIsGuest();
  const createReview = useCreateReview();

  const labels = (t('review.labels', { returnObjects: true }) as string[]) ?? [];
  const canPost = canPostReview(rating) && !createReview.isPending;

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets?.length) {
      setPhotos((cur) => addReviewPhotos(cur, res.assets.map((a) => a.uri)));
    }
  };

  // P-085(KB-73): 사진 presigned 업로드(purpose REVIEW, 전송=path) → POST /reviews.
  // 성공 시 무효화(useCreateReview)가 목록·평점을 서버값으로 갱신. 실패는 화면 유지+표시.
  const post = async () => {
    if (!canPost) return;
    setPostError(false);
    try {
      const imagePaths = await uploadReviewImages(photos);
      await createReview.mutateAsync({
        foodId: id ?? '',
        rating,
        content: body.trim() || undefined,
        imagePaths,
      });
      track(EVENTS.review_submit); // P-083
      setSubmitted(true);
    } catch (e) {
      console.log('[review] post failed — staying on screen:', (e as Error)?.message);
      setPostError(true);
    }
  };

  // 라우트 자체 가드 — 작성은 회원 전용. 진입 버튼 게이트와 별개의 이중 방어
  // (딥링크/직접 라우트 포함, 실기기 반려분 #2와 동일 원칙).
  if (isGuest) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('review.title')} onBack={() => router.back()} />
        <AuthGateSheet context="writeReview" open onClose={() => router.back()} />
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('review.title')} onBack={() => router.back()} />
        <View style={styles.okWrap}>
          <View style={styles.okIc}>
            <IconCheck size={34} color="#fff" />
          </View>
          <Text style={styles.okTitle}>{t('review.postedTitle')}</Text>
          <Text style={styles.okBody}>
            {t('review.postedBody', { rating, name: food?.name ?? '' })}
          </Text>
          <View style={styles.okMeta}>
            <Stars value={rating} size={18} />
            <View style={styles.rankPill}>
              <Rosette level={me?.rank.level ?? 1} size={18} />
              <Text style={styles.rankText}>{me?.rank.tier ?? ''}</Text>
            </View>
          </View>
          <View style={{ width: '100%', marginTop: 14, gap: 9 }}>
            <Btn onPress={() => router.back()}>{t('review.backToDish')}</Btn>
            <Btn variant="ghost" onPress={() => router.replace('/profile' as Href)}>
              {t('review.seeMyReviews')}
            </Btn>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SubHeader
        title={t('review.title')}
        onBack={() => router.back()}
        trailing={
          <Pressable onPress={post} hitSlop={8} disabled={!canPost}>
            <Text style={[styles.postLink, !canPost && styles.postLinkOff]}>{t('review.post')}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* food chip */}
        <View style={styles.foodChip}>
          <View style={styles.foodPh} />
          <View style={{ flex: 1 }}>
            <Text style={styles.foodName}>{food?.name ?? ''}</Text>
            {!!food?.nameKo && food.nameKo !== food.name && <Text style={styles.foodKo}>{food.nameKo}</Text>}
          </View>
          {food && <RiskMark state={personalRisk(food.risk, (me?.restrictions.length ?? 0) > 0)} size={22} />}
        </View>

        {/* rating */}
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

        {/* body */}
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
            <Text style={styles.tag}>{t('review.langDetected')}</Text>
            <Text style={styles.tag}>{t('review.charCount', { count: body.length })}</Text>
          </View>
        </View>

        {/* photos — P-077: 최대 3장, 미리보기 + 개별 삭제. 선택 사항 */}
        <View style={styles.block}>
          <Text style={styles.label}>{t('review.photosLabel', { max: REVIEW_MAX_PHOTOS })}</Text>
          <View style={styles.photoRow}>
            {photos.map((uri) => (
              <View key={uri} style={styles.photoThumbWrap}>
                <Image source={{ uri }} style={styles.photoThumb} />
                <Pressable
                  accessibilityLabel={t('review.removePhoto')}
                  style={styles.photoDel}
                  hitSlop={8}
                  onPress={() => setPhotos((cur) => removeReviewPhoto(cur, uri))}
                >
                  <IconClose size={11} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < REVIEW_MAX_PHOTOS && (
              <Pressable accessibilityLabel={t('review.addPhoto')} style={styles.photoAdd} onPress={pickPhoto}>
                <IconPlus size={20} color={C.ink3} />
              </Pressable>
            )}
          </View>
        </View>

        {postError && (
          <View style={styles.postErr}>
            <RiskMark state="caution" size={16} />
            <Text style={styles.postErrText}>{t('review.postError')}</Text>
          </View>
        )}
        <View style={{ marginTop: 4 }}>
          <Btn variant={canPost ? 'primary' : 'off'} icon={<Star size={17} fillPct={100} fillColor="#fff" />} onPress={post}>
            {t('review.postReview')}
          </Btn>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { padding: 18, gap: 20 },

  postLink: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText, marginRight: 8 },
  postLinkOff: { color: C.ink3 },

  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12, ...shadow.sh1 },
  foodPh: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.surface2 },
  foodName: { fontFamily: font.display, fontSize: 16, color: C.ink },
  foodKo: { fontFamily: font.ko, fontSize: 12, color: C.ink2 },

  block: { gap: 12 },
  label: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  starPick: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 4 },
  starCap: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary, textAlign: 'center' },
  starCapEmpty: { color: C.ink3 },

  textarea: { minHeight: 120, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, padding: 14, fontFamily: font.body, fontSize: 14.5, color: C.ink, lineHeight: 21, ...shadow.sh1 },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoThumbWrap: { width: 76, height: 76 },
  photoThumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: C.surface2 },
  photoDel: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  photoAdd: { width: 76, height: 76, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tag: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },
  // P-085: 제출 실패 안내 (온보딩 submitErr 톤)
  postErr: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fdf3e7', borderWidth: 1, borderColor: '#f3ddc0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  postErrText: { flex: 1, fontFamily: font.body, fontSize: 12.5, color: C.ink, lineHeight: 17 },

  // submitted
  okWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  okIc: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.riskSafe, alignItems: 'center', justifyContent: 'center' },
  okTitle: { fontFamily: font.display, fontSize: 22, color: C.ink, marginTop: 4 },
  okBody: { fontFamily: font.body, fontSize: 14, color: C.ink2, textAlign: 'center', lineHeight: 21 },
  okMeta: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rankText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink },
});
