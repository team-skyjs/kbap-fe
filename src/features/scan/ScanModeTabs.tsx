/**
 * 스캔 모드 탭(KB-813, D-32 Capture mode 12338:36477) — 메뉴판 / 음식 사진(자리만 — 비활성 "준비 중") / 가공식품.
 * 시안 실측(2x): 좌우 20 안쪽 세 칸 균등 · 탭 높이 40(라벨 16 semibold · 밑줄 2) · 활성 ink + 밑줄 · 비활성 gray-700 · 준비 중 = 비활성 회색 · 아래 0.5 구분선.
 * `tone="dark"` = 공통 카메라(KB-845, D-31 screen-3/4/5) 위 — 전폭 세 칸 · body-l3-regular 14 · 활성·비활성 흰색(활성 = 흰 밑줄) ·
 *   Food photo(준비 중) gray-500 · 구분선 gray-600.
 *   KB-854(카메라 v2 B): 긴 번역은 줄이지 않고 **가로 스크롤** — 칸 최소 폭 = 화면 1/3(들어가면 지금처럼 세 칸 균등).
 */
import * as React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { color as C, font } from '@/lib/theme';

export type ScanMode = 'menu' | 'food' | 'packaged';
const MODES: ScanMode[] = ['menu', 'food', 'packaged'];

export function ScanModeTabs({ value, onChange, tone = 'light' }: { value: ScanMode; onChange: (m: ScanMode) => void; tone?: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const dark = tone === 'dark';
  const third = useWindowDimensions().width / 3;
  const tabs = MODES.map((m) => {
    const soon = m === 'food'; // 음식 사진 모드 = 자리만(비범위)
    const on = value === m;
    return (
      <Pressable
        key={m}
        style={dark ? [st.tabDark, { minWidth: third }] : st.tab}
        onPress={soon ? undefined : () => onChange(m)}
        disabled={soon}
        accessibilityRole="tab"
        accessibilityState={{ selected: on, disabled: soon }}
        accessibilityHint={soon ? t('scanMode.soon') : undefined}
        testID={`scan-mode-${m}`}
      >
        <Text
          style={[dark ? st.labelDark : st.label, { color: soon ? (dark ? C.gray500 : C.inkDisabled) : on ? (dark ? C.surface : C.ink) : dark ? C.surface : C.ink2 }]}
          numberOfLines={1}
          adjustsFontSizeToFit={!dark}
        >
          {t(`scanMode.${m}`)}
        </Text>
        <View style={[st.bar, on && { backgroundColor: dark ? C.surface : '#212124' }]} />
      </Pressable>
    );
  });
  return (
    <View style={dark ? undefined : st.wrap} accessibilityRole="tablist" testID="scan-mode-tabs">
      {dark ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} contentContainerStyle={st.rowDark} testID="scan-mode-tabs-scroll">
          {tabs}
        </ScrollView>
      ) : (
        <View style={st.row}>{tabs}</View>
      )}
      <View style={[st.divider, dark && { backgroundColor: C.gray600 }]} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingLeft: 20 },
  row: { flexDirection: 'row', paddingRight: 20 },
  rowDark: { flexDirection: 'row', flexGrow: 1 },
  tab: { flex: 1, height: 40, justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  tabDark: { flexGrow: 1, height: 40, justifyContent: 'flex-end', alignItems: 'center', gap: 8 }, // 밑줄 = 칸 전폭(시안)
  label: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, paddingHorizontal: 4 },
  labelDark: { fontFamily: font.body, fontSize: 14, lineHeight: 21, paddingHorizontal: 12 }, // body-l3-regular · 긴 번역 칸이 넓어질 때 좌우 여백
  bar: { alignSelf: 'stretch', height: 2, backgroundColor: 'transparent' },
  divider: { height: 0.5, backgroundColor: C.line2 },
});
