/**
 * FeedCard (KB-430 4150:13934 → KB-431 분리) — 리뷰 카드 공용(피드·홈 프리뷰·
 * 음식 상세 프리뷰). ReviewFeed에서 분리한 이유: ReviewFeed 모듈은 작성 픽커
 * (community/compose)·전역 피드 훅 등 무거운 그래프를 끌고 와 상세가 카드 하나
 * 때문에 전체를 의존하게 된다(placeMap 분리와 같은 계열, P-201).
 *
 * 구분선형(pad 22/20 + 하단 line — 카드 보더·그림자 소멸) · 작성자 행 + Helpful
 * (공용 단일 경유 — 표면별 배선 금지 P-196) · 평점 3축(Taste=총점 ·
 * Speed/Service=P-236 2축, 0=미평가 비표시) · 본문 · 사진 104 · 음식/장소 칩.
 */
import * as React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { color as C, type as type_ } from '@/lib/theme';
import { useReviewTime } from '@/lib/reviewTime';
import { CardPhoto, RankMedal, Star, IconChevron, IconFood, IconMore } from '@/components';
import { AvatarPlaceholder } from '@/components/design4Assets';
import { FlagEmoji } from '@/components/FlagEmoji';
import { RemoteImage } from '@/components/RemoteImage';
import { HelpfulButton, ReviewBody, ReviewPhotoStrip, ReviewPlaceLine } from '@/features/review/ReviewCellParts';
import type { Review } from '@/lib/api/types';

type TFn = (k: string, o?: Record<string, unknown>) => string;

const INK_TITLE = '#2F3137'; // 시안 gray-900(D-1 계열 명시값)

/** 평점 축 1개 — 라벨 13/500 + 별 16 + 수치 13/600 (KB-430 4150:13934). */
function RatingAxis({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.axis}>
      <Text style={styles.axisLabel}>{label}</Text>
      {/* A-FC-05(KB-486): 별→수치 2(라벨→별 4 유지 — axis gap) */}
      <Star size={16} fillPct={100} />
      <Text style={[styles.axisValue, { marginLeft: -2 }]}>{value}</Text>
    </View>
  );
}

export function FeedCard({
  review,
  t,
  mine,
  onOpenFood,
  onGuestHelpful,
  onMore,
  showMore = true,
  showFood = true,
  photoVariant = 'tiles',
  youAsName = false,
}: {
  review: Review;
  t: TFn;
  mine: boolean;
  onOpenFood: () => void;
  onGuestHelpful: () => void;
  onMore: () => void;
  /** P-216: 모더레이션 없는 표면(홈 프리뷰)은 ⋯ 숨김(동작 없는 버튼 금지) */
  showMore?: boolean;
  /** KB-431: 음식 상세 프리뷰 = 자기 자신 칩 무의미 — 숨김 */
  showFood?: boolean;
  /** KB-817: 리뷰 탭만 'peek'(사진 가로 스냅 + See more 잉크색). 홈·음식 상세·내 리뷰 = 'tiles' 불변 */
  photoVariant?: 'tiles' | 'peek';
  /** KB-865 ④(시안 46): 내 리뷰 = 닉네임 자리에 'You' — 가공식품 상세만 켠다(그 밖 표면 무변) */
  youAsName?: boolean;
}) {
  const fontScale = useWindowDimensions().fontScale; // KB-777: 글꼴 배율 전이 = 칩 재측정
  const anon = review.anonymized;
  const name = anon ? t('reviews.anonymous') : youAsName && mine ? t('reviews.you') : (review.author?.nickname ?? review.authorNationality ?? t('reviews.anonymous'));
  const when = useReviewTime(review.createdAt, t);
  return (
    <View style={styles.card} testID={`feed-${review.id}`}>
      <View style={styles.cardTop}>
        <View style={styles.who}>
          {/* 9/5 예진 판정(Q3): 아바타 24 통일 — 시안 avatar-placeholder SVG.
              P-340(KB-495, 1-B): 우하단 국기 배지 14 — FlagEmoji(유니코드 국기 이모지)는
              **국기 한정 헌법 이모지 예외(예진 결정 9/8)**. 탈퇴·국적 null = 배지 없음. */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {/* KB-905(T-069): 내 리뷰 = 내 프로필 사진(있으면) — 남의 리뷰는 시안대로 기본 아바타(9/5 Q3) · 실패 = 기본 아바타 */}
              {mine && !anon && review.author?.profileImageUrl ? (
                <MyAvatar uri={review.author.profileImageUrl} />
              ) : (
                <AvatarPlaceholder height={24} />
              )}
            </View>
            {/* Codex #101 P2: 배지 = 순수 장식(스크린리더 무음) — 국가명 10로케일 도입 안 함, 닉네임만 읽힘 */}
            {!anon && !!review.authorNationality && (
              <View
                style={styles.flagBadge}
                testID={`feed-flag-${review.id}`}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <FlagEmoji code={review.authorNationality} size={10} />
              </View>
            )}
          </View>
          {/* KB-781(D-25 v2): name-group = [닉네임+메달(간격 4)] + [작성 시각] — 가로 wrap(간격 8, 줄 간격 2). 공간이 모자라면 시각이 닉네임 아래로.
              닉네임만 말줄임, 시각은 안 잘림. 구분 문자 없음(가운데 점 금지 — 간격으로만). 스크린리더 = 전체 날짜 */}
          <View style={styles.nameGroup}>
            <View style={styles.nameRow}>
              <Text style={styles.whoName} numberOfLines={1}>{name}</Text>
              {!anon && !!review.authorRankTier && <RankMedal level={review.author?.level ?? 1} size={16} />}
            </View>
            {!!when.label && (
              <Text style={styles.when} accessibilityLabel={when.a11y} testID={`feed-when-${review.id}`}>{when.label}</Text>
            )}
          </View>
        </View>
        {/* P-196: Helpful = 공용 단일 경유(HelpfulButton) — 표면별 배선 금지 */}
        <HelpfulButton review={review} mine={mine} t={t} onGuest={onGuestHelpful} />
        {/* P-339 ②(KB-494): ⋯ 전 카드 표시(탈퇴 리뷰 포함 — 시트는 신고만) —
            표면·상태별로 있다 없다 하면 Helpful x 위치가 흔들린다(예진 실기) */}
        {showMore && (
          <Pressable hitSlop={10} onPress={onMore} testID={`feed-more-${review.id}`}>
            <IconMore size={20} color={'#262C31'} />
          </Pressable>
        )}
      </View>

      {/* 평점 행 — Taste(총점) 항상 · Speed/Service는 값 있을 때만(0 = 미평가, P-236) */}
      <View style={styles.axisRow}>
        <RatingAxis label={t('review.extrasTaste')} value={review.rating} />
        {!!review.servingSpeed && <RatingAxis label={t('review.extrasSpeed')} value={review.servingSpeed} />}
        {!!review.staffKindness && <RatingAxis label={t('review.extrasService')} value={review.staffKindness} />}
      </View>

      {/* P-390(KB-578): 사진 위·본문 아래 — 4표면 동일 순서(예진 실기: 반대였다) */}
      <ReviewPhotoStrip photos={review.photos ?? []} size={104} radius={4} variant={photoVariant} />
      <ReviewBody review={review} t={t} style={styles.body} toggleColor={photoVariant === 'peek' ? INK_TITLE : undefined} />

      {/* 음식 칩 행 — 탭 = 음식 상세 (구 미니 카드 대체) */}
      {showFood && (
      <Pressable style={styles.foodChip} onPress={onOpenFood} testID={`feed-food-${review.id}`}>
        {review.foodImageUrl ? (
          <View style={styles.foodChipThumb}>
            <CardPhoto uri={review.foodImageUrl} borderRadius={4} />
          </View>
        ) : (
          <IconFood size={16} color={C.ink2} />
        )}
        {/* KB-777: 글씨 크기를 바꾸면 한 줄 칩 이름을 새로 마운트해 다시 잰다(옛 폭으로 잘리던 것) */}
        <Text key={`chip:${fontScale}`} style={styles.foodChipName} numberOfLines={1}>
          {review.foodName ?? t('myReviews.viewDish')}
        </Text>
        <IconChevron size={12} color={C.ink3} />
      </Pressable>
      )}
      {/* P-201: 장소 칩 — 탭 = 지도 시트 */}
      <ReviewPlaceLine place={review.place ?? null} />
    </View>
  );
}

/** KB-905(T-069): 내 프로필 사진 24 — 원격 이미지 규칙(로딩 스켈레톤·실패 폴백) */
export function MyAvatar({ uri }: { uri: string }) {
  const [failed, setFailed] = React.useState(false);
  // Codex #364 P2: 새 사진 URL이 오면 옛 실패를 버리고 다시 시도 — 렌더 중 전환 비교(TabBar 아바타·KB-603과 같은 패턴, 값 키는 A→B→A 재시도를 잃는다)
  const [prevUri, setPrevUri] = React.useState(uri);
  if (uri !== prevUri) {
    setPrevUri(uri);
    setFailed(false);
  }
  if (failed) return <AvatarPlaceholder height={24} />;
  return <View testID="feed-my-avatar"><RemoteImage key={uri} uri={uri} style={styles.avatarImg} onError={() => setFailed(true)} /></View>;
}

const styles = StyleSheet.create({
  // 카드(4150:13934) — 구분선형(보더·그림자 소멸)
  card: { paddingVertical: 22, paddingHorizontal: 20, gap: 8, borderBottomWidth: 1, borderBottomColor: C.line }, // A-FC-01(KB-486) · gap ↔ 번역 라벨 padTop(TRANSLATE_LABEL_BOX) 묶임 — 줄이면 라벨 상자가 위 사진 터치를 덮는다(유닛)
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, // A-FC-01
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }, // A-FC-02
  whoName: { flexShrink: 1, fontSize: 15, fontWeight: '500', color: '#2F3137' }, // A-FC-02
  // KB-781: name-group — 가로 wrap(간격 8 · 줄 간격 2). 닉네임 줄은 상자 폭까지만(말줄임), 시각은 자기 폭 그대로(안 잘림)
  nameGroup: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, maxWidth: '100%' },
  when: { ...type_.caption, color: C.ink3, flexShrink: 0 }, // caption1-regular · gray-600
  // 시안 아바타: 원 bg #E8F6FF + 실루엣(SVG) — TabBar 프로필 슬롯과 동일 문법
  avatarWrap: { width: 24, height: 24 }, // P-340: 배지 오버행 수용(overflow 기본 visible)
  avatarImg: { width: 24, height: 24 },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8F6FF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.10)' }, // A-FC-03
  // P-340(1-B): 국기 배지 14 — 흰 링 1.5 원형, 아바타 밖 우하단 -2 걸침
  flagBadge: { position: 'absolute', right: -2, bottom: -2, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }, // P-342 ④: 이모지만(흰 원·링 제거)

  // KB-431 후속(9/7 .fig 실측 #2162:11360): 평점 행 = hug 273×20 @x20 — **좌측 정렬**
  // (main=CENTER 속성은 hug 너비라 무효). gap 16(항목 간)·4(라벨-별) 현행 유지.
  axisRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 16 },
  axis: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  axisLabel: { fontSize: 13, fontWeight: '500', color: C.ink2 },
  axisValue: { fontSize: 13, fontWeight: '600', color: INK_TITLE },

  body: { fontSize: 14, fontWeight: '400', color: INK_TITLE, lineHeight: 20 },

  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%' }, // A-FC-06
  foodChipThumb: { width: 16, height: 16, borderRadius: 4, overflow: 'hidden', backgroundColor: C.surface2 },
  foodChipName: { flexShrink: 1, fontSize: 12, fontWeight: '500', color: C.inkInfo }, // P-284: 정보성 링크(동값·의미 토큰)
});

export default FeedCard;
