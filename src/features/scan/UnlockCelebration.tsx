import * as React from 'react';
import { AccessibilityInfo, AppState, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Btn } from '@/components/Btn';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { FlameShape } from '@/components/FlameShape';
import { BADGE_H, BADGE_W, QuotaBurstParticle } from '@/components/CountdownBadge';
import { IconClose } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { useVersionGate } from '@/lib/versionGate';
import { consumeUnlock, getUnlockSnapshot, isUnlockEventCurrent, markUnlockPresented, subscribeUnlock, type UnlockEvent } from './unlockCelebrationStore';

/** Mounted inside scan's native screen, and at the app host for ordinary routes. */
export function UnlockCelebration({ eligible, onStartScanning, onClosed }: { eligible: boolean; onStartScanning?: () => void; onClosed?: () => void }) {
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
  const burst = useSharedValue(0);
  const entrance = useSharedValue(0);
  const sheetMotion = useAnimatedStyle(() => ({ opacity: entrance.value, transform: [{ translateY: (1 - entrance.value) * 40 }] }));
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
  // QA E2: the Modal's first frame reads whatever the value is at rest, so the hidden value is already the starting pose
  // (0, or 1 under Reduce Motion) — resetting after visible flips is one frame late.
  React.useEffect(() => {
    if (!visible || !onScreen || reduceMotion) {
      entrance.set(reduceMotion ? 1 : 0);
      burst.set(0);
      return;
    }
    entrance.set(withTiming(1, { duration: 550 }));
    burst.set(withTiming(1, { duration: 700 }));
    return () => { cancelAnimation(burst); cancelAnimation(entrance); };
  }, [visible, onScreen, reduceMotion, burst, entrance]);
  React.useEffect(() => () => { if (shown.current !== null) consumeUnlock(shown.current); }, []);
  const afterDismiss = React.useCallback(() => {
    if (!closing || continued.current === closing.event.id) return;
    continued.current = closing.event.id;
    const canContinue = isUnlockEventCurrent(closing.event) && eligible && AppState.currentState === 'active';
    setClosing(null);
    if (canContinue) {
      if (closing.start) onStartScanning?.();
      else onClosed?.();
    }
  }, [closing, eligible, onStartScanning, onClosed]);
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
    <Modal visible={visible} animationType="none" presentationStyle="fullScreen" onRequestClose={() => dismiss(false)}
      onShow={() => { setOnScreen(true); if (event) { shown.current = event.id; markUnlockPresented(event.id); AccessibilityInfo.announceForAccessibility(t('scan.unlockedCelebrationTitle')); } }}
      onDismiss={afterDismiss}>
      <View style={styles.root} accessibilityViewIsModal testID="unlock-celebration">
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
          <View style={[styles.hero, { paddingTop: insets.top + 60 }]} accessible={false} importantForAccessibility="no-hide-descendants">
            <View style={styles.flameAnchor}>
              <View style={styles.flameFrame}><View style={styles.flameCanvas}><FlameShape state="active" scale={1.9} /></View></View>
              {!reduceMotion && visible && <Animated.View style={styles.burst} pointerEvents="none" testID="unlock-celebration-burst">
                {Array.from({ length: 12 }, (_, index) => <QuotaBurstParticle key={index} index={index} progress={burst} />)}
              </Animated.View>}
            </View>
            <Svg width={110} height={42} viewBox="0 0 110 42"><Path d="M55 21C38-4 5 1 5 21S38 46 55 21C72-4 105 1 105 21S72 46 55 21" stroke={C.surface} strokeWidth={8} fill="none" /></Svg>
          </View>
          <Animated.View style={[styles.sheet, sheetMotion]}>
            <Text style={styles.title} accessibilityRole="header">{t('scan.unlockedCelebrationTitle')}</Text>
            <Text style={styles.body}>{t('scan.unlockedCelebrationBody')}</Text>
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <Btn testID="unlock-celebration-action" onPress={() => dismiss(scanAction)}>{t(scanAction ? 'scan.startScanning' : 'review.done')}</Btn>
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
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryPress },
  scroll: { flexGrow: 1 },
  hero: { minHeight: 470, paddingBottom: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  flameAnchor: { width: FLAME_FRAME.w, height: FLAME_FRAME.h, marginBottom: 16 },
  flameFrame: { width: FLAME_FRAME.w, height: FLAME_FRAME.h, overflow: 'hidden' },
  flameCanvas: { position: 'absolute', left: -29, top: -129 },
  // Particles orbit the badge's own center, so the wrapper takes the badge frame and that center sits on the flame frame's center (Codex #291 R4).
  burst: { position: 'absolute', width: BADGE_W, height: BADGE_H, left: (FLAME_FRAME.w - BADGE_W) / 2, top: (FLAME_FRAME.h - BADGE_H) / 2, transform: [{ scale: 4 }] },
  sheet: { flexGrow: 1, backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 36, paddingHorizontal: 20, minHeight: 342 },
  title: { fontFamily: font.bodyBold, fontSize: 34, lineHeight: 46, color: C.ink, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 26, color: '#4B4F58', textAlign: 'center', marginTop: 8 },
  footer: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 32 },
  close: { position: 'absolute', left: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
