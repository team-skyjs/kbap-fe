/**
 * ScanDarkMessage — 스캔 안내·오류 전체 화면(메뉴판 'Not a menu' 화면에서 옮김, KB-914 R-139: 가공식품 후보 없음·못 읽음·오류도 같은 화면).
 * 어두운 바탕 · 가운데 정렬 · 스캔 아이콘 → 주황 대문자 라벨 → 흰 굵은 문장(→ 보조 문장) → 버튼 세로 쌓기(최대 300).
 * 닫기·뒤로 버튼과 시트 같은 덮개는 호출측이 overlay로(메뉴판 = 닫기 X + 게이트 시트 · 가공식품 = 뒤로).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { IconScanLines } from '@/components';
import { color as C, font, type } from '@/lib/theme';

export function ScanDarkMessage({ label, title, body, overlay, footer, children, testID }: {
  label: string; title: string; body?: string | null; overlay?: React.ReactNode; footer?: React.ReactNode; children?: React.ReactNode; testID?: string;
}) {
  return (
    <View style={dark.root} testID={testID}>
      {overlay}
      <View style={dark.center}>
        <IconScanLines size={48} color="rgba(255,255,255,0.85)" />
        <Text style={dark.label} accessibilityRole="header">{label}</Text>
        <Text style={dark.title}>{title}</Text>
        {!!body && <Text style={dark.body}>{body}</Text>}
        <View style={dark.btns}>{children}</View>
      </View>
      {footer}
    </View>
  );
}

export const dark = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16110d' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  // Codex #44 2차: 다크 배경 = 원색이 대비 우위(primaryText는 흰 바탕용)
  label: { ...type.tabLabel, fontFamily: font.bodyBold, fontWeight: '700', letterSpacing: 1, color: C.primary, textTransform: 'uppercase', textAlign: 'center' },
  title: { ...type.body, fontFamily: font.bodyBold, fontWeight: '700', color: '#fff', textAlign: 'center' },
  body: { ...type.body, fontFamily: font.body, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 23 },
  btns: { width: '100%', maxWidth: 300, gap: 10, marginTop: 6 },
});
