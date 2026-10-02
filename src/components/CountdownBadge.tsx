/**
 * CountdownBadge (KB-680, P-432) — 불꽃 안에 큰 숫자 + 단위. 호출부가 값을 넣는다(뱃지는 쿼터·타이머를 모른다).
 * 위치·노출 조건도 호출부 몫.
 * **계약(정직하게)**: 지금은 "드물게 줄어드는 작은 정수"(스캔 횟수 등)용이다. 값이 줄 때마다 팝·깜빡이 나서
 * 매초 줄어드는 시간 카운트다운엔 맞지 않고, "2:05" 같은 표기도 못 넣는다 — 시간에 쓰려면 감소 모션 끄기 prop과
 * 표시 문자열 prop이 필요하다(사용처가 생길 때 추가). 세 자리까지는 숫자가 축소 맞춤으로 한 줄에 들어간다.
 * 스펙 = spec specs/001-personalized-menu-mvp/countdown-badge-2026-10-02.md (시안 D-21 전 프로토타입).
 *
 * - 크기 고정(BADGE_W×BADGE_H) — 글자 배율·단위 길이가 바뀌어도 프레임 불변(단위는 1줄 + 축소 맞춤).
 * - active ↔ empty는 불꽃 색만 바뀐다(P-151 — 메트릭 불변).
 * - 모션(reanimated만): 대기 펄스(화면 포커스·포그라운드·동작 줄이기 꺼짐일 때만 반복) · 값이 줄면 숫자 팝 + 불꽃 1회
 *   깜빡 · `celebrate`가 켜지면 폭죽 1회 후 사라지고 `onCelebrateEnd`(JS 타이머 — 애니메이션 완료 콜백 없음). 동작 줄이기 = 정지 화면, 폭죽 없이 바로 종료.
 * - UI 스레드 코드 = useAnimatedStyle 3개(공유값·숫자 상수만 읽음, JS 함수 호출 0) + 선언형 withTiming/withRepeat/withSequence/withSpring.
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Txt as Text } from '@/components/Txt';
import { FlameShape } from '@/components/FlameShape';
import { useMotionState } from '@/lib/useMotionPaused';
import { spring } from '@/lib/motion';
import { color as C, font, shadow, type as type_ } from '@/lib/theme';

export const BADGE_W = 64;
export const BADGE_H = 72;
const PARTICLES = 12;
const BURST_MS = 700;
/** 폭죽 종료 = JS 타이머(애니메이션 길이 + 여유). 완료 콜백(runOnJS)을 쓰지 않아 워클릿→JS 경계 0(P-065/P-131 취지). */
export const CELEBRATE_END_MS = BURST_MS + 100;

export interface CountdownBadgeProps {
  value: number;
  unitLabel: string;
  state: 'active' | 'empty';
  onPress: () => void;
  /** false → true 전환 시 폭죽 1회(값이 "끝"이 아니라 "해제"될 때) */
  celebrate?: boolean;
  onCelebrateEnd?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function CountdownBadge({ value, unitLabel, state, onPress, celebrate = false, onCelebrateEnd, accessibilityLabel, testID = 'countdown-badge' }: CountdownBadgeProps) {
  // 판정 한 벌(useMotionState) — paused = blur·background·동작 줄이기(미확인 포함), reduceMotion = 확정값
  const { paused, visible, reduceMotion } = useMotionState();
  const still = reduceMotion !== false; // 동작 줄이기 켜짐·미확인 = 팝·폭죽 없음
  const pulse = useSharedValue(1);
  const pop = useSharedValue(1);
  const flicker = useSharedValue(1);
  const burst = useSharedValue(0);

  // 대기 펄스 — 반복은 포커스·포그라운드·동작 줄이기 꺼짐일 때만
  React.useEffect(() => {
    if (paused || state !== 'active' || celebrate) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withSequence(withTiming(1.05, { duration: 900 }), withTiming(1, { duration: 900 })), -1);
    return () => cancelAnimation(pulse);
  }, [paused, state, celebrate, pulse]);

  // 값 감소 = 숫자 팝 + 불꽃 1회 깜빡(증가·첫 렌더는 무반응). 화면이 가려진 동안(스캔 화면) 줄었으면 보일 때 1회
  const prevValue = React.useRef(value);
  const pendingPop = React.useRef(false);
  React.useEffect(() => {
    if (value < prevValue.current) pendingPop.current = true;
    prevValue.current = value;
    if (!pendingPop.current || !visible) return;
    pendingPop.current = false;
    if (still) return;
    pop.value = withSequence(withTiming(1.3, { duration: 120 }), withSpring(1, spring.pop));
    flicker.value = withSequence(withTiming(0.45, { duration: 120 }), withTiming(1, { duration: 200 }));
  }, [value, visible, still, pop, flicker]);

  // 해제 축하 — 폭죽(선언형 withTiming, 콜백 없음) 후 퇴장은 JS 타이머. 언마운트·재트리거·동작 줄이기 전환 = cleanup으로 정리
  const endRef = React.useRef(onCelebrateEnd);
  React.useLayoutEffect(() => {
    endRef.current = onCelebrateEnd;
  });
  // 시작은 **화면이 보일 때**(공부 #221 지적 1): 무제한 전환은 리뷰 작성 화면에서 일어나 홈이 가려진 채 감지된다 —
  // 안 보이는 동안은 마지막 숫자를 든 채 대기, 보이면 1회. blur·background로 중단되면 cleanup이 타이머 해제 → 다시 보일 때 처음부터.
  // 동작 줄이기: 미확인(null) = **기다림**(KB-699 #229 — 막 마운트된 뱃지가 미확인이라 축하를 즉시 끝내 폭죽이 유실됐다). 조회가 끝나면
  // 반드시 boolean(실패 = true)으로 바뀌어 깨운다. 켜짐(true) = 폭죽 없이 즉시 종료(공부 #221 재확인 ②의 "대기 고착 금지"는 실패 = true로 유지).
  const showBurst = celebrate && visible && reduceMotion === false;
  React.useEffect(() => {
    if (!celebrate || !visible || reduceMotion === null) return;
    if (reduceMotion) {
      endRef.current?.();
      return;
    }
    burst.value = 0;
    burst.value = withTiming(1, { duration: BURST_MS });
    const timer = setTimeout(() => endRef.current?.(), CELEBRATE_END_MS);
    return () => clearTimeout(timer);
  }, [celebrate, visible, reduceMotion, burst]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value * (1 + burst.value * 0.15) }],
    opacity: flicker.value * (1 - burst.value),
  }));
  const numStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Pressable
      onPress={onPress}
      disabled={celebrate}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.root}
      testID={testID}
    >
      <Animated.View style={[styles.body, bodyStyle]}>
        <FlameShape width={BADGE_W} height={BADGE_H} state={state} />
        <View style={styles.label} pointerEvents="none">
          <Animated.View style={numStyle}>
            <Text style={styles.num} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} testID={`${testID}-value`}>
              {value}
            </Text>
          </Animated.View>
          <Text style={styles.unit} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {unitLabel}
          </Text>
        </View>
      </Animated.View>
      {showBurst && Array.from({ length: PARTICLES }, (_, i) => <Particle key={i} index={i} progress={burst} />)}
    </Pressable>
  );
}

const PARTICLE_COLORS = [C.primary, C.primary2, C.accent];

function Particle({ index, progress }: { index: number; progress: { value: number } }) {
  const angle = (index / PARTICLES) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const d = 18 + progress.value * 30;
    return {
      opacity: 1 - progress.value,
      transform: [{ translateX: Math.cos(angle) * d }, { translateY: Math.sin(angle) * d }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.particle, { backgroundColor: PARTICLE_COLORS[index % PARTICLE_COLORS.length] }, style]} />;
}

const styles = StyleSheet.create({
  // 크기 고정 = 상태·글자 배율과 무관한 프레임(P-151)
  root: { width: BADGE_W, height: BADGE_H, alignItems: 'center', justifyContent: 'center' },
  body: { width: BADGE_W, height: BADGE_H, ...shadow.sh2 },
  label: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingTop: 14, paddingHorizontal: 10 },
  num: { maxWidth: BADGE_W - 20, fontFamily: font.display, fontSize: type_.sectionTitle.fontSize, color: C.surface, includeFontPadding: false },
  unit: { fontFamily: font.bodyBold, fontSize: type_.tabLabel.fontSize, color: C.surface, maxWidth: BADGE_W - 20 },
  particle: { position: 'absolute', width: 6, height: 6, borderRadius: 3, top: BADGE_H / 2 - 3, left: BADGE_W / 2 - 3 },
});

export default CountdownBadge;
