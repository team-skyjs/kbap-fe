/**
 * StickyHeader — the ONE shared hide-on-scroll header (handoff §6, Blind pattern).
 *
 * Overlay-fixed at the top (absolute); content flows beneath (screens pad content
 * by useHeaderHeight()). Scroll DOWN → header slides up and hides; scroll UP →
 * shows immediately; at the very top it's always shown. Driven by a reanimated
 * `hidden` value (0 shown → 1 hidden) via transform: translateY + withTiming (P-047 복귀).
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
  Easing,
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
import { IconArrowLeft, IconSearch, IconStar } from './icons'; // P-129: 상세 저장 = 별
import { BrandLockup } from './Brand';
import { PressScale } from './PressScale';

const BAR_H = 48;
const TOP_PAD = 8;
const BOT_PAD = 6;
const DELTA = 7; // §6: 6~8px jitter threshold
const TOP_ALWAYS = 8; // within this of the top → always shown
// P-047(KB-217): 숨김/복귀는 timing **복귀** — P-031이 스프링으로 바꾼 뒤, 빠른
// 방향 반복 스크롤에서 재타겟마다 미정착 속도를 승계해 이상 진동(멘토링 실기).
// 스크롤 크롬은 즉답이 우선(절제 원칙) — 고정 200ms ease-out이 정답. 북마크
// 팝(제스처 모멘텀)의 스프링은 유지.
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
  /** 게스트일 때 우측 Sign in pill (KB-78, guest-access-policy §1 헤더) */
  signIn?: boolean;
  onSignIn?: () => void;
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
  signIn,
  onSignIn,
  bookmark,
  bookmarkSaved,
  onBack,
  onSearch,
  onBookmark,
}: StickyHeaderProps) {
  const insets = useSafeAreaInsets();
  const H = headerHeight(insets.top);

  // P-061④: 알림 UI 전면 제거(MVP 제외 확정) — 벨·패널·게이트 소멸

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
          <PressScale style={styles.iconBtn} onPress={onBack} hitSlop={8}>
            <IconArrowLeft size={20} color={C.ink} />
          </PressScale>
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
            <PressScale style={styles.actionBtn} onPress={onSearch} hitSlop={10}>
              <IconSearch size={23} color={C.ink} sw={1.8} />
            </PressScale>
          )}
          {signIn && (
            <PressScale style={styles.signInPill} onPress={onSignIn} hitSlop={8}>
              <Text style={styles.signInText}>Sign in</Text>
            </PressScale>
          )}
          {bookmark && (
            /* 디자인(Bookmark Mods B): 흰 칩 없이 bare 아이콘 — search/bell과 동일 처리.
               unsaved=아웃라인, saved=primary 채움 */
            <PressScale style={styles.actionBtn} onPress={onBookmark} hitSlop={8}>
              <Animated.View style={bmPop}>
                {bookmarkSaved ? (
                  <IconStar size={22} color={C.primary} fill={C.primary} sw={0} />
                ) : (
                  <IconStar size={22} color={C.ink} sw={1.8} />
                )}
              </Animated.View>
            </PressScale>
          )}
          {mode === 'back' && !search && !bookmark && <View style={{ width: 38 }} />}
        </View>
      </View>

      <View style={styles.hairline} />
    </Animated.View>
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
