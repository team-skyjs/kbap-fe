/**
 * SubHeader — static back+title header for NON-scrolling sub-screens
 * (e.g. owner-confirmation card). Scrolling sub-screens use
 * <StickyHeader mode="back" /> instead so the header is scroll-aware (§6).
 */
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font, shadow } from '@/lib/theme';
import { IconArrowLeft } from './icons';

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
      <Pressable style={styles.back} onPress={onBack} hitSlop={8}>
        <IconArrowLeft size={20} color={C.ink} />
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {trailing ?? <View style={{ width: 38 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 13,
    backgroundColor: 'rgba(252,245,239,0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hair,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sh1,
  },
  title: { flex: 1, fontFamily: font.display, fontSize: 18, color: C.ink, letterSpacing: -0.2 },
});

export default SubHeader;
