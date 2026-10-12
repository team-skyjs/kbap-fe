/**
 * FlameShape — 카운트다운 뱃지 불꽃(KB-706 2차: 예진 영상 레퍼런스의 구성·색 + 계속 일렁임).
 * 모양·색·키프레임 데이터 = flameGeometry.ts. 여기는 그리기만.
 *
 * - active: 바깥(세로 4정지 그라데이션) · 안쪽 불꽃(봉우리 → 가운데 → 아래, 바닥 빛으로 녹아듦) · 바닥 노란 빛 · 불티 2개. 흰 테두리 없음.
 * - empty(0회 — 꺼진 불꽃): 같은 모양 회색 · 정지 · 빛·불티 없음(바깥 ink3 · 안쪽 한 단계 진한 ink2 — 기존 토큰).
 * - `phase`(0..1 공유값)가 있으면 그 값으로 일렁인다 — d·opacity를 useAnimatedProps 워클릿이 계산(UI 스레드, JS 0).
 *   없으면(동작 줄이기·가려짐·꺼진 불꽃) 가라앉은 모양으로 정지.
 * - 캔버스 = FLAME_VIEWBOX(rest 불꽃 + 위쪽 일렁임·불티 여유) × `scale`(px/단위). 배치는 호출부(터치 상자보다 크다 — pointerEvents none).
 */
import * as React from 'react';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { color as C } from '@/lib/theme';
import {
  FLAME_COLORS,
  FLAME_TIMES,
  FLAME_VIEWBOX as V,
  INNER_FRAMES,
  INNER_REST_D,
  OUTER_FRAMES,
  OUTER_REST_D,
  lerpFrames,
  sparkFrame,
  toPathD,
} from './flameGeometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function FlameShape({ scale, state, phase }: { scale: number; state: 'active' | 'empty'; phase?: SharedValue<number> }) {
  const on = state === 'active';
  const rest = useSharedValue(0);
  const p = phase ?? rest;
  const animated = on && phase != null;
  const outerProps = useAnimatedProps(() => ({ d: toPathD(lerpFrames(OUTER_FRAMES, FLAME_TIMES, p.value)) }));
  const innerProps = useAnimatedProps(() => ({ d: toPathD(lerpFrames(INNER_FRAMES, FLAME_TIMES, p.value)) }));
  const spark0 = useAnimatedProps(() => sparkFrame(0, p.value));
  const spark1 = useAnimatedProps(() => sparkFrame(1, p.value));
  return (
    <Svg width={V.w * scale} height={V.h * scale} viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`} testID={`flame-${state}`}>
      <Defs>
        <LinearGradient id="flameOuter" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={FLAME_COLORS.outer[0]} />
          <Stop offset="0.35" stopColor={FLAME_COLORS.outer[1]} />
          <Stop offset="0.75" stopColor={FLAME_COLORS.outer[2]} />
          <Stop offset="1" stopColor={FLAME_COLORS.outer[3]} />
        </LinearGradient>
        <LinearGradient id="flameInner" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={FLAME_COLORS.innerPeak[0]} />
          <Stop offset="0.25" stopColor={FLAME_COLORS.innerPeak[1]} />
          <Stop offset="0.6" stopColor={FLAME_COLORS.innerMid} />
          <Stop offset="1" stopColor={FLAME_COLORS.innerBottom} stopOpacity={0.2} />
        </LinearGradient>
        <RadialGradient id="flameGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={FLAME_COLORS.glow[0]} />
          <Stop offset="0.55" stopColor={FLAME_COLORS.glow[1]} stopOpacity={0.85} />
          <Stop offset="1" stopColor={FLAME_COLORS.glow[1]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {animated ? (
        <>
          <AnimatedPath animatedProps={outerProps} fill="url(#flameOuter)" testID="flame-outer" />
          <AnimatedPath animatedProps={innerProps} fill="url(#flameInner)" testID="flame-inner" />
        </>
      ) : (
        <>
          <Path d={OUTER_REST_D} fill={on ? 'url(#flameOuter)' : C.ink3} testID="flame-outer" />
          <Path d={INNER_REST_D} fill={on ? 'url(#flameInner)' : C.ink2} testID="flame-inner" />
        </>
      )}
      {on && <Ellipse cx={50} cy={122} rx={30} ry={15} fill="url(#flameGlow)" testID="flame-glow" />}
      {animated && (
        <>
          <AnimatedPath animatedProps={spark0} fill={FLAME_COLORS.outer[1]} testID="flame-spark" />
          <AnimatedPath animatedProps={spark1} fill={FLAME_COLORS.outer[1]} testID="flame-spark" />
        </>
      )}
    </Svg>
  );
}
