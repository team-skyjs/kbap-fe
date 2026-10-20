import * as React from 'react';
import { AccessibilityInfo, AppState, Modal, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Btn } from '@/components/Btn';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { FlameShape } from '@/components/FlameShape';
import { IconClose } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { useVersionGate } from '@/lib/versionGate';
import { InfinityMark, PARTICLE_MS, ParticleBurst, ShockRing, StaggerTitle, titleWords, WORD_MS, WORD_STAGGER_MS } from './celebrationMotion';
import { consumeUnlock, getUnlockSnapshot, isUnlockEventCurrent, markUnlockPresented, subscribeUnlock, type UnlockEvent } from './unlockCelebrationStore';

/** Mounted inside scan's native screen, and at the app host for ordinary routes. */
/** onDismissed = the native modal is fully gone (iOS onDismiss / Android next task) — for hosts that serialize other modals. */
export function UnlockCelebration({ eligible, onStartScanning, onClosed, onDismissed }: { eligible: boolean; onStartScanning?: () => void; onClosed?: () => void; onDismissed?: () => void }) {
  const state = React.useSyncExternalStore(subscribeUnlock, getUnlockSnapshot, getUnlockSnapshot);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [active, setActive] = React.useState(AppState.currentState === 'active');
  // QA P-489 home: the async isReduceMotionEnabled() lookup could stay unresolved for the app-start host, leaving the
  // "unknown = static" default on. Reanimated reads the system setting synchronously at startup; live toggles come from the event.
  const systemReduced = useReducedMotion();
  const [changedTo, setChangedTo] = React.useState<boolean | null>(null);
  const reduceMotion = changedTo ?? systemReduced;
  const [closing, setClosing] = React.useState<{ event: UnlockEvent; start: boolean } | null>(null);
  const shown = React.useRef<number | null>(null);
  const actionTaken = React.useRef<number | null>(null);
  const continued = React.useRef<number | null>(null);
  // KB-819 등장 시퀀스 — 쉬는 값 = 시작 포즈(0). 각 값 0→1(wobble만 각도).
  const flameIn = useSharedValue(0);
  const wobble = useSharedValue(0);
  const glowIn = useSharedValue(0);
  const particles = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const infIn = useSharedValue(0);
  const infDraw = useSharedValue(0);
  const sheetIn = useSharedValue(0);
  const titleIn = useSharedValue(0);
  const bodyIn = useSharedValue(0);
  const btnIn = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const flicker = useSharedValue(0);
  const breath = useSharedValue(0);
  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameIn.value }, { scaleY: 1 + 0.03 * flicker.value }, { rotate: `${wobble.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowIn.value * (0.8 + 0.2 * flicker.value) }));
  const sheetMotion = useAnimatedStyle(() => ({ opacity: Math.min(1, sheetIn.value * 3), transform: [{ translateY: (1 - sheetIn.value) * 140 }] }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: bodyIn.value }));
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.9 + 0.1 * btnIn.value }] }));
  const [btnW, setBtnW] = React.useState(0);
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value > 0 && shimmer.value < 1 ? 1 : 0,
    transform: [{ translateX: -80 + (btnW + 160) * shimmer.value }, { skewX: '-20deg' }],
  }));
  const event = state.event;
  // Native Modal sits above the in-tree hard update gate; never cover it (Codex #291 P2). The event stays pending.
  const gateBlocked = useVersionGate().mode === 'blocked';
  const visible = eligible && active && !gateBlocked && !state.blocked && event !== null && closing === null;
  React.useEffect(() => {
    const app = AppState.addEventListener('change', (value) => setActive(value === 'active'));
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setChangedTo);
    return () => { app.remove(); motion.remove(); };
  }, []);
  // iOS presents the Modal only after the rewarded ad screen finishes dismissing, so the clock starts at onShow, not at visible.
  const [onScreen, setOnScreen] = React.useState(false);
  if (!visible && onScreen) setOnScreen(false);
  // QA P-489 Android G2 (home): starting at visible ran the timing while the dialog window was not drawing yet (start pose,
  // then a jump to the end). Android starts after the content's first layout + one frame; onShow stays as the fallback.
  const markPainted = () => {
    if (Platform.OS === 'android' && visible && !onScreen) requestAnimationFrame(() => setOnScreen(true));
  };
  // The dialog content's first layout can be shorter than the screen (home tab bar showed through) — cover it from frame one.
  const screenH = useWindowDimensions().height;
  // QA E2: the Modal's first frame reads whatever the value is at rest, so the hidden value is already the starting pose
  // (0, or 1 under Reduce Motion) — resetting after visible flips is one frame late.
  const started = visible && onScreen;
  const title = t('scan.unlockedCelebrationTitle');
  const titleMs = WORD_MS + WORD_STAGGER_MS * (titleWords(title).length - 1);
  React.useEffect(() => {
    const all = [flameIn, wobble, glowIn, particles, ring1, ring2, infIn, infDraw, sheetIn, titleIn, bodyIn, btnIn, shimmer, flicker, breath];
    if (!started || reduceMotion) {
      // 시작 포즈(숨김) 또는 Reduce Motion = 최종 상태 즉시(루프·파티클·링·shimmer 없음)
      const end = reduceMotion ? 1 : 0;
      for (const v of all) v.set(end);
      wobble.set(0); flicker.set(0); breath.set(0);
      if (reduceMotion) { particles.set(0); ring1.set(0); ring2.set(0); shimmer.set(0); }
      return;
    }
    // t=0 = 모달 첫 그리기(iOS onShow · Android onLayout+rAF). 시간은 발주 P-493 §3.
    // QA P-493 R4: 스프링(damping 9)은 1.58×→0.66×→1.19× 감쇠 진동(≈0.95s 주기) — "뽱" 한 번만: 1.15까지 넘쳤다가 1로 안착, 총 450ms, 진동 0
    flameIn.set(withSequence(...FLAME_POP.map(({ to, ms }) => withTiming(to, { duration: ms, easing: Easing.out(Easing.quad) }))));
    wobble.set(withSequence(withTiming(-6, { duration: 150 }), withTiming(4, { duration: 150 }), withTiming(0, { duration: 150 })));
    glowIn.set(withTiming(1, { duration: 450 }));
    particles.set(withDelay(150, withTiming(1, { duration: PARTICLE_MS, easing: Easing.linear })));
    ring1.set(withDelay(150, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })));
    ring2.set(withDelay(270, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })));
    // QA P-493 R5: ∞ 스프링도 ≈1.5×까지 넘쳤다 — 불꽃과 같은 1회 팝 키프레임(stroke 그리기 420ms는 그대로)
    infIn.set(withDelay(350, withSequence(...FLAME_POP.map(({ to, ms }) => withTiming(to, { duration: ms, easing: Easing.out(Easing.quad) })))));
    infDraw.set(withDelay(350, withTiming(1, { duration: 420 })));
    sheetIn.set(withDelay(500, withSpring(1, { damping: 16, stiffness: 160 }))); // 가벼운 오버슈트
    titleIn.set(withDelay(500, withTiming(1, { duration: titleMs })));
    bodyIn.set(withDelay(500, withTiming(1, { duration: 250 })));
    btnIn.set(withDelay(800, withSpring(1, { damping: 10, stiffness: 220 })));
    shimmer.set(withDelay(800, withTiming(1, { duration: 600 })));
    flicker.set(withDelay(900, withRepeat(withTiming(1, { duration: 600 }), -1, true)));
    breath.set(withDelay(900, withRepeat(withTiming(1, { duration: 1200 }), -1, true)));
    return () => { for (const v of all) cancelAnimation(v); };
  }, [started, reduceMotion, titleMs, flameIn, wobble, glowIn, particles, ring1, ring2, infIn, infDraw, sheetIn, titleIn, bodyIn, btnIn, shimmer, flicker, breath]);
  // 작은 화면·큰 글씨에서 Done이 스크롤 없이 보이게 — 히어로가 남는 높이에 맞춰 불꽃 묶음을 줄인다(최소 0.7)
  // QA P-493 iOS L1: 시트 슬라이드·스태거 중 onLayout이 다시 와 k가 출렁였다(불꽃·∞ 0.6배↔1배) — 표시 1회당 첫 측정값으로 고정.
  const [sheetH, setSheetH] = React.useState(0);
  if (!visible && sheetH !== 0) setSheetH(0); // 다음 표시에서 다시 1회 측정
  const measureSheet = (h: number) => { if (sheetH === 0 && h > 0) setSheetH(h); };
  const heroAvail = screenH - sheetH - insets.top - HERO_PAD_TOP - HERO_PAD_BOTTOM;
  const k = sheetH > 0 ? Math.min(1, Math.max(0.7, heroAvail / HERO_CONTENT_H)) : 1;
  React.useEffect(() => () => { if (shown.current !== null) consumeUnlock(shown.current); }, []);
  // Codex #291 R9: a dismissal that lands while the app is inactive keeps its continuation until the app is active again (once).
  const deferred = React.useRef<{ event: UnlockEvent; start: boolean } | null>(null);
  const afterDismiss = React.useCallback(() => {
    if (!closing || continued.current === closing.event.id) return;
    continued.current = closing.event.id;
    onDismissed?.();
    const current = isUnlockEventCurrent(closing.event) && eligible;
    setClosing(null);
    if (!current) return;
    if (AppState.currentState !== 'active') { deferred.current = closing; return; }
    if (closing.start) onStartScanning?.();
    else onClosed?.();
  }, [closing, eligible, onStartScanning, onClosed, onDismissed]);
  React.useEffect(() => {
    const held = deferred.current;
    if (!held || !active) return;
    deferred.current = null;
    if (!isUnlockEventCurrent(held.event) || !eligible) return;
    if (held.start) onStartScanning?.();
    else onClosed?.();
  }, [active, eligible, onStartScanning, onClosed]);
  React.useEffect(() => {
    if (!closing || Platform.OS === 'ios') return;
    // Android has no Modal.onDismiss. No animation means the native window is removed before this task.
    const timer = setTimeout(afterDismiss, 0);
    return () => clearTimeout(timer);
  }, [closing, afterDismiss]);
  const dismiss = (start: boolean) => {
    if (!event || actionTaken.current === event.id) return;
    actionTaken.current = event.id;
    const taken = consumeUnlock(event.id);
    if (taken) setClosing({ event: taken, start });
  };
  const scanAction = event?.context === 'scan' && onStartScanning != null;
  return (
    <Modal visible={visible} animationType="none" presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={() => dismiss(false)}
      onShow={() => { setOnScreen(true); if (event) { shown.current = event.id; markUnlockPresented(event.id); AccessibilityInfo.announceForAccessibility(title); } }}
      onDismiss={afterDismiss}>
      <View style={[styles.root, { minHeight: screenH }]} onLayout={markPainted} accessibilityViewIsModal testID="unlock-celebration">
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
          <View style={[styles.hero, { paddingTop: insets.top + HERO_PAD_TOP }]} accessible={false} importantForAccessibility="no-hide-descendants">
            <View style={{ width: FLAME_FRAME.w * k, height: FLAME_FRAME.h * k, marginBottom: 16 * k }} testID="unlock-flame-anchor">
              <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none">
                <Svg width="100%" height="100%" viewBox="0 0 100 100">
                  <Defs>
                    <RadialGradient id="celebrationGlow" cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor="#FFE9A8" stopOpacity={0.9} />
                      <Stop offset="1" stopColor="#FFE9A8" stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Circle cx={50} cy={50} r={50} fill="url(#celebrationGlow)" />
                </Svg>
              </Animated.View>
              {!reduceMotion && visible && <>
                <ShockRing progress={ring1} size={120 * k} testID="unlock-ring-1" />
                <ShockRing progress={ring2} size={120 * k} testID="unlock-ring-2" />
              </>}
              <Animated.View style={[styles.flameFrame, flameStyle]}>
                <View style={{ position: 'absolute', left: -29 * k, top: -129 * k }}><FlameShape state="active" scale={1.9 * k} /></View>
              </Animated.View>
              {!reduceMotion && visible && <ParticleBurst progress={particles} />}
            </View>
            <InfinityMark draw={infDraw} scaleIn={infIn} breath={breath} scale={k} />
          </View>
          <Animated.View style={[styles.sheet, sheetMotion]} onLayout={(e) => measureSheet(e.nativeEvent.layout.height)} testID="unlock-sheet">
            <StaggerTitle title={title} progress={titleIn} style={styles.title} />
            <Animated.View style={bodyStyle}><Text style={styles.body}>{t('scan.unlockedCelebrationBody')}</Text></Animated.View>
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <Animated.View style={[styles.btnWrap, btnStyle]} onLayout={(e) => setBtnW(e.nativeEvent.layout.width)}>
                <Btn testID="unlock-celebration-action" onPress={() => dismiss(scanAction)}>{t(scanAction ? 'scan.startScanning' : 'review.done')}</Btn>
                {!reduceMotion && <Animated.View style={[styles.shimmer, shimmerStyle]} pointerEvents="none" testID="unlock-shimmer" />}
              </Animated.View>
            </View>
          </Animated.View>
        </ScrollView>
        <Pressable testID="unlock-celebration-close" accessibilityRole="button" accessibilityLabel={t('common.close')}
          onPress={() => dismiss(false)} style={[styles.close, { top: insets.top + 8 }]}><IconClose size={24} color={C.surface} /></Pressable>
      </View>
    </Modal>
  );
}
export const FLAME_FRAME = { w: 216, h: 252 } as const;
/** 불꽃·∞ 팝 키프레임 — 0 → 1.15(220ms) → 1(230ms). 스프링 없이 한 번만 넘친다(진동 0). */
export const FLAME_POP = [{ to: 1.15, ms: 220 }, { to: 1, ms: 230 }] as const;
const HERO_PAD_TOP = 24;
const HERO_PAD_BOTTOM = 32;
/** 히어로 묶음 높이(배율 1) = 불꽃 프레임 + 간격 16 + 무한 기호 42 */
const HERO_CONTENT_H = FLAME_FRAME.h + 16 + 42;
const styles = StyleSheet.create({
  // QA P-493 Android N1: 루트는 첫 프레임부터 불투명 주황 — 페이드하면 Dialog 창이 그 사이 흰색으로 비친다(0.36s 흰 플래시)
  root: { flex: 1, backgroundColor: C.primaryPress },
  scroll: { flexGrow: 1 },
  // KB-819: 히어로가 남는 높이를 차지(불꽃·무한 기호 중앙), 시트는 내용만큼 — 본문~Done 빈 공간 제거
  hero: { flex: 1, paddingBottom: HERO_PAD_BOTTOM, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glow: { position: 'absolute', left: '-15%', top: '-10%', width: '130%', height: '120%' },
  flameFrame: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 36, paddingHorizontal: 20 },
  title: { fontFamily: font.bodyBold, fontSize: 34, lineHeight: 46, color: C.ink, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 26, color: '#4B4F58', textAlign: 'center', marginTop: 8 },
  footer: { paddingTop: 24 },
  btnWrap: { overflow: 'hidden', borderRadius: 4 }, // Btn 반경(KB-429 radius xs 4)과 같게 — shimmer가 버튼 밖으로 안 샌다
  shimmer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 60, backgroundColor: 'rgba(255,255,255,0.35)' },
  close: { position: 'absolute', left: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
