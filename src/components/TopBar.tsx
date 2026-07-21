/**
 * TopBar — onboarding progress bar (back + segmented progress + optional skip).
 * Ported from hifi-g.css `.topbar` / mockup TopBar.
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font } from '@/lib/theme';
import { IconArrowLeft } from './icons';

// P-042(Q-18 6번): P-032 ⑦의 노드 팝 제거 — 예진 "이상함". 진행 표시는 상태
// 전달이 전부라 애니메이션이 소음(기피 칩 P-035와 같은 절제 사례). 즉시 전환.
function Seg({ on }: { on: boolean }) {
  return <View style={[styles.seg, on && styles.segOn]} />;
}

export function TopBar({
  seg = 0,
  of = 5,
  back = true,
  skipLabel,
  onBack,
  onSkip,
}: {
  /** number of filled segments */
  seg?: number;
  of?: number;
  back?: boolean;
  /** i18n label, e.g. t('common.skip'); omit to hide */
  skipLabel?: string;
  onBack?: () => void;
  onSkip?: () => void;
}) {
  return (
    <View style={styles.root}>
      {back ? (
        <Pressable style={styles.back} onPress={onBack} hitSlop={8}>
          <IconArrowLeft size={18} color={C.ink} />
        </Pressable>
      ) : (
        <View style={{ width: 34 }} />
      )}
      <View style={styles.prog}>
        {Array.from({ length: of }).map((_, i) => (
          <Seg key={i} on={i < seg} />
        ))}
      </View>
      {skipLabel ? (
        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={styles.skip}>{skipLabel}</Text>
        </Pressable>
      ) : (
        <View style={{ width: 30 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 },
  back: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prog: { flex: 1, flexDirection: 'row', gap: 5 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.hair },
  segOn: { backgroundColor: C.primary },
  skip: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2 },
});

export default TopBar;
