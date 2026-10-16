import * as React from 'react';
import { AccessibilityInfo, AppState, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Btn } from '@/components/Btn';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { FlameShape } from '@/components/FlameShape';
import { QuotaBurstParticle } from '@/components/CountdownBadge';
import { IconClose } from '@/components/icons';
import { color as C, font } from '@/lib/theme';
import { consumeUnlock, getUnlockSnapshot, isUnlockEventCurrent, markUnlockPresented, subscribeUnlock, type UnlockEvent } from './unlockCelebrationStore';

/** Mounted inside scan's native screen, and at the app host for ordinary routes. */
export function UnlockCelebration({ eligible, onStartScanning }: { eligible: boolean; onStartScanning?: () => void }) {
  const state = React.useSyncExternalStore(subscribeUnlock, getUnlockSnapshot, getUnlockSnapshot);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [active, setActive] = React.useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = React.useState(true);
  const [closing, setClosing] = React.useState<{ event: UnlockEvent; start: boolean } | null>(null);
  const shown = React.useRef<number | null>(null);
  const actionTaken = React.useRef<number | null>(null);
  const continued = React.useRef<number | null>(null);
  const burst = useSharedValue(0);
  const entrance = useSharedValue(1);
  const sheetMotion = useAnimatedStyle(() => ({ opacity: entrance.value, transform: [{ translateY: (1 - entrance.value) * 40 }] }));
  const event = state.event;
  const visible = eligible && active && !state.blocked && event !== null && closing === null;
  React.useEffect(() => {
    const app = AppState.addEventListener('change', (value) => setActive(value === 'active'));
    let alive = true;
    let changed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive && !changed) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { changed = true; setReduceMotion(value); });
    return () => { alive = false; app.remove(); motion.remove(); };
  }, []);
  React.useEffect(() => {
    if (!visible || reduceMotion) { entrance.value = 1; return; }
    entrance.value = 0;
    entrance.value = withTiming(1, { duration: 550 });
    burst.value = 0;
    burst.value = withTiming(1, { duration: 700 });
    return () => { cancelAnimation(burst); cancelAnimation(entrance); };
  }, [visible, reduceMotion, burst, entrance]);
  React.useEffect(() => () => { if (shown.current !== null) consumeUnlock(shown.current); }, []);
  const afterDismiss = React.useCallback(() => {
    if (!closing || continued.current === closing.event.id) return;
    continued.current = closing.event.id;
    const canStart = closing.start && isUnlockEventCurrent(closing.event) && eligible && AppState.currentState === 'active';
    setClosing(null);
    if (canStart) onStartScanning?.();
  }, [closing, eligible, onStartScanning]);
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
      onShow={() => { if (event) { shown.current = event.id; markUnlockPresented(event.id); AccessibilityInfo.announceForAccessibility(t('scan.unlockedTitle')); } }}
      onDismiss={afterDismiss}>
      <View style={styles.root} accessibilityViewIsModal testID="unlock-celebration">
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
          <View style={[styles.hero, { paddingTop: insets.top + 60 }]} accessible={false} importantForAccessibility="no-hide-descendants">
            <View style={styles.flameFrame}><View style={styles.flameCanvas}><FlameShape state="active" scale={1.9} /></View></View>
            {!reduceMotion && visible && <Animated.View style={styles.burst} pointerEvents="none">
              {Array.from({ length: 12 }, (_, index) => <QuotaBurstParticle key={index} index={index} progress={burst} />)}
            </Animated.View>}
            <Svg width={110} height={42} viewBox="0 0 110 42"><Path d="M55 21C38-4 5 1 5 21S38 46 55 21C72-4 105 1 105 21S72 46 55 21" stroke={C.surface} strokeWidth={8} fill="none" /></Svg>
          </View>
          <Animated.View style={[styles.sheet, sheetMotion]}>
            <Text style={styles.title} accessibilityRole="header">{t('scan.unlockedTitle')}</Text>
            <Text style={styles.body}>{t('scan.unlockedBody')}</Text>
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
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryPress },
  scroll: { flexGrow: 1 },
  hero: { minHeight: 470, paddingBottom: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  flameFrame: { width: 216, height: 252, overflow: 'hidden', marginBottom: 16 },
  flameCanvas: { position: 'absolute', left: -29, top: -129 },
  burst: { position: 'absolute', top: 180, left: '50%', transform: [{ scale: 4 }] },
  sheet: { flexGrow: 1, backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 36, paddingHorizontal: 20, minHeight: 342 },
  title: { fontFamily: font.bodyBold, fontSize: 34, lineHeight: 46, color: C.ink, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 26, color: '#4B4F58', textAlign: 'center', marginTop: 8 },
  footer: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 32 },
  close: { position: 'absolute', left: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
