/**
 * SubHeader — static back+title header for NON-scrolling sub-screens
 * (e.g. owner-confirmation card). Scrolling sub-screens use
 * <StickyHeader mode="back" /> instead so the header is scroll-aware (§6).
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font, shadow } from '@/lib/theme';
import { IconArrowLeft } from './icons';
import { PressScale } from './PressScale';

export function SubHeader({
  title,
  onBack,
  trailing,
}: {
  title: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <PressScale style={styles.back} onPress={onBack} hitSlop={8}>
        <IconArrowLeft size={20} color={C.ink} />
      </PressScale>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {trailing ?? <View style={{ width: 38 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // KB-429(AppBar 4123:3608): h56 · pad 16 · 흰 배경 · 하단선 없음 · 타이틀 18/600 중앙
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  back: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 중앙 정렬 = 우측 38pt 플레이스홀더(trailing 부재 시)가 back 폭을 상쇄 — 마진 중복 금지(Codex #27)
  title: { flex: 1, fontFamily: font.bodySemi, fontSize: 18, color: C.ink, textAlign: 'center' },
});

export default SubHeader;
