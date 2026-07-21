/**
 * StickyHeader — the ONE shared hide-on-scroll header (handoff §6, Blind pattern).
 *
 * Overlay-fixed at the top (absolute); content flows beneath (screens pad content
 * by useHeaderHeight()). Scroll DOWN → header slides up and hides; scroll UP →
 * shows immediately; at the very top it's always shown. Driven by a reanimated
 * `hidden` value (0 shown → 1 hidden) via transform: translateY + withSpring (P-031).
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
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font, shadow } from '@/lib/theme';
import { spring } from '@/lib/motion';
import { IconArrowLeft, IconBell, IconBookmark, IconSearch } from './icons';
import { BrandLockup } from './Brand';
import { NotificationsPanel } from './NotificationsPanel';
import { AuthGateSheet } from './AuthGateSheet';
import { useIsGuest } from '@/lib/auth/useSession';

const BAR_H = 48;
const TOP_PAD = 8;
const BOT_PAD = 6;
const DELTA = 7; // §6: 6~8px jitter threshold
const TOP_ALWAYS = 8; // within this of the top → always shown
// P-031(KB-206): 숨김/복귀 이동은 timing → damped 스프링 (spring.move, 바운스 0)

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
        hidden.value = withSpring(0, spring.move);
      }
    } else if (dy > DELTA) {
      if (shown.value !== 0) {
        shown.value = 0;
        hidden.value = withSpring(1, spring.move);
      }
    } else if (dy < -DELTA) {
      if (shown.value !== 1) {
        shown.value = 1;
        hidden.value = withSpring(0, spring.move);
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
  /** 게스트일 때 우측 Sign in pill (KB-78, guest-access-policy §1 헤더) */
  signIn?: boolean;
  onSignIn?: () => void;
  bellDot?: boolean;
  bookmark?: boolean;
  /** 북마크 저장 상태 — true면 primary로 채워진 아이콘 + 저장 전환 시 1회 바운스 */
  bookmarkSaved?: boolean;
  onBack?: () => void;
  onSearch?: () => void;
  onBookmark?: () => void;
};

export function StickyHeader({
  hidden,
  mode = 'brand',
  title,
  titleKo,
  search,
  bell,
  signIn,
  onSignIn,
  bellDot,
  bookmark,
  bookmarkSaved,
  onBack,
  onSearch,
  onBookmark,
}: StickyHeaderProps) {
  const insets = useSafeAreaInsets();
  const H = headerHeight(insets.top);

  // 멘토링 ③: 알림 동작을 헤더 안으로 — 화면마다 핸들러를 붙이다 빠진 탭에서
  // 종이 무반응이었다. 게스트=게이트 시트, 회원=알림 패널. 새 진입점도 자동 커버.
  const isGuest = useIsGuest();
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [gateOpen, setGateOpen] = React.useState(false);
  const onBell = () => (isGuest ? setGateOpen(true) : setNotifOpen(true));

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(hidden.value, [0, 1], [0, -H], Extrapolation.CLAMP) }],
  }));

  // 북마크 저장 팝 (P-032: timing 시퀀스 → 스프링 통일 — 움츠렸다 소량 바운스로
  // 채워지는 드롭인. 탭 모멘텀이 있어 spring.pop, reduced-motion 시 생략)
  const reducedMotion = useReducedMotion();
  const bmScale = useSharedValue(1);
  const prevSaved = React.useRef(bookmarkSaved);
  React.useEffect(() => {
    if (!prevSaved.current && bookmarkSaved && !reducedMotion) {
      bmScale.value = withSequence(
        withTiming(0.8, { duration: 60 }),
        withSpring(1, spring.pop),
      );
    }
    prevSaved.current = bookmarkSaved;
  }, [bookmarkSaved, reducedMotion, bmScale]);
  const bmPop = useAnimatedStyle(() => ({ transform: [{ scale: bmScale.value }] }));

  return (
    <>
    <Animated.View style={[styles.root, { height: H, paddingTop: insets.top + TOP_PAD }, slide]}>
      <View style={styles.bar}>
        {mode === 'back' ? (
          <Pressable style={styles.iconBtn} onPress={onBack} hitSlop={8}>
            <IconArrowLeft size={20} color={C.ink} />
          </Pressable>
        ) : (
          <BrandLockup />
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
            <Pressable style={styles.actionBtn} onPress={onSearch} hitSlop={10}>
              <IconSearch size={23} color={C.ink} sw={1.8} />
            </Pressable>
          )}
          {bell && (
            <Pressable style={styles.actionBtn} onPress={onBell} hitSlop={10}>
              <IconBell size={23} color={C.ink} sw={1.8} />
              {bellDot && <View style={styles.dot} />}
            </Pressable>
          )}
          {signIn && (
            <Pressable style={styles.signInPill} onPress={onSignIn} hitSlop={8}>
              <Text style={styles.signInText}>Sign in</Text>
            </Pressable>
          )}
          {bookmark && (
            /* 디자인(Bookmark Mods B): 흰 칩 없이 bare 아이콘 — search/bell과 동일 처리.
               unsaved=아웃라인, saved=primary 채움 */
            <Pressable style={styles.actionBtn} onPress={onBookmark} hitSlop={8}>
              <Animated.View style={bmPop}>
                {bookmarkSaved ? (
                  <IconBookmark size={22} color={C.primary} fill={C.primary} sw={0} />
                ) : (
                  <IconBookmark size={22} color={C.ink} sw={1.8} />
                )}
              </Animated.View>
            </Pressable>
          )}
          {mode === 'back' && !search && !bell && !bookmark && <View style={{ width: 38 }} />}
        </View>
      </View>

      <View style={styles.hairline} />
    </Animated.View>
    {bell && (
      <>
        <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
        <AuthGateSheet context="notifications" open={gateOpen} onClose={() => setGateOpen(false)} />
      </>
    )}
    </>
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  // bare line-icon action (search/bell) — no pill background, 40×40 tap target
  actionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInPill: { backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  signInText: { fontFamily: font.bodyBold, fontSize: 12.5, color: '#fff' },
  dot: {
    position: 'absolute',
    top: 6,
    right: 7,
    minWidth: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.riskDanger,
    borderWidth: 2,
    borderColor: C.surface,
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
