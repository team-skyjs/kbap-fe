/**
 * FoodCards (KB-430 → KB-434 분리) — 홈 2열 그리드 카드(4150:13806)·recent-list 행
 * (4129:10705) 공용. 홈에서 분리한 이유: 저장 목록·My Foods가 카드 하나 때문에
 * 홈 탭의 무거운 그래프(useHome·VersionGate·analytics)를 견인하는 것 차단
 * (FeedCard 분리와 같은 계열, P-201).
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { color as C, riskTextStrong, shadow, type RiskState, radius } from '@/lib/theme';
import { Btn, CardPhoto, NewBadge, RiskBadge, IconChevron } from '@/components';
import { useIsNewFood } from '@/lib/newFood';
import { BookmarkStar, OverallRating, Stars } from '@/components/Stars';
import { FLAGS } from '@/lib/flags';
import type { FoodCard, TopRatedFood } from '@/lib/api/types';

const INK_TITLE = '#2F3137'; // 시안 gray-900(D-1 계열 명시값)

/** P-333(KB-486): numColumns=2 + flex:1 셀 그리드 — 홀수면 마지막 셀이 행 전체로
 *  확장되는 결함의 공용 해법: 데이터 끝에 자리표시자 1개를 붙여 마지막 행도 2셀 유지
 *  (P-326 Safe picks filler와 같은 문법). 렌더측은 __pad면 빈 셀 View를 그린다. */
export type GridPad = { foodId: '__gridPad486'; __pad: true };
export const isGridPad = (x: unknown): x is GridPad => (x as GridPad)?.__pad === true;
export function padOddGrid<T>(items: T[]): (T | GridPad)[] {
  return items.length % 2 === 1 ? [...items, { foodId: '__gridPad486', __pad: true } as GridPad] : items;
}

/** 2열 그리드 카드 (4150:13806) — 히어로 이미지 + RiskBadge + 북마크 버튼. */
/** 카드 제목 공통 — KB-909(Q-367): 자동 축소 끔(XXL에서 "Spicy Crab"만 작아져 이웃 카드와 글자 크기가 달랐다) · 2줄 + 말줄임.
 *  (구 KB-903 "넘치면 축소" 규칙 — 2줄에 들어가면 축소가 안 걸려 "Jajangmyeo / n"이 그대로 쪼개졌다) */
export const CARD_TITLE = { numberOfLines: 2, ellipsizeMode: 'tail' } as const;

export function FoodGridCard({
  food,
  risk,
  guest,
  saved,
  riskLabel,
  onPress,
  onBookmark,
  style,
  ref,
}: {
  food: FoodCard;
  risk: RiskState;
  guest: boolean;
  saved: boolean;
  riskLabel: string;
  onPress: () => void;
  onBookmark: () => void;
  /** KB-434 저장 그리드(FlatList 셀) — 홈 flexWrap 폭(47%) 오버라이드용 */
  style?: StyleProp<ViewStyle>;
  /** KB-784: 홈 카드 노출 측정(measureInWindow) — 홈 밖은 미전달 */
  ref?: React.Ref<View>;
}) {
  const isNew = useIsNewFood(food.publishedAt);
  return (
    <Pressable ref={ref} style={[styles.gcard, style]} onPress={onPress} testID={`home-food-${food.foodId}`}>
      <View style={styles.gphoto}>
        {/* P-353 ③(KB-515): 사진 없음/실패 = CardPhoto 내부 기본 이미지(구 IconFood 박스 폐기) */}
        <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} borderRadius={radius.md} />
        {/* 게스트에겐 개인화 뱃지 미렌더 (guest-access-policy §1) */}
        {!guest && (
          <View style={styles.gbadge}>
            <RiskBadge state={risk} />
          </View>
        )}
        {/* P-385(KB-363): NEW = 공개 24h 이내. 시안 노드 없음 — 커맨드 센터 결정으로 RiskBadge(좌상단)
            반대 모서리인 우상단, 인셋은 동일값(겹침 0). */}
        {isNew && (
          <View style={styles.gnew}>
            <NewBadge testID={`food-new-${food.foodId}`} />
          </View>
        )}
      </View>
      <View style={styles.gmeta}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {/* KB-903(T-033): AX 최대에서 한 단어가 카드 폭을 넘으면 단어 중간에서 꺾였다("Jajangmyeo / n") — 2줄 안에 들도록 줄이기(자르기 아님) */}
          <Text style={styles.gname} {...CARD_TITLE}>
            {food.name}
          </Text>
          {food.nameKo !== food.name && (
            <Text style={styles.gko} numberOfLines={1}>
              {food.nameKo}
            </Text>
          )}
          {!guest && <Text style={[styles.gstatus, { color: riskTextStrong[risk] } /* P-284: 12/700 상태 텍스트 = 대비 토큰 */]}>{riskLabel}</Text>}
        </View>
        <Pressable style={[styles.gbm, saved && styles.gbmSaved]} onPress={onBookmark} hitSlop={6} testID={`home-bm-${food.foodId}`}>
          {/* 9/5 판정: 북마크 별(4129:10698/10701) — 저장됨 = #FFE812/#E5D64D */}
          <BookmarkStar saved={saved} size={16} />
        </Pressable>
      </View>
    </Pressable>
  );
}

/** recent-list 행 (4129:10705) — 썸네일 100 + RiskBadge + Review 소형 버튼.
 *  장소 칩·스캔 날짜는 홈 데이터(FoodCard)에 필드 부재 — 미표시(REPORTS 기재). */
export function RecentRow({
  food,
  risk,
  reviewLabel,
  onPress,
  onReview,
  ref,
}: {
  food: FoodCard;
  risk: RiskState;
  reviewLabel: string;
  onPress: () => void;
  onReview: () => void;
  /** KB-784: 홈 카드 노출 측정 — 홈 밖은 미전달 */
  ref?: React.Ref<View>;
}) {
  return (
    <Pressable ref={ref} style={styles.rrow} onPress={onPress} testID={`home-recent-${food.foodId}`}>
      <View style={styles.rthumb}>
        <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} borderRadius={radius.md} />
        <View style={styles.rbadge}>
          <RiskBadge state={risk} />
        </View>
      </View>
      {/* A-HM-07(KB-486): Review 버튼 = 이름 블록 우측(gap 5), 이름 15/700 · 이름/ko gap 3 */}
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={styles.rname} numberOfLines={2}>
            {food.name}
          </Text>
          {food.nameKo !== food.name && (
            <Text style={styles.gko} numberOfLines={1}>
              {food.nameKo}
            </Text>
          )}
        </View>
        {FLAGS.reviewsEnabled && (
          <Btn sm variant="ghost" onPress={onReview} testID={`home-recent-review-${food.foodId}`}>
            {reviewLabel}
          </Btn>
        )}
      </View>
    </Pressable>
  );
}

/** KB-800: 홈 "평점 높은 음식" 행 — RecentRow 썸네일·이름 블록 재사용 + 총평점 줄 + 세부 3줄(맛·속도·친절도) + chevron.
 *  세부 null = 빈 별 5개 + "—"(숫자 칸 폭 24 고정 → 값↔— 전환에 별 위치 불변). 국기 없음(02_designer_spec). */
export function TopRatedRow({
  food,
  risk,
  onPress,
  ref,
}: {
  food: TopRatedFood;
  risk: RiskState;
  onPress: () => void;
  /** 홈 카드 노출 측정 */
  ref?: React.Ref<View>;
}) {
  const { t } = useTranslation();
  const details: [string, number | null][] = [
    [t('review.extrasTaste'), food.taste],
    [t('review.extrasSpeed'), food.servingSpeed],
    [t('review.extrasService'), food.staffKindness],
  ];
  return (
    <Pressable
      ref={ref}
      style={({ pressed }) => [styles.rrow, pressed && { backgroundColor: C.surface2 } /* 눌림 = 배경색만 */]}
      onPress={onPress}
      accessibilityRole="button"
      testID={`home-top-rated-${food.foodId}`}
    >
      <View style={styles.rthumb}>
        <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} borderRadius={radius.md} />
        <View style={styles.rbadge}>
          <RiskBadge state={risk} />
        </View>
      </View>
      <View style={styles.trBody}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ gap: 3 }}>
            <Text style={styles.rname} numberOfLines={2}>
              {food.name}
            </Text>
            {food.nameKo !== food.name && (
              <Text style={styles.gko} numberOfLines={1}>
                {food.nameKo}
              </Text>
            )}
          </View>
          <OverallRating average={food.overallRating ?? null} count={food.overall.count} numTestID="top-rated-overall" style={styles.trOverall} />
          <View style={styles.trDetails}>
            {details.map(([label, v]) => (
              <View key={label} style={styles.trLine}>
                <Text style={styles.trLabel} numberOfLines={2}>
                  {label}
                </Text>
                <Stars value={v ?? 0} size={10} />
                <Text style={[styles.trNum, v == null && styles.trNumNone]} testID="top-rated-detail">
                  {v == null ? '\u2014' : v.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View accessible={false}>
          <IconChevron size={16} color={C.ink3} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gcard: { minWidth: 0 }, // P-333: 구 flexWrap 47%+grow 기본 폐기 — 전 소비처가 폭 명시(레일 cardW·그리드 셀 100%/flex)
  // P-315: 정적 bg(surface2) 제거 — 시안 photo effects 없음(회색 띠 원인). 로딩 = CardPhoto Shimmer
  gphoto: { aspectRatio: 174 / 203, borderRadius: radius.md, overflow: 'visible' },
  gbadge: { position: 'absolute', top: -4, left: 3 }, // P-315 시안(2072:1788): 배지가 사진 상단 4pt 위로 걸침
  gnew: { position: 'absolute', top: -4, right: 3 }, // P-385: gbadge 대칭(겹침 0 — 좁은 홈 레일 폭도 유닛 잠금)
  gmeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 10 }, // A-HM-05
  gname: { fontSize: 16, fontWeight: '600', color: INK_TITLE },
  gko: { fontSize: 16, fontWeight: '500', color: C.ink2 },
  gstatus: { fontSize: 13, fontWeight: '700', marginTop: 0 }, // A-HM-05
  // A-DS-02(KB-486): 기본 = 흰 + sh1(보더 제거), 저장 상태만 #EAEBEE 1(2072:2510).
  // 프레임 불변(P-151): 비저장도 같은 폭의 투명 보더로 자리 유지.
  gbm: {
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sh1,
  },
  gbmSaved: { borderColor: '#EAEBEE' },

  // A-HM-07: cross center(구 flex-start)
  rrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rname: { fontSize: 16, fontWeight: '700', color: INK_TITLE }, // A-HM-07(recent-row 전용 — 그리드 gname 무변)
  rthumb: { width: 100, height: 100, borderRadius: radius.md }, // P-315: 정적 bg 제거(시안 effects 없음) // 폴백만 회색 유지
  rbadge: { position: 'absolute', top: -4, left: 3 }, // P-315 시안 오프셋

  // KB-800 TopRatedRow (02_designer_spec)
  trBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  trOverall: { marginTop: 6 },
  trDetails: { marginTop: 6, gap: 4 },
  trLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 16 },
  trLabel: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '500', lineHeight: 17, color: C.ink2 },
  trNum: { width: 24, textAlign: 'right', fontSize: 13, fontWeight: '700', color: C.ink },
  trNumNone: { color: C.inkMute },
});
