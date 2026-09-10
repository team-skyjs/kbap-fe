/**
 * FoodCards (KB-430 → KB-434 분리) — 홈 2열 그리드 카드(4150:13806)·recent-list 행
 * (4129:10705) 공용. 홈에서 분리한 이유: 저장 목록·My Foods가 카드 하나 때문에
 * 홈 탭의 무거운 그래프(useHome·VersionGate·analytics)를 견인하는 것 차단
 * (FeedCard 분리와 같은 계열, P-201).
 */
import * as React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, riskTextStrong, shadow, type RiskState } from '@/lib/theme';
import { Btn, CardPhoto, RiskBadge, IconFood } from '@/components';
import { BookmarkStar } from '@/components/Stars';
import { FLAGS } from '@/lib/flags';
import type { FoodCard } from '@/lib/api/types';

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
export function FoodGridCard({
  food,
  risk,
  guest,
  saved,
  riskLabel,
  onPress,
  onBookmark,
  style,
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
}) {
  return (
    <Pressable style={[styles.gcard, style]} onPress={onPress} testID={`home-food-${food.foodId}`}>
      <View style={styles.gphoto}>
        {/* P-353 ③(KB-515): 사진 없음/실패 = CardPhoto 내부 기본 이미지(구 IconFood 박스 폐기) */}
        <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} borderRadius={4} />
        {/* 게스트에겐 개인화 뱃지 미렌더 (guest-access-policy §1) */}
        {!guest && (
          <View style={styles.gbadge}>
            <RiskBadge state={risk} />
          </View>
        )}
      </View>
      <View style={styles.gmeta}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.gname} numberOfLines={2}>
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
}: {
  food: FoodCard;
  risk: RiskState;
  reviewLabel: string;
  onPress: () => void;
  onReview: () => void;
}) {
  return (
    <Pressable style={styles.rrow} onPress={onPress} testID={`home-recent-${food.foodId}`}>
      <View style={styles.rthumb}>
        <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} borderRadius={4} />
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

const styles = StyleSheet.create({
  gcard: { minWidth: 0 }, // P-333: 구 flexWrap 47%+grow 기본 폐기 — 전 소비처가 폭 명시(레일 cardW·그리드 셀 100%/flex)
  // P-315: 정적 bg(surface2) 제거 — 시안 photo effects 없음(회색 띠 원인). 로딩 = CardPhoto Shimmer
  gphoto: { aspectRatio: 174 / 203, borderRadius: 4, overflow: 'visible' },
  gbadge: { position: 'absolute', top: -4, left: 3 }, // P-315 시안(2072:1788): 배지가 사진 상단 4pt 위로 걸침
  gmeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 10 }, // A-HM-05
  gname: { fontSize: 15, fontWeight: '600', color: INK_TITLE },
  gko: { fontSize: 14, fontWeight: '500', color: C.ink2 },
  gstatus: { fontSize: 12, fontWeight: '700', marginTop: 0 }, // A-HM-05
  // A-DS-02(KB-486): 기본 = 흰 + sh1(보더 제거), 저장 상태만 #EAEBEE 1(2072:2510).
  // 프레임 불변(P-151): 비저장도 같은 폭의 투명 보더로 자리 유지.
  gbm: {
    width: 36,
    height: 36,
    borderRadius: 4,
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
  rname: { fontSize: 15, fontWeight: '700', color: INK_TITLE }, // A-HM-07(recent-row 전용 — 그리드 gname 무변)
  rthumb: { width: 100, height: 100, borderRadius: 4 }, // P-315: 정적 bg 제거(시안 effects 없음) // 폴백만 회색 유지
  rbadge: { position: 'absolute', top: -4, left: 3 }, // P-315 시안 오프셋
});
