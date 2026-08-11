/**
 * ConfettiBurst (P-166/KB-309) — 주문 완료 축하 폭죽. 기존 reanimated 커스텀
 * 파티클(신규 의존 0 — Lottie/Skia는 vc10 2단계 후보). 상단 버스트 → 낙하+회전,
 * DURATION 후 자연 소멸(언마운트는 부모 타이머 몫 — usePop 참조).
 *
 * - 조각 = 색 도형 View(사각·원) — 이모지 0. 팔레트: primary·primary2·accent·amber
 *   계열만(위험도 4색 의미 예약이라 금지).
 * - pointerEvents="none" — 아래 확인 버튼 즉시 탭 가능.
 * - OS Reduce Motion = 스킵(null 렌더 — 기존 모션 줄이기 관례).
 * - 파티클 수는 상수 — 저사양 프레임 이슈 시 이 값만 조정.
 * ⚠️ P-065: 워클릿 신규 코드 — 실기기 확인 후 OTA 발행.
 */
import * as React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** 저사양 프레임 조정 노브 — 발주 40~60 범위. */
export const CONFETTI_COUNT = 48;
/** 자연 소멸 시간(발주 1.5~2초) — 부모 언마운트 타이머도 이 값 기준. */
export const CONFETTI_DURATION_MS = 1800;

/** 위험도 4색 미사용(의미 예약) — 브랜드·액센트 계열만. */
const PALETTE = ['#E2580C', '#E8893F', '#0E9AA7', '#D9A404', '#F2B94B'];

/** index 기반 결정적 의사난수(0..1) — 테스트 재현성 + Math.random 미사용. */
function rnd(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function Particle({ index, screenH, screenW }: { index: number; screenH: number; screenW: number }) {
  const p = useSharedValue(0);
  React.useEffect(() => {
    p.value = withTiming(1, { duration: CONFETTI_DURATION_MS, easing: Easing.out(Easing.quad) });
  }, [p]);

  const startX = rnd(index, 1) * screenW;
  const driftX = (rnd(index, 2) - 0.5) * screenW * 0.5;
  const fallH = screenH * (0.55 + rnd(index, 3) * 0.4);
  const rot = (rnd(index, 4) - 0.5) * 720;
  const size = 7 + rnd(index, 5) * 6;
  const color = PALETTE[index % PALETTE.length];
  const round = index % 3 === 0; // 원·사각 섞기

  const style = useAnimatedStyle(() => {
    'worklet';
    const t = p.value;
    return {
      transform: [
        { translateX: startX + driftX * t },
        { translateY: -30 + fallH * t * t }, // 가속 낙하
        { rotate: `${rot * t}deg` },
      ],
      opacity: t > 0.75 ? Math.max(0, (1 - t) * 4) : 1, // 말미 페이드 소멸
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        { width: size, height: size * (round ? 1 : 0.6), borderRadius: round ? size / 2 : 1.5, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function ConfettiBurst() {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  if (reduced) return null; // Reduce Motion — 폭죽 스킵(모달만)
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="confetti">
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
        <Particle key={i} index={i} screenH={height} screenW={width} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', top: 0, left: 0 },
});

export default ConfettiBurst;
