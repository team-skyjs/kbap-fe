/**
 * ReviewCellParts (P-182/KB-307) — 리뷰 2depth 셀 확장 공통 문법.
 * 개별 디테일(review/[id]) 소멸 — 목록 ReviewResponse가 풀 필드(전문·사진·likedByMe)라
 * 셀 안에서 전부 소비(쿠팡식). 전 표면(상세 프리뷰·전체 목록·커뮤니티 피드·내 리뷰) 공용:
 *   - ExpandableBody: 3줄 클램프 + See more/less 셀 내 펼침
 *   - ReviewPhotoStrip: 가로 스트립 + 탭 = 풀스크린 뷰어(페이징·닫기 — 기존 뷰어 부재로 표준 신설)
 *   - ReviewEditSheet: 본인 리뷰 수정(별점+본문 — 구 디테일 editing 이식, buildReviewUpdate 경유)
 */
import * as React from 'react';
import { Image } from 'expo-image'; // P-189: 원격 사진 = 디스크 캐시
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { Btn, IconClose, Star } from '@/components';
import { Input } from '@/components/KeyboardDismissBar';
import { useToggleReviewLike } from '@/lib/data/useReviewMutations';
import { useIsGuest } from '@/lib/auth/useSession';
import type { Review } from '@/lib/api/types';

type TFn = (k: string, o?: Record<string, unknown>) => string;

/** 본문 3줄 클램프 + See more/less — 셀 내 펼침(P-182 ②). */
export function ExpandableBody({ body, t, style }: { body: string; t: TFn; style?: object }) {
  const [expanded, setExpanded] = React.useState(false);
  const [clamped, setClamped] = React.useState(false);
  return (
    <View style={{ gap: 3 }}>
      <Text
        style={[styles.body, style]}
        numberOfLines={expanded ? undefined : 3}
        onTextLayout={(e) => {
          if (!expanded && e.nativeEvent.lines.length >= 3) setClamped(true);
        }}
      >
        {body}
      </Text>
      {(clamped || expanded) && (
        <Pressable hitSlop={8} onPress={() => setExpanded((v) => !v)} testID="body-toggle">
          <Text style={styles.toggle}>{expanded ? t('reviews.seeLess') : t('reviews.seeMore')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** 사진 가로 스트립 + 탭 = 풀스크린 뷰어(가로 페이징·X 닫기·인덱스). */
export function ReviewPhotoStrip({ photos, size = 72 }: { photos: string[]; size?: number }) {
  const [openAt, setOpenAt] = React.useState<number | null>(null);
  const { width } = useWindowDimensions();
  const [page, setPage] = React.useState(0);
  if (!photos.length) return null;
  return (
    <>
      <View style={styles.strip}>
        {photos.slice(0, 3).map((uri, i) => (
          <Pressable key={uri} hitSlop={4} onPress={() => { setPage(i); setOpenAt(i); }} testID={`photo-${i}`}>
            <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 10, backgroundColor: C.surface2 }} />
          </Pressable>
        ))}
      </View>
      <Modal visible={openAt != null} transparent animationType="fade" onRequestClose={() => setOpenAt(null)}>
        <View style={styles.viewer} testID="photo-viewer">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (openAt ?? 0) * width, y: 0 }}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {photos.map((uri) => (
              <View key={uri} style={{ width, justifyContent: 'center' }}>
                <Image source={{ uri }} style={{ width, height: width * 1.2 }} contentFit="contain" />
              </View>
            ))}
          </ScrollView>
          {/* P-193: X = 아이콘만(배경·보더 소멸 — P-181 연필 문법), 터치는 hitSlop */}
          <Pressable style={styles.viewerClose} hitSlop={14} onPress={() => setOpenAt(null)} testID="viewer-close">
            <IconClose size={22} color="#fff" />
          </Pressable>
          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

/**
 * Helpful 토글 (P-196) — 4표면(피드·상세 프리뷰·전체 목록·내 리뷰) **유일 경유**.
 * 표면별 개별 배선 금지(이번 반려 = 표면별 상이 동작 사례) — 버튼·뮤테이션·게스트/
 * 본인 분기 전부 여기 한 곳. **본인(mine) = 카운트 표시 전용**(탭 무반응·비활성 톤,
 * 숨김 아님 — 자기 투표 왜곡·Helpful 알림 자가 트리거 차단, 예진 확정 8/13).
 * 게스트 = onGuest(게이트 시트, 미전달 표면은 무반응 — 401 송신 0).
 */
export function HelpfulButton({
  review,
  mine,
  foodId,
  t,
  onGuest,
}: {
  review: Review;
  mine: boolean;
  /** 뮤테이션 캐시 키용 — 생략 시 review.foodId */
  foodId?: string;
  t: TFn;
  onGuest?: () => void;
}) {
  const toggle = useToggleReviewLike();
  const isGuest = useIsGuest();
  const onPress = () => {
    if (mine) return; // 카운트 표시 전용
    if (isGuest) return onGuest?.();
    toggle.mutate({ reviewId: review.id, foodId: foodId ?? review.foodId }); // 낙관 토글(멱등 — 가드 예외)
  };
  return (
    <Pressable hitSlop={8} onPress={onPress} disabled={mine} testID={`helpful-${review.id}`}>
      <Text style={[styles.helpful, review.myLike && styles.helpfulOn, mine && styles.helpfulMine]}>
        {t('reviews.helpful', { count: review.likes ?? 0 })}
      </Text>
    </Pressable>
  );
}

/** 본인 리뷰 수정 시트 — 구 디테일 editing(별점+본문, 사진은 buildReviewUpdate가 보존) 이식. */
export function ReviewEditSheet({
  review,
  onClose,
  onSave,
  saving,
  t,
}: {
  review: Review | null;
  onClose: () => void;
  /** 호출측이 updateReview.mutate(buildReviewUpdate 경유) 배선 */
  onSave: (changes: { rating: number; body: string }) => void;
  saving?: boolean;
  t: TFn;
}) {
  const [rating, setRating] = React.useState(0);
  const [body, setBody] = React.useState('');
  React.useEffect(() => {
    if (review) {
      setRating(review.rating);
      setBody(review.body ?? '');
    }
  }, [review]);
  return (
    <Modal visible={review != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.editBackdrop}>
        <View style={styles.editCard} testID="review-edit-sheet">
          <Text style={styles.editTitle}>{t('editReview.title')}</Text>
          <View style={styles.editStars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => setRating(i)} hitSlop={6} testID={`edit-star-${i}`}>
                <Star size={32} fillPct={i <= rating ? 100 : 0} fillColor={C.primary} />
              </Pressable>
            ))}
          </View>
          <Input
            value={body}
            onChangeText={setBody}
            multiline
            style={styles.editInput}
            textAlignVertical="top"
            placeholder={t('review.placeholder')}
            placeholderTextColor={C.ink3}
          />
          <View style={{ gap: 9, marginTop: 4 }}>
            <Btn busy={saving} onPress={() => onSave({ rating, body })} testID="edit-save">
              {t('common.save')}
            </Btn>
            <Btn variant="ghost" onPress={onClose}>{t('common.cancel')}</Btn>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19 },
  toggle: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText },
  // P-196: Helpful — 상태별 색만 전환(프레임 불변): 기본 ink2 · 내 토글 primary · 본인 ink3
  helpful: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  helpfulOn: { color: C.primaryText },
  helpfulMine: { color: C.ink3 },
  strip: { flexDirection: 'row', gap: 6 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 54, right: 18 },
  dots: { position: 'absolute', bottom: 42, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { backgroundColor: '#fff' },
  editBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  editCard: { backgroundColor: C.card, borderRadius: 26, padding: 20, gap: 12, ...shadow.shPop },
  editTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  editStars: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  editInput: { minHeight: 110, maxHeight: 220, backgroundColor: C.surface2, borderRadius: radius.sm, padding: 12, fontFamily: font.body, fontSize: 14, color: C.ink, lineHeight: 20 },
});
