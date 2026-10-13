/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-764 — 0회(empty) 불꽃: 일렁임 유지 + 강한 펄스(EMPTY_PULSE 상수 적용) · active = 펄스 없음 · 동작 줄이기 = 정지 · 프레임 불변(P-151).
 * 공유값을 실물처럼 렌더 사이에 유지하고 withTiming 설정을 기록해, 상수가 실제로 애니메이션에 실리는지와 정점(pulse=1)의 스타일 값을 판독한다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockTiming = jest.fn((v: unknown, _cfg?: unknown) => v);
const mockRepeat = jest.fn((v: unknown) => v);
const mockShared: { value: unknown }[] = [];
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => R.useRef((() => { const sv = { value: v }; mockShared.push(sv); return sv; })()).current,
    useAnimatedStyle: (f: () => unknown) => f(),
    useAnimatedProps: (f: () => unknown) => f(),
    withTiming: (v: unknown, cfg?: unknown) => mockTiming(v, cfg),
    withSpring: (v: unknown) => v,
    withRepeat: (v: unknown) => mockRepeat(v),
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    Easing: { linear: (x: number) => x, ease: (x: number) => x, inOut: (f: unknown) => f },
  };
});
let mockMotion = { paused: false, visible: true, reduceMotion: false as boolean | null };
jest.mock('@/lib/useMotionPaused', () => ({ useMotionState: () => mockMotion }));

import { BADGE_H, BADGE_W, CountdownBadge, EMPTY_PULSE } from '../CountdownBadge';

const trees: ReactTestRenderer[] = [];
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => { jest.clearAllMocks(); mockShared.length = 0; mockMotion = { paused: false, visible: true, reduceMotion: false }; });
const render = (state: 'active' | 'empty') => { let t!: ReactTestRenderer; act(() => { t = renderer.create(<CountdownBadge value={state === 'empty' ? 0 : 2} state={state} onPress={() => {}} />); }); trees.push(t); return t; };
const flat = (s: unknown): Record<string, unknown> => Object.assign({}, ...[s].flat(Infinity as 1).filter(Boolean) as object[]);
const host = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string')[0];
// 몸통 = 트리 순서상 첫 scale transform 호스트(그 안의 숫자 팝 래퍼보다 바깥)
const body = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && Array.isArray(flat(n.props?.style).transform))[0];
const scaleOf = (t: ReactTestRenderer) => ((flat(body(t).props.style).transform as { scale: number }[])[0]).scale;
const glowOpacity = (t: ReactTestRenderer) => flat(host(t, 'countdown-badge-empty-glow').props.style).opacity as number;

it('상수 = 예진 기준값(1.0→1.12 · 1.2s · 글로우 0.35→0.7)', () => {
  expect(EMPTY_PULSE).toEqual({ scaleTo: 1.12, periodMs: 1200, glowFrom: 0.35, glowTo: 0.7 });
});

it('empty = 일렁임 + 펄스 루프(반 주기 600ms ease in-out로 1↔0) · 정점에서 scale 1.12 · 글로우 0.7, 바닥에서 1 · 0.35', () => {
  const t = render('empty');
  expect(mockRepeat).toHaveBeenCalledTimes(2); // 일렁임 + 펄스
  const halves = mockTiming.mock.calls.filter(([, cfg]) => (cfg as { duration?: number })?.duration === EMPTY_PULSE.periodMs / 2);
  expect(halves.map(([v]) => v)).toEqual([1, 0]);
  expect(scaleOf(t)).toBeCloseTo(1);
  expect(glowOpacity(t)).toBeCloseTo(EMPTY_PULSE.glowFrom);
  // 정점 — 펄스 공유값을 1로 놓고 다시 그린다(스타일 함수가 상수를 실제로 쓰는지)
  const pulse = mockShared[4]; // 생성 순서: phase · pop · flicker · burst · pulse(CountdownBadge) → 그 뒤 FlameShape rest
  pulse.value = 1;
  act(() => { t.update(<CountdownBadge value={0} state="empty" onPress={() => {}} />); });
  expect(scaleOf(t)).toBeCloseTo(EMPTY_PULSE.scaleTo);
  expect(glowOpacity(t)).toBeCloseTo(EMPTY_PULSE.glowTo);
});

it('active = 일렁임만(루프 1) · 펄스 타이밍 0 · scale 1 · 글로우 0(마운트는 유지 — 프레임 불변)', () => {
  const t = render('active');
  expect(mockRepeat).toHaveBeenCalledTimes(1);
  expect(mockTiming.mock.calls.some(([, cfg]) => (cfg as { duration?: number })?.duration === EMPTY_PULSE.periodMs / 2)).toBe(false);
  expect(scaleOf(t)).toBeCloseTo(1);
  expect(host(t, 'countdown-badge-empty-glow')).toBeDefined();
  expect(glowOpacity(t)).toBe(0);
});

it('동작 줄이기·미확인(paused) = empty도 전부 정지 — 루프 0 · scale 1 · 글로우 0', () => {
  mockMotion = { paused: true, visible: true, reduceMotion: true };
  const t = render('empty');
  expect(mockRepeat).not.toHaveBeenCalled();
  expect(scaleOf(t)).toBeCloseTo(1);
  expect(glowOpacity(t)).toBe(0);
});

it('P-151: active ↔ empty 프레임 메트릭 불변 — 터치 상자·몸통·글로우 슬롯 크기·위치 동일', () => {
  const metrics = (t: ReactTestRenderer) => {
    const root = flat(t.root.findAll((n) => n.props?.testID === 'countdown-badge' && typeof n.type === 'string')[0].props.style);
    const g = flat(host(t, 'countdown-badge-empty-glow').props.style);
    return { root: [root.width, root.height], glow: [g.left, g.top, g.width, g.height] };
  };
  const a = metrics(render('active'));
  const e = metrics(render('empty'));
  expect(a).toEqual(e);
  expect(a.root).toEqual([BADGE_W, BADGE_H]);
});
