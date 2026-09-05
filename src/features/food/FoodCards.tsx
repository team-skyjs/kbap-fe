/**
 * FoodCards (KB-430 → KB-434 분리) — 홈 2열 그리드 카드(4150:13806)·recent-list 행
 * (4129:10705) 공용. 홈에서 분리한 이유: 저장 목록·My Foods가 카드 하나 때문에
 * 홈 탭의 무거운 그래프(useHome·VersionGate·analytics)를 견인하는 것 차단
 * (FeedCard 분리와 같은 계열, P-201).
 */
import * as React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, riskText, shadow, type RiskState } from '@/lib/theme';
import { Btn, CardPhoto, RiskBadge, IconFood } from '@/components';
import { BookmarkStar } from '@/components/Stars';
import { FLAGS } from '@/lib/flags';
import type { FoodCard } from '@/lib/api/types';

const INK_TITLE = '#2F3137'; // 시안 gray-900(D-1 계열 명시값)

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
        {!!food.photoUrl && <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} />}
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
          {!guest && <Text style={[styles.gstatus, { color: riskText[risk] }]}>{riskLabel}</Text>}
        </View>
        <Pressable style={styles.gbm} onPress={onBookmark} hitSlop={6} testID={`home-bm-${food.foodId}`}>
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
        {food.photoUrl ? (
          <CardPhoto uri={food.photoUrl} recyclingKey={food.foodId} borderRadius={4} />
        ) : (
          <View style={styles.rthumbFb}>
            <IconFood size={24} color={C.ink3} />
          </View>
        )}
        <View style={styles.rbadge}>
          <RiskBadge state={risk} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={styles.gname} numberOfLines={2}>
          {food.name}
        </Text>
        {food.nameKo !== food.name && (
          <Text style={styles.gko} numberOfLines={1}>
            {food.nameKo}
          </Text>
        )}
        {FLAGS.reviewsEnabled && (
          <View style={{ marginTop: 2 }}>
            <Btn sm variant="ghost" onPress={onReview} testID={`home-recent-review-${food.foodId}`}>
              {reviewLabel}
            </Btn>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gcard: { width: '47%', flexGrow: 1 },
  gphoto: { aspectRatio: 174 / 203, borderRadius: 4, backgroundColor: C.surface2, overflow: 'visible' },
  gbadge: { position: 'absolute', top: 0, left: 9 },
  gmeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  gname: { fontSize: 15, fontWeight: '600', color: INK_TITLE },
  gko: { fontSize: 14, fontWeight: '500', color: C.ink2 },
  gstatus: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  gbm: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sh1,
  },

  rrow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rthumb: { width: 100, height: 100, borderRadius: 4, backgroundColor: C.surface2 },
  rthumbFb: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rbadge: { position: 'absolute', top: 0, left: 3 },
});
