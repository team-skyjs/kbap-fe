/**
 * KB-819 해제 축하 모달 v2 — 등장 연출 부품(듀오링고식 "뽱"). 전부 UI 스레드 워클릿(useAnimatedStyle/useAnimatedProps),
 * JS 스레드 setState 루프 0. 파티클 48개는 **진행도 공유값 1개**로 구동(개별 타이머 0) — 파라미터는 모듈 상수(결정적, Math.random 0).
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Txt as Text } from '@/components/Txt';
import { color as C } from '@/lib/theme';

export const PARTICLE_COUNT = 48;
const PARTICLE_COLORS = [C.surface, '#FFD54A', '#FFB15C', '#FFF3C4'];
type Shape = 'circle' | 'square' | 'flame';
type ParticleSpec = { dx: number; dy: number; spin: number; size: number; color: string; shape: Shape; life: number };

/** index 기반 결정적 의사난수(0..1) — 렌더 중 Math.random 금지(React Compiler) + 테스트 재현성. */
function rnd(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const SHAPES: Shape[] = ['circle', 'square', 'flame'];
export const PARTICLES: readonly ParticleSpec[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (rnd(i, 1) - 0.5) * 0.3; // 균등 + 지터
  const speed = 140 + rnd(i, 2) * 120; // 진행도 1에서 날아간 거리(px)
  return {
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed,
    spin: (rnd(i, 3) - 0.5) * 1080,
    size: 6 + rnd(i, 4) * 6,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    shape: SHAPES[i % SHAPES.length],
    life: 1.4 / 1.8 + rnd(i, 5) * (0.4 / 1.8), // 1.4~1.8s(전체 1.8s 기준 비율)에 opacity 0
  };
});
/** 파티클 전체 시간 — 진행도 0→1이 이 시간. */
export const PARTICLE_MS = 1800;
const GRAVITY = 260;

function Particle({ spec, progress, index }: { spec: ParticleSpec; progress: SharedValue<number>; index: number }) {
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const fade = spec.life - t < 0.15 ? Math.max(0, (spec.life - t) / 0.15) : 1;
    return {
      opacity: t <= 0 ? 0 : fade,
      transform: [
        { translateX: spec.dx * t },
        { translateY: spec.dy * t + GRAVITY * t * t },
        { rotate: `${spec.spin * t}deg` },
      ],
    };
  });
  const box = { width: spec.size, height: spec.shape === 'square' ? spec.size * 0.7 : spec.size, marginLeft: -spec.size / 2, marginTop: -spec.size / 2 };
  return (
    <Animated.View style={[styles.particle, box, style]} testID={`unlock-particle-${index}`}>
      {spec.shape === 'flame' ? (
        <Svg width={spec.size} height={spec.size} viewBox="0 0 10 10"><Path d="M5 0C6.5 3 9 4.5 9 7a4 4 0 0 1-8 0C1 4.5 3.5 3 5 0Z" fill={spec.color} /></Svg>
      ) : (
        <View style={{ flex: 1, backgroundColor: spec.color, borderRadius: spec.shape === 'circle' ? spec.size / 2 : 1.5 }} />
      )}
    </Animated.View>
  );
}

/** 불꽃 중심 원점(0×0 상자)에서 방사 — 부모가 중심에 둔다. */
export function ParticleBurst({ progress }: { progress: SharedValue<number> }) {
  return (
    <View style={styles.origin} pointerEvents="none" testID="unlock-celebration-burst">
      {PARTICLES.map((spec, i) => <Particle key={i} spec={spec} progress={progress} index={i} />)}
    </View>
  );
}

/** 충격파 링 — 흰 3px, scale 0.4→3.2 · opacity 0.7→0. */
export function ShockRing({ progress, size, testID }: { progress: SharedValue<number>; size: number; testID: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value <= 0 ? 0 : 0.7 * (1 - progress.value),
    transform: [{ scale: 0.4 + 2.8 * progress.value }],
  }));
  return <Animated.View pointerEvents="none" testID={testID} style={[styles.ring, { width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, marginTop: -size / 2 }, style]} />;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const INFINITY_D = 'M55 21C38-4 5 1 5 21S38 46 55 21C72-4 105 1 105 21S72 46 55 21';
/** 경로 길이 상한(두 고리 ≈ 300) — dashoffset이 이 값이면 완전히 숨는다. */
export const INFINITY_LEN = 320;

/** 무한 기호 — stroke 그리기(draw 0→1) + 등장 스프링(scaleIn) × 숨쉬기(breath 0↔1 → 1↔1.03). */
export function InfinityMark({ draw, scaleIn, breath, scale }: { draw: SharedValue<number>; scaleIn: SharedValue<number>; breath: SharedValue<number>; scale: number }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: INFINITY_LEN * (1 - draw.value) }));
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scaleIn.value * (1 + 0.03 * breath.value) }] }));
  return (
    <Animated.View style={style} testID="unlock-infinity">
      <Svg width={110 * scale} height={42 * scale} viewBox="0 0 110 42">
        <AnimatedPath d={INFINITY_D} stroke={C.surface} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={[INFINITY_LEN, INFINITY_LEN]} animatedProps={props} />
      </Svg>
    </Animated.View>
  );
}

/** 단어 단위 스태거 — 진행도 하나(p 0→1, 길이 = 250 + 60×(단어−1)ms)에서 단어별 구간을 잘라 scale 0.6→1·opacity. */
export const WORD_STAGGER_MS = 60;
export const WORD_MS = 250;
export function titleWords(title: string): string[] {
  const words = title.split(' ').filter(Boolean);
  return words.length ? words : [title];
}
function Word({ word, index, count, progress, style }: { word: string; index: number; count: number; progress: SharedValue<number>; style: object }) {
  const total = WORD_MS + WORD_STAGGER_MS * (count - 1);
  const start = (WORD_STAGGER_MS * index) / total;
  const span = WORD_MS / total;
  const animated = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (progress.value - start) / span));
    return { opacity: local, transform: [{ scale: 0.6 + 0.4 * local }] };
  });
  // Codex #297 P1: 띄어쓰기 없는 제목(ko 일부·ja·zh·th)은 한 덩어리 — 폭을 시트에 묶어 원래처럼 줄바꿈되게. 모든 단어도 시트 폭 상한.
  return (
    <Animated.View style={[count === 1 ? styles.wordFull : styles.word, animated]} testID={`unlock-title-word-${index}`}>
      <Text style={style}>{word}</Text>
    </Animated.View>
  );
}
export function StaggerTitle({ title, progress, style }: { title: string; progress: SharedValue<number>; style: object }) {
  const words = titleWords(title);
  // 스크린리더는 한 덩어리 제목으로 읽는다(단어 조각은 숨김)
  return (
    <View style={styles.words} accessible accessibilityRole="header" accessibilityLabel={title} testID="unlock-title">
      {words.map((w, i) => <Word key={`${i}-${w}`} word={w} index={i} count={words.length} progress={progress} style={style} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, overflow: 'visible' },
  particle: { position: 'absolute', left: 0, top: 0 },
  ring: { position: 'absolute', left: '50%', top: '50%', borderWidth: 3, borderColor: C.surface },
  words: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 8 },
  word: { maxWidth: '100%', flexShrink: 1 },
  wordFull: { width: '100%' },
});
