/**
 * ExpandToggle (P-390/KB-578) — 접기/펼치기 공용 문법. 앞으로 앱 전반이 이걸 쓴다.
 *
 * 예진 실기 지적: 리뷰 셀의 "See more"가 좌측·작아서 안 보였다 → **우측 정렬 + 44px 터치 타깃**
 * (hitSlop이 아니라 실제 높이·패딩 — 타깃이 눈에 보여야 누른다).
 * chevron은 접힘 ▼ / 펼침 ▲(= down 아이콘 180° 회전, 별도 에셋 없음).
 *
 * 9/18 예진 규칙: **기존 DS 토큰·컴포넌트만 재활용**(새 스타일 상수 금지) —
 * 라벨 = theme type.body(14/400) 등급 + `font.bodyBold` + `C.primaryText`(기존 토글 색 그대로),
 * 아이콘 = `IconChevronDown` 기존 크기·색.
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { IconChevronDown } from '@/components/icons';
import { useTranslation } from 'react-i18next';
import { color as C, font, type as type_ } from '@/lib/theme';

/** 터치 타깃 하한(접근성) — 높이로 확보한다. */
export const EXPAND_TOGGLE_MIN_H = 44;

export function ExpandToggle({
  expanded,
  onPress,
  labelExpanded,
  labelCollapsed,
  testID,
}: {
  expanded: boolean;
  onPress: () => void;
  /** 기본 = reviews.seeLess */
  labelExpanded?: string;
  /** 기본 = reviews.seeMore */
  labelCollapsed?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  const label = expanded ? (labelExpanded ?? t('reviews.seeLess')) : (labelCollapsed ?? t('reviews.seeMore'));
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      testID={testID}
    >
      <Text style={styles.label}>{label}</Text>
      {/* 펼침 = 같은 아이콘 180° — 방향만 뒤집는다(에셋 추가 없음) */}
      <View style={expanded ? styles.iconUp : undefined}>
        <IconChevronDown size={16} color={C.primaryText} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 우측 정렬 + 실제 높이 44(터치 타깃) — 부모 폭 기준
  row: {
    alignSelf: 'flex-end',
    minHeight: EXPAND_TOGGLE_MIN_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  label: { ...type_.body, fontFamily: font.bodyBold, color: C.primaryText },
  iconUp: { transform: [{ rotate: '180deg' }] },
});

export default ExpandToggle;
