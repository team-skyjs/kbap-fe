/**
 * KB-962(예진 11/2, Mobbin Uber Eats·DoorDash): 홈 섹션 "See all" = 글자 없는 원형 화살표 버튼 — 연회색 원(hair) + 검은 화살표, 지름 32.
 * 터치는 hitSlop으로 44(원 자체는 32 — 줄 높이를 늘리지 않게). 접근성 라벨 = 기존 home.seeAll.
 */
import * as React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { IconArrowRight } from '@/components/icons';
import { color as C, radius } from '@/lib/theme';

export const SEE_ALL_CIRCLE = 32;

export function SeeAllCircle({ onPress, style, testID }: { onPress: () => void; style?: ViewStyle; testID: string }) {
  const { t } = useTranslation();
  return (
    <Pressable style={[st.circle, style]} onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('home.seeAll')} testID={testID}>
      <IconArrowRight size={18} color={C.ink} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  circle: { width: SEE_ALL_CIRCLE, height: SEE_ALL_CIRCLE, borderRadius: radius.pill, backgroundColor: C.hair, alignItems: 'center', justifyContent: 'center' },
});
