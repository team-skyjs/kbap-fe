/**
 * ProductName — 가공식품 제품 이름 한 규칙(KB-914 R-140): 영어(앱 언어 표시명) 굵게 + 한국어 원명 작게.
 * 영어가 없으면(표시명 = 한국어 · nameKo 없음) 한국어만 굵게. 후보·검색·탭 카드·상세·리뷰 칩이 모두 이 부품을 쓴다(경로마다 언어가 달라 보이던 것).
 * size: row = 목록 줄(16) · title = 상세 제목(28) · chip = 리뷰 작성 칩(16, 1줄)
 */
import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, type } from '@/lib/theme';

export function ProductName({ name, nameKo, size = 'row', lines = 2, header = false, style, testID }: {
  name: string; nameKo: string | null; size?: 'row' | 'title' | 'chip'; lines?: number; header?: boolean; style?: ViewStyle; testID?: string;
}) {
  // nameKo = 어댑터가 표시명과 같으면 null로 준다 — 같은 줄을 두 번 쓰지 않는다
  const ko = nameKo && nameKo !== name ? nameKo : null;
  return (
    <View style={[st.box, style]} testID={testID}>
      <Text style={st[size]} numberOfLines={lines} lineBreakStrategyIOS="hangul-word" accessibilityRole={header ? 'header' : undefined}>{name}</Text>
      {!!ko && <Text style={st[`${size}Ko`]} numberOfLines={1} testID={testID ? `${testID}-ko` : undefined}>{ko}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  box: { gap: 2 },
  // 토큰만(KB-914 게이트 — 새 fontSize 리터럴 0): 목록·칩 = button 16 굵게 + meta 14 · 상세 제목 = largeTitle 26 + body 16
  row: { ...type.button, fontFamily: font.bodyBold, fontWeight: '700', lineHeight: 22, color: C.ink },
  rowKo: { ...type.meta, fontFamily: font.ko, fontWeight: '400', lineHeight: 19, color: C.ink2 },
  title: { ...type.largeTitle, fontFamily: font.bodyBold, lineHeight: 32, color: C.ink },
  titleKo: { ...type.body, fontFamily: font.ko, lineHeight: 21, color: C.ink2 },
  chip: { ...type.button, fontFamily: font.bodyBold, fontWeight: '700', lineHeight: 22, color: C.ink },
  chipKo: { ...type.meta, fontFamily: font.ko, fontWeight: '400', lineHeight: 19, color: C.ink2 },
});

/** KB-948 후속(P-568): 카드 평점 줄 = 한국어 이름 줄과 같은 글자(Packaged 카드) */
export const productNameKoRowStyle = st.rowKo;
