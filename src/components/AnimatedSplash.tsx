/**
 * AnimatedSplash (P-288/KB-437) — JS 스플래시 오버레이(최종본 2200:20667 · 모션 A).
 * 네이티브 정지 마크(흰 배경, hideAsync 프레임)와 픽셀 일치 상태로 마운트 → 즉시 모션:
 *   그릇 ↑(0.05s 시작·0.55s) → K ↓ 오버슈트(0.30s·0.60s) → 점 팝(0.85s·0.35s) →
 *   문구 2줄 페이드(0.95s·0.50s) → 1.6s에 0.45s 페이드아웃(뒤 화면과 크로스페이드).
 * reduce-motion = 정지 표시 → 0.6s 후 페이드아웃. 4s 캡(bootGate 캡과 동일) — 안전망.
 * P-293: 페이드아웃은 max(최소 노출, ready) — 부트(entryChecked)가 늦으면 정지 유지.
 * 계측 없음. 문구는 브랜딩 텍스트(i18n 비대상 — 현 스플래시 규칙).
 */
import * as React from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Txt as Text } from './Txt';

/** 모션 타이밍 정본(프로토타입 모션 A 수치 그대로) — 유닛 스냅샷 잠금. */
export const SPLASH_TIMING = {
  bowl: { delay: 50, dur: 550 }, // translateY 26→0 · ease-out
  k: { delay: 300, dur: 600 }, // translateY −34→0 · 오버슈트
  dot: { delay: 850, dur: 350 }, // scale .2→1
  tagline: { delay: 950, dur: 500 }, // translateY 8→0
  // P-298(9/7 예진): 최소 노출 3초 — 부팅이 빨라도 fadeOutAt 전엔 유지(ready와 AND).
  fadeOutAt: 3000,
  fadeOutDur: 450,
  reduceHold: 3000, // reduce-motion: 정지 3초 온전히 — ReducedMotionConfig(System)가 페이드를 즉시 끝내도 3s 보장(Codex #60 P2)
  cap: 4000, // bootGate 캡과 동일 — 어떤 경우에도 이 시점엔 언마운트
} as const;

const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
const EASE_OVERSHOOT = Easing.bezier(0.2, 0.9, 0.25, 1.25);
const EASE_POP = Easing.bezier(0.3, 1.6, 0.5, 1);

// P-291(KB-437): viewBox 정정 — K 획 라운드 캡(y −6.72)이 구 viewBox(0 0 … 88) 밖에서
// 잘려 상단이 평평하게 렌더(b24 실기). 스펙 splash-mark.svg 정정본과 동일 좌표계.
const MARK_W = 81.614;
const MARK_H = 94.719;
const MARK_VIEWBOX = '0 -6.72 81.614 94.719';

export function AnimatedSplash({
  active,
  ready = true,
  onDone,
}: {
  active: boolean;
  /** P-293: 부트 준비(entryChecked) — 페이드아웃 = max(최소 노출, ready). 전엔 정지 유지. */
  ready?: boolean;
  onDone: () => void;
}) {
  // null = 판정 전(콜라주 마퀴와 동일 — 알기 전엔 모션 시작 안 함)
  const [reduceMotion, setReduceMotion] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => setReduceMotion(!!v))
      .catch(() => setReduceMotion(false));
  }, []);

  const bowlY = useSharedValue(26);
  const bowlO = useSharedValue(0);
  const kY = useSharedValue(-34);
  const kO = useSharedValue(0);
  const dotS = useSharedValue(0.2);
  const dotO = useSharedValue(0);
  const tagY = useSharedValue(8);
  const tagO = useSharedValue(0);
  const overlayO = useSharedValue(1);

  // P-293: 최소 노출 경과(모션 1.6s / reduce 0.6s) — ready와 AND로 페이드아웃 시작
  const [minReached, setMinReached] = React.useState(false);
  const fading = React.useRef(false);
  const started = React.useRef(false);
  const doneRef = React.useRef(false);
  // P-296(Codex #52 P1): onDone은 ref 경유 — 부모 리렌더(인라인 콜백 새 정체성)가
  // finish 정체성을 바꾸면 모션 effect cleanup이 타이머·애니메이션을 도중 취소하고
  // started 가드로 재시작도 없어 스플래시가 멈췄다(느린 부팅에서 4s 캡까지 정지).
  const onDoneRef = React.useRef(onDone);
  onDoneRef.current = onDone;
  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }, []); // deps 0 — 정체성 고정(모션·캡·페이드 effect가 안정 의존)

  // 4s 캡 — 마운트 기준 안전망(모션·부팅과 무관하게 언마운트 보장)
  React.useEffect(() => {
    const cap = setTimeout(finish, SPLASH_TIMING.cap);
    return () => clearTimeout(cap);
  }, [finish]);

  React.useEffect(() => {
    if (!active || reduceMotion == null || started.current) return;
    started.current = true;
    const T = SPLASH_TIMING;
    if (reduceMotion) {
      // 정지 표시(전 요소 최종 상태) → reduceHold 후 페이드아웃
      bowlY.value = 0; bowlO.value = 1; kY.value = 0; kO.value = 1;
      dotS.value = 1; dotO.value = 1; tagY.value = 0; tagO.value = 1;
      const t = setTimeout(() => setMinReached(true), T.reduceHold);
      return () => clearTimeout(t);
    }
    bowlY.value = withDelay(T.bowl.delay, withTiming(0, { duration: T.bowl.dur, easing: EASE_OUT }));
    bowlO.value = withDelay(T.bowl.delay, withTiming(1, { duration: T.bowl.dur, easing: EASE_OUT }));
    kY.value = withDelay(T.k.delay, withTiming(0, { duration: T.k.dur, easing: EASE_OVERSHOOT }));
    kO.value = withDelay(T.k.delay, withTiming(1, { duration: T.k.dur, easing: EASE_OUT }));
    dotS.value = withDelay(T.dot.delay, withTiming(1, { duration: T.dot.dur, easing: EASE_POP }));
    dotO.value = withDelay(T.dot.delay, withTiming(1, { duration: T.dot.dur, easing: EASE_OUT }));
    tagY.value = withDelay(T.tagline.delay, withTiming(0, { duration: T.tagline.dur, easing: EASE_OUT }));
    tagO.value = withDelay(T.tagline.delay, withTiming(1, { duration: T.tagline.dur, easing: EASE_OUT }));
    // 종료: 1.6s 최소 노출 도달 표시 — 실제 페이드는 아래 effect(ready AND)
    const t = setTimeout(() => setMinReached(true), T.fadeOutAt);
    return () => {
      clearTimeout(t);
      for (const v of [bowlY, bowlO, kY, kO, dotS, dotO, tagY, tagO, overlayO]) cancelAnimation(v);
    };
  }, [active, reduceMotion, bowlY, bowlO, kY, kO, dotS, dotO, tagY, tagO, overlayO, finish]);

  // P-293: 페이드아웃 = 최소 노출(minReached) AND 부트 준비(ready) — ready가 늦으면
  // 마지막 프레임(정지)을 유지해 빈 화면 크로스페이드를 막는다. 4s 캡은 위 effect가 보장.
  React.useEffect(() => {
    if (!minReached || !ready || fading.current) return;
    fading.current = true;
    overlayO.value = withTiming(0, { duration: SPLASH_TIMING.fadeOutDur, easing: Easing.in(Easing.quad) }, () => runOnJS(finish)());
  }, [minReached, ready, overlayO, finish]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayO.value }));
  const bowlStyle = useAnimatedStyle(() => ({ opacity: bowlO.value, transform: [{ translateY: bowlY.value }] }));
  const kStyle = useAnimatedStyle(() => ({ opacity: kO.value, transform: [{ translateY: kY.value }] }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotO.value, transform: [{ scale: dotS.value }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tagO.value, transform: [{ translateY: tagY.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, overlayStyle]} pointerEvents="none" testID="animated-splash">
      {/* 마크 81.6×94.7 — 화면 정중앙(네이티브 contain 중앙과 픽셀 일치). 그릇/K 그룹 분리 애니 */}
      <View style={styles.mark}>
        <Animated.View style={[StyleSheet.absoluteFill, kStyle]}>
          <Svg width={MARK_W} height={MARK_H} viewBox={MARK_VIEWBOX}>
            <Path d="M6.026 0C6.026 -3.328 3.328 -6.026 0 -6.026C-3.328 -6.026 -6.026 -3.328 -6.026 0L0 0L6.026 0ZM-6.026 36.981C-6.026 40.309 -3.328 43.007 0 43.007C3.328 43.007 6.026 40.309 6.026 36.981L0 36.981L-6.026 36.981ZM0 0L-6.026 0L-6.026 36.981L0 36.981L6.026 36.981L6.026 0L0 0Z" fill="#000000" transform="matrix(1 0 0 1 25.504 0)" />
            <Path d="M25.666 4.518C28.161 2.317 28.399 -1.491 26.197 -3.987C23.995 -6.482 20.187 -6.72 17.692 -4.518L21.679 0L25.666 4.518ZM0 19.128L-3.987 14.61C-5.332 15.797 -6.079 17.522 -6.023 19.315C-5.967 21.108 -5.116 22.783 -3.7 23.885L0 19.128ZM19.254 41.738C21.881 43.781 25.667 43.308 27.711 40.681C29.754 38.054 29.28 34.268 26.654 32.225L22.954 36.981L19.254 41.738ZM21.679 0L17.692 -4.518L-3.987 14.61L0 19.128L3.987 23.647L25.666 4.518L21.679 0ZM0 19.128L-3.7 23.885L19.254 41.738L22.954 36.981L26.654 32.225L3.7 14.372L0 19.128Z" fill="#000000" transform="matrix(1 0 0 1 34.432 0)" />
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, bowlStyle]}>
          <Svg width={MARK_W} height={MARK_H} viewBox={MARK_VIEWBOX}>
            <Path d="M0 0L81.614 0C81.614 10.823 77.315 21.202 69.662 28.855C62.009 36.508 51.63 40.807 40.807 40.807C29.984 40.807 19.605 36.508 11.952 28.855C4.299 21.202 0 10.823 0 0Z" fill="#ff7134" fillRule="nonzero" transform="matrix(1 0 0 1 0 47.193)" />
          </Svg>
        </Animated.View>
      </View>
      {/* 문구 2줄 — 마크 아래 22pt, 중앙, gap 4. 1행 "K-FOOD" + 오렌지 점 5(baseline 위 1) */}
      <Animated.View style={[styles.tagline, tagStyle]}>
        <View style={styles.line1}>
          <Text style={styles.brand}>K-FOOD</Text>
          <Animated.View style={[styles.dot, dotStyle]} />
        </View>
        <Text style={styles.sub}>filtered for you</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
  mark: { width: MARK_W, height: MARK_H },
  tagline: { position: 'absolute', top: '50%', marginTop: MARK_H / 2 + 22, alignItems: 'center', gap: 4, alignSelf: 'center' },
  line1: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  brand: { fontSize: 16, fontWeight: '700', color: '#000000' },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FF7134', marginBottom: 3 }, // baseline 위 1pt
  sub: { fontSize: 16, fontWeight: '600', color: '#000000' },
});

export default AnimatedSplash;
