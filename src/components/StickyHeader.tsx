/**
 * StickyHeader — the ONE shared scroll-aware header (handoff §6).
 *
 * Pinned by LAYOUT, not absolute positioning: render it as the first child ABOVE
 * the screen's Animated.ScrollView. A flex sibling above a flex:1 ScrollView can
 * never scroll away (immune to Fabric/absolute z-order quirks that broke the
 * previous absolute-overlay on device). Content flows BELOW it (§6).
 *
 * Scroll-aware (reanimated scrollY, UI thread): a bottom hairline + shadow fade
 * in as you scroll, and an optional iOS-style large title collapses while the
 * compact title fades into the bar.
 *
 * Usage:
 *   const { scrollY, onScroll } = useStickyScroll();
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <StickyHeader scrollY={scrollY} mode="brand" largeTitle="K-Bap" search bell />
 *       <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}>…</Animated.ScrollView>
 *     </View>
 *   );
 */
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font } from '@/lib/theme';
import { IconArrowLeft, IconBell, IconBookmark, IconSearch } from './icons';

const BAR_H = 48; // top row height (icon buttons)
const LARGE_H = 46; // expanded large-title row height
const COLLAPSE = 56; // scroll distance for full large-title collapse

export function useStickyScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return { scrollY, onScroll };
}

export type StickyHeaderProps = {
  scrollY: SharedValue<number>;
  mode?: 'brand' | 'back';
  /** Compact title shown in the bar (back mode) or when large title collapses. */
  title?: string;
  /** Optional iOS-style large title that collapses on scroll. */
  largeTitle?: string;
  search?: boolean;
  bell?: boolean;
  bellDot?: boolean;
  bookmark?: boolean;
  onBack?: () => void;
  onSearch?: () => void;
  onBell?: () => void;
  onBookmark?: () => void;
};

export function StickyHeader({
  scrollY,
  mode = 'brand',
  title,
  largeTitle,
  search,
  bell,
  bellDot,
  bookmark,
  onBack,
  onSearch,
  onBell,
  onBookmark,
}: StickyHeaderProps) {
  const insets = useSafeAreaInsets();

  // shadow + hairline fade in once scrolled (the "lifted header" cue)
  const liftStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(scrollY.value, [4, 40], [0, 0.12], Extrapolation.CLAMP),
  }));
  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [8, 40], [0, 1], Extrapolation.CLAMP),
  }));
  const compactTitleStyle = useAnimatedStyle(() => {
    const from = largeTitle ? COLLAPSE * 0.55 : 0;
    const to = largeTitle ? COLLAPSE : 1;
    return { opacity: interpolate(scrollY.value, [from, to], [largeTitle ? 0 : 1, 1], Extrapolation.CLAMP) };
  });
  const largeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE * 0.7], [1, 0], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [0, COLLAPSE], [LARGE_H, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSE], [0, -8], Extrapolation.CLAMP) }],
  }));

  const compactTitle = title ?? largeTitle;

  return (
    <Animated.View style={[styles.root, { paddingTop: insets.top + 8 }, liftStyle]}>
      <View style={styles.bar}>
        {mode === 'back' ? (
          <Pressable style={styles.iconBtn} onPress={onBack} hitSlop={8}>
            <IconArrowLeft size={20} color={C.ink} />
          </Pressable>
        ) : (
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markText}>K</Text>
            </View>
            <Text style={styles.word}>K-Bap</Text>
          </View>
        )}

        {compactTitle != null && (
          <Animated.Text
            numberOfLines={1}
            style={[mode === 'back' ? styles.backTitle : styles.compactTitle, compactTitleStyle]}
          >
            {compactTitle}
          </Animated.Text>
        )}

        <View style={styles.actions}>
          {search && (
            <Pressable style={styles.iconBtn} onPress={onSearch} hitSlop={8}>
              <IconSearch size={20} color={C.ink} />
            </Pressable>
          )}
          {bell && (
            <Pressable style={styles.iconBtn} onPress={onBell} hitSlop={8}>
              <IconBell size={20} color={C.ink} />
              {bellDot && <View style={styles.dot} />}
            </Pressable>
          )}
          {bookmark && (
            <Pressable style={styles.iconBtn} onPress={onBookmark} hitSlop={8}>
              <IconBookmark size={19} color={C.ink} />
            </Pressable>
          )}
          {mode === 'back' && !search && !bell && !bookmark && <View style={{ width: 38 }} />}
        </View>
      </View>

      {largeTitle != null && (
        <Animated.View style={[styles.largeWrap, largeStyle]}>
          <Text numberOfLines={1} style={styles.largeTitle}>
            {largeTitle}
          </Text>
        </Animated.View>
      )}

      <Animated.View style={[styles.hairline, hairlineStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    // pinned by layout (first child above the ScrollView), NOT absolute
    zIndex: 2,
    paddingHorizontal: 16,
    paddingBottom: 4,
    backgroundColor: C.surface,
    // shadow: shadowOpacity is animated in (liftStyle); Android elevation static-low
    shadowColor: '#14181f',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  bar: { height: BAR_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { color: '#fff', fontFamily: font.display, fontSize: 21, lineHeight: 24 },
  word: { fontFamily: font.display, fontSize: 22, color: C.primary, letterSpacing: -0.2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.riskDanger,
    borderWidth: 2,
    borderColor: C.card,
  },
  backTitle: {
    position: 'absolute',
    left: 52,
    right: 52,
    textAlign: 'center',
    fontFamily: font.display,
    fontSize: 18,
    color: C.ink,
  },
  compactTitle: {
    position: 'absolute',
    left: 64,
    right: 64,
    textAlign: 'center',
    fontFamily: font.display,
    fontSize: 17,
    color: C.ink,
  },
  largeWrap: { justifyContent: 'flex-end', paddingBottom: 6, overflow: 'hidden' },
  largeTitle: { fontFamily: font.display, fontSize: 28, color: C.ink, letterSpacing: -0.5 },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.hair,
  },
});

export default StickyHeader;
