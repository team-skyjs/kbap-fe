/**
 * ScanDarkMessage — 스캔 안내·오류 전체 화면(메뉴판 'Not a menu' 화면에서 옮김, KB-914 R-139: 가공식품 후보 없음·못 읽음·오류도 같은 화면).
 * 어두운 바탕 · 가운데 정렬 · 스캔 아이콘 → 주황 대문자 라벨 → 흰 굵은 문장(→ 보조 문장) → 버튼 세로 쌓기(최대 300).
 * 닫기·뒤로 버튼과 시트 같은 덮개는 호출측이 overlay로(메뉴판 = 닫기 X + 게이트 시트 · 가공식품 = 뒤로).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { IconArrowLeft, IconScanLines } from '@/components';
import { color as C, font, radius, type } from '@/lib/theme';

/** lightStatusBar = 상태바 아이콘을 밝게(어두운 바탕 — Codex #369). 호출측이 포커스일 때만 켠다(위에 다른 화면이 쌓이면 빠져 기본 복원 — 카메라 단계와 같은 규칙).
 *  메뉴판 scan.tsx는 화면 단위 lightBar가 이미 맡아 넘기지 않는다 */
export function ScanDarkMessage({ label, title, body, overlay, footer, children, testID, lightStatusBar = false }: {
  label: string; title: string; body?: string | null; overlay?: React.ReactNode; footer?: React.ReactNode; children?: React.ReactNode; testID?: string; lightStatusBar?: boolean;
}) {
  return (
    <View style={dark.root} testID={testID}>
      {lightStatusBar && <StatusBar style="light" />}
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

/** 어두운 화면 왼쪽 위 뒤로(메뉴판 오류 화면 닫기 버튼과 같은 자리·모양) — 가공식품 안내·오류 페이지 */
export function DarkBackButton({ onPress, label, testID }: { onPress?: () => void; label: string; testID: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable style={[dark.back, { top: insets.top + 8 }]} onPress={onPress} disabled={!onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} testID={testID}>
      <IconArrowLeft size={22} color="#fff" />
    </Pressable>
  );
}

export const dark = StyleSheet.create({
  back: { position: 'absolute', left: 16, zIndex: 40, width: 40, height: 40, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1, backgroundColor: '#16110d' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  // Codex #44 2차: 다크 배경 = 원색이 대비 우위(primaryText는 흰 바탕용)
  label: { ...type.tabLabel, fontFamily: font.bodyBold, fontWeight: '700', letterSpacing: 1, color: C.primary, textTransform: 'uppercase', textAlign: 'center' },
  title: { ...type.body, fontFamily: font.bodyBold, fontWeight: '700', color: '#fff', textAlign: 'center' },
  body: { ...type.body, fontFamily: font.body, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 23 },
  btns: { width: '100%', maxWidth: 300, gap: 10, marginTop: 6 },
});
