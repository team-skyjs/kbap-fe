/**
 * StickyHeader — the ONE shared hide-on-scroll header (handoff §6, Blind pattern).
 *
 * Overlay-fixed at the top (absolute); content flows beneath (screens pad content
 * by useHeaderHeight()). Scroll DOWN → header slides up and hides; scroll UP →
 * shows immediately; at the very top it's always shown. Driven by a reanimated
 * `hidden` value (0 shown → 1 hidden) via transform: translateY + withTiming.
 * A small delta threshold prevents jitter. Compact only (no large-title collapse):
 * always solid background + bottom hairline/shadow while visible.
 *
 * Usage:
 *   const { onScroll, hidden } = useStickyScroll();
 *   const headerH = useHeaderHeight();
 *   <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}
 *     contentContainerStyle={{ paddingTop: headerH }} />
 *   <StickyHeader hidden={hidden} mode="brand" search bell />   // rendered AFTER the ScrollView
 */
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font, shadow } from '@/lib/theme';
import { IconArrowLeft, IconBell, IconBookmark, IconSearch } from './icons';

const BAR_H = 48;
const TOP_PAD = 8;
const BOT_PAD = 6;
const DELTA = 7; // §6: 6~8px jitter threshold
const TOP_ALWAYS = 8; // within this of the top → always shown
const TIMING = { duration: 200, easing: Easing.out(Easing.quad) };

export function headerHeight(topInset: number) {
  return topInset + TOP_PAD + BAR_H + BOT_PAD;
}
export function useHeaderHeight() {
  return headerHeight(useSafeAreaInsets().top);
}

export function useStickyScroll() {
  const lastY = useSharedValue(0);
  const shown = useSharedValue(1); // discrete target: 1 shown, 0 hidden
  const hidden = useSharedValue(0); // animated: 0 shown → 1 hidden
  const onScroll = useAnimatedScrollHandler((e) => {
    const y = Math.max(0, e.contentOffset.y);
    const dy = y - lastY.value;
    if (y < TOP_ALWAYS) {
      if (shown.value !== 1) {
        shown.value = 1;
        hidden.value = withTiming(0, TIMING);
      }
    } else if (dy > DELTA) {
      if (shown.value !== 0) {
        shown.value = 0;
        hidden.value = withTiming(1, TIMING);
      }
    } else if (dy < -DELTA) {
      if (shown.value !== 1) {
        shown.value = 1;
        hidden.value = withTiming(0, TIMING);
      }
    }
    lastY.value = y;
  });
  return { onScroll, hidden };
}

export type StickyHeaderProps = {
  hidden: SharedValue<number>;
  mode?: 'brand' | 'back';
  title?: string;
  titleKo?: string; // optional bilingual KO subtitle rendered beside the title
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
  hidden,
  mode = 'brand',
  title,
  titleKo,
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
  const H = headerHeight(insets.top);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(hidden.value, [0, 1], [0, -H], Extrapolation.CLAMP) }],
  }));

  return (
    <Animated.View style={[styles.root, { height: H, paddingTop: insets.top + TOP_PAD }, slide]}>
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

        {title != null && (
          <View style={styles.titleWrap} pointerEvents="none">
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            {titleKo != null && (
              <Text numberOfLines={1} style={styles.titleKo}>
                {titleKo}
              </Text>
            )}
          </View>
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

      <View style={styles.hairline} />
    </Animated.View>
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
    backgroundColor: C.surface, // always solid while visible (§6)
    ...shadow.sh1, // always a subtle bottom shadow (--sh-1)
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
  titleWrap: {
    position: 'absolute',
    left: 52,
    right: 52,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    textAlign: 'center',
    fontFamily: font.display,
    fontSize: 18,
    color: C.ink,
  },
  titleKo: { fontFamily: font.koBold, fontSize: 12.5, color: C.ink3 },
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
