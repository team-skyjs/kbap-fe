/**
 * StickyHeader — the ONE shared scroll-aware header (handoff §6).
 * Every scrolling screen reuses this instead of re-implementing header behavior.
 *
 * Behavior (driven by a reanimated scrollY SharedValue, computed on the UI thread):
 *  - at top: transparent background, no hairline, large title visible
 *  - on scroll: background fills (translucent surface), bottom hairline + shadow
 *    appear, large title collapses and the compact title fades into the bar.
 *
 * Usage:
 *   const { scrollY, onScroll } = useStickyScroll();
 *   <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}
 *     contentContainerStyle={{ paddingTop: useHeaderHeight({ largeTitle: true }) }}>
 *   <StickyHeader scrollY={scrollY} mode="brand" largeTitle="Hi, Mina" search bell />
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
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { color as C, font, shadow } from '@/lib/theme';
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

/** Expanded header height — use as ScrollView contentContainer paddingTop. */
export function useHeaderHeight({ largeTitle }: { largeTitle?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  return headerHeight(insets, !!largeTitle);
}

export function headerHeight(insets: EdgeInsets, hasLarge: boolean) {
  return insets.top + 8 + BAR_H + (hasLarge ? LARGE_H : 0) + 12;
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
  const topPad = insets.top + 8;

  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 22], [0, 1], Extrapolation.CLAMP),
  }));
  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [8, 38], [0, 1], Extrapolation.CLAMP),
  }));
  const compactTitleStyle = useAnimatedStyle(() => {
    // back-mode title is always visible; with a large title it fades in on collapse
    const from = largeTitle ? COLLAPSE * 0.55 : 0;
    const to = largeTitle ? COLLAPSE : 1;
    return { opacity: interpolate(scrollY.value, [from, to], [largeTitle ? 0 : 1, 1], Extrapolation.CLAMP) };
  });
  const largeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE * 0.7], [1, 0], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [0, COLLAPSE], [LARGE_H, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, COLLAPSE], [0, -10], Extrapolation.CLAMP) },
    ],
  }));

  const compactTitle = title ?? largeTitle;

  return (
    <View style={[styles.root, { paddingTop: topPad }]} pointerEvents="box-none">
      {/* animated translucent fill + shadow */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, shadow.sh1, bgStyle]} />
      <Animated.View style={[styles.hairline, hairlineStyle]} />

      {/* top bar row */}
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

        {/* compact title — centered for back mode, fades in for brand+large */}
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

      {/* large collapsing title */}
      {largeTitle != null && (
        <Animated.View style={[styles.largeWrap, largeStyle]}>
          <Text numberOfLines={1} style={styles.largeTitle}>
            {largeTitle}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  fill: { backgroundColor: 'rgba(252,245,239,0.92)' },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.hair,
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
    ...shadow.sh1,
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
});

export default StickyHeader;
