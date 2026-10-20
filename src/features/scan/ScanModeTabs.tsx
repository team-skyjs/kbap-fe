/**
 * 스캔 모드 탭(KB-813, D-32 Capture mode 12338:36477) — 메뉴판 / 음식 사진(자리만 — 비활성 "준비 중") / 가공식품.
 * 시안 실측(2x): 좌우 20 안쪽 세 칸 균등 · 탭 높이 40(라벨 16 semibold · 밑줄 2) · 활성 ink + 밑줄 · 비활성 gray-700 · 준비 중 = 비활성 회색 · 아래 0.5 구분선.
 * `tone="dark"` = 메뉴판 카메라(어두운 뷰파인더) 위 — 같은 틀에 흰 글자.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { color as C, font } from '@/lib/theme';

export type ScanMode = 'menu' | 'food' | 'packaged';
const MODES: ScanMode[] = ['menu', 'food', 'packaged'];

export function ScanModeTabs({ value, onChange, tone = 'light' }: { value: ScanMode; onChange: (m: ScanMode) => void; tone?: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const dark = tone === 'dark';
  return (
    <View style={st.wrap} accessibilityRole="tablist" testID="scan-mode-tabs">
      <View style={st.row}>
        {MODES.map((m) => {
          const soon = m === 'food'; // 음식 사진 모드 = 자리만(비범위)
          const on = value === m;
          return (
            <Pressable
              key={m}
              style={st.tab}
              onPress={soon ? undefined : () => onChange(m)}
              disabled={soon}
              accessibilityRole="tab"
              accessibilityState={{ selected: on, disabled: soon }}
              accessibilityHint={soon ? t('scanMode.soon') : undefined}
              testID={`scan-mode-${m}`}
            >
              <Text
                style={[st.label, { color: soon ? (dark ? 'rgba(255,255,255,0.4)' : C.inkDisabled) : on ? (dark ? '#FFFFFF' : C.ink) : dark ? 'rgba(255,255,255,0.75)' : C.ink2 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t(`scanMode.${m}`)}
              </Text>
              <View style={[st.bar, on && { backgroundColor: dark ? '#FFFFFF' : '#212124' }]} />
            </Pressable>
          );
        })}
      </View>
      <View style={[st.divider, dark && { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingLeft: 20 },
  row: { flexDirection: 'row', paddingRight: 20 },
  tab: { flex: 1, height: 40, justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  label: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, paddingHorizontal: 4 },
  bar: { alignSelf: 'stretch', height: 2, backgroundColor: 'transparent' },
  divider: { height: 0.5, backgroundColor: C.line2 },
});
