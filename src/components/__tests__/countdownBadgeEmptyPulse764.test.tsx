/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-764 — 0회(empty) 불꽃: 일렁임 유지 + 강한 펄스(EMPTY_PULSE) · active = 펄스 없음 · 정지·전이 = 짧게 가라앉힘 · 프레임 불변(P-151) ·
 * 글로우는 펄스 정점에서도 터치 상자 안(#258 /review 1).
 * 목: withRepeat = { repeat: inner } 표식, withSequence = 배열, withTiming = 목표값(설정은 기록) — 공유값을 **무엇을 애니메이션하는지로** 식별한다(#258 /review 5).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

type SV = { value: unknown };
const mockTiming = jest.fn((v: unknown, _cfg?: unknown) => v);
const mockCancel = jest.fn((_sv: SV) => {});
const mockShared: SV[] = [];
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => R.useState(() => { const sv = { value: v }; mockShared.push(sv); return sv; })[0], // 지연 초기화 — 렌더마다 새로 만들지 않게
    useAnimatedStyle: (f: () => unknown) => f(),
    useAnimatedProps: (f: () => unknown) => f(),
    withTiming: (v: unknown, cfg?: unknown) => mockTiming(v, cfg),
    withSpring: (v: unknown) => v,
    withRepeat: (v: unknown) => ({ repeat: v }),
    withSequence: (...vals: unknown[]) => vals,
    cancelAnimation: (sv: SV) => mockCancel(sv),
    Easing: { linear: (x: number) => x, ease: (x: number) => x, inOut: (f: unknown) => f },
  };
});
let mockMotion = { paused: false, visible: true, reduceMotion: false as boolean | null };
jest.mock('@/lib/useMotionPaused', () => ({ useMotionState: () => mockMotion }));

import { BADGE_H, BADGE_W, CountdownBadge, EMPTY_PULSE, GLOW_D } from '../CountdownBadge';

const trees: ReactTestRenderer[] = [];
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => { jest.clearAllMocks(); mockShared.length = 0; mockMotion = { paused: false, visible: true, reduceMotion: false }; });
type P = { state: 'active' | 'empty'; celebrate?: boolean };
const el = ({ state, celebrate = false }: P) => <CountdownBadge value={state === 'empty' ? 0 : 2} state={state} celebrate={celebrate} onPress={() => {}} />;
const render = (p: P) => { let t!: ReactTestRenderer; act(() => { t = renderer.create(el(p)); }); trees.push(t); return t; };
const update = (t: ReactTestRenderer, p: P) => act(() => { t.update(el(p)); });
const flat = (s: unknown): Record<string, unknown> => Object.assign({}, ...([s].flat(Infinity as 1).filter(Boolean) as object[]));
const host = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string')[0];
// 몸통 = 트리 순서상 첫 transform 호스트(숫자 팝 래퍼보다 바깥)
const body = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && Array.isArray(flat(n.props?.style).transform))[0];
const scaleOf = (t: ReactTestRenderer) => (flat(body(t).props.style).transform as { scale: number }[])[0].scale;
const glowOpacity = (t: ReactTestRenderer) => flat(host(t, 'countdown-badge-empty-glow').props.style).opacity;
// 식별: 반복 안이 [1, 0] = 펄스 · [glowTo, glowFrom] = 글로우 · 숫자 1 = 일렁임 phase
const loopOf = (inner: unknown) => mockShared.find((sv) => JSON.stringify((sv.value as { repeat?: unknown })?.repeat) === JSON.stringify(inner));
const pulseLoop = () => loopOf([1, 0]);
const glowLoop = () => loopOf([EMPTY_PULSE.glowTo, EMPTY_PULSE.glowFrom]);
const phaseLoop = () => loopOf(1);
const settled = () => mockTiming.mock.calls.filter(([v, cfg]) => v === 0 && (cfg as { duration?: number })?.duration === EMPTY_PULSE.settleMs).length;

it('상수 = 예진 기준값(1.0→1.12 · 1.2s · 글로우 0.35→0.7) · 멈춤 200ms', () => {
  expect(EMPTY_PULSE).toEqual({ scaleTo: 1.12, periodMs: 1200, glowFrom: 0.35, glowTo: 0.7, settleMs: 200 });
});

it('empty = 일렁임 + 펄스 + 글로우 루프(반 주기 600ms ease in-out) · 펄스 정점 scale 1.12 · 글로우 = 자기 공유값(0.35↔0.7)', () => {
  const t = render({ state: 'empty' });
  expect(phaseLoop()).toBeDefined();
  const pulse = pulseLoop()!;
  const glow = glowLoop()!;
  expect(pulse).toBeDefined();
  expect(glow).toBeDefined();
  expect(mockTiming.mock.calls.filter(([, cfg]) => (cfg as { duration?: number })?.duration === EMPTY_PULSE.periodMs / 2).map(([v]) => v)).toEqual([1, 0, EMPTY_PULSE.glowTo, EMPTY_PULSE.glowFrom]);
  pulse.value = 1; glow.value = EMPTY_PULSE.glowTo;
  update(t, { state: 'empty' });
  expect(scaleOf(t)).toBeCloseTo(EMPTY_PULSE.scaleTo);
  expect(glowOpacity(t)).toBeCloseTo(EMPTY_PULSE.glowTo);
  pulse.value = 0; glow.value = EMPTY_PULSE.glowFrom;
  update(t, { state: 'empty' });
  expect(scaleOf(t)).toBeCloseTo(1);
  expect(glowOpacity(t)).toBeCloseTo(EMPTY_PULSE.glowFrom);
});

it('active = 일렁임만 — 펄스·글로우 루프 0 · scale 1 · 글로우 0(마운트는 유지)', () => {
  const t = render({ state: 'active' });
  expect(phaseLoop()).toBeDefined();
  expect(pulseLoop()).toBeUndefined();
  expect(glowLoop()).toBeUndefined();
  expect(scaleOf(t)).toBeCloseTo(1);
  expect(host(t, 'countdown-badge-empty-glow')).toBeDefined();
  expect(glowOpacity(t)).toBe(0);
});

it.each([
  ['empty → active(해제)', { state: 'active' } as P],
  ['empty → 축하 중', { state: 'empty', celebrate: true } as P],
])('#258 /review 4: %s = 펄스·글로우 정리(cancel) 뒤 200ms로 0 — scale 1 · 글로우 0', (_n, next) => {
  const t = render({ state: 'empty' });
  const pulse = pulseLoop()!;
  const glow = glowLoop()!;
  mockTiming.mockClear(); mockCancel.mockClear();
  update(t, next);
  expect(mockCancel).toHaveBeenCalledWith(pulse);
  expect(mockCancel).toHaveBeenCalledWith(glow);
  expect(settled()).toBe(2); // 펄스·글로우 둘 다 settleMs로 가라앉힘(즉시 0 점프 금지)
  expect(pulse.value).toBe(0);
  expect(glow.value).toBe(0);
  update(t, next); // 실물은 UI 스레드가 공유값 변화를 바로 그린다 — 목은 다음 렌더에서 스타일을 다시 계산
  expect(scaleOf(t)).toBeCloseTo(next.celebrate ? 1.15 : 1); // 펄스 몫 0 — 축하 중엔 폭죽(burst 1)의 1.15만 남는다
  expect(glowOpacity(t)).toBe(0);
});

it('#258 /review 4: 언마운트 = 펄스·글로우 반복 정리(cancel)', () => {
  const t = render({ state: 'empty' });
  const pulse = pulseLoop()!;
  const glow = glowLoop()!;
  mockCancel.mockClear();
  act(() => t.unmount()); trees.pop();
  expect(mockCancel).toHaveBeenCalledWith(pulse);
  expect(mockCancel).toHaveBeenCalledWith(glow);
});

it('동작 줄이기·미확인(paused) = empty도 전부 정지 — 루프 0 · scale 1 · 글로우 0', () => {
  mockMotion = { paused: true, visible: true, reduceMotion: true };
  const t = render({ state: 'empty' });
  expect(phaseLoop()).toBeUndefined();
  expect(pulseLoop()).toBeUndefined();
  expect(glowLoop()).toBeUndefined();
  expect(scaleOf(t)).toBeCloseTo(1);
  expect(glowOpacity(t)).toBe(0);
});

it('#258 /review 1: 글로우는 펄스 정점(scaleTo)에서도 터치 상자 안 — 상자 가운데 기준 확대 범위가 0..W·0..H', () => {
  const g = flat(host(render({ state: 'empty' }), 'countdown-badge-empty-glow').props.style) as { left: number; top: number; width: number; height: number };
  expect([g.width, g.height]).toEqual([GLOW_D, GLOW_D]);
  const cx = BADGE_W / 2, cy = BADGE_H / 2, k = EMPTY_PULSE.scaleTo;
  const at = (v: number, c: number) => c + (v - c) * k; // 몸통 scale은 상자 가운데 기준
  expect(at(g.left, cx)).toBeGreaterThanOrEqual(0);
  expect(at(g.left + g.width, cx)).toBeLessThanOrEqual(BADGE_W);
  expect(at(g.top, cy)).toBeGreaterThanOrEqual(0);
  expect(at(g.top + g.height, cy)).toBeLessThanOrEqual(BADGE_H);
});

it('P-151: active ↔ empty 프레임 메트릭 불변 — 터치 상자·글로우 슬롯 크기·위치 동일', () => {
  const metrics = (t: ReactTestRenderer) => {
    const root = flat(host(t, 'countdown-badge').props.style);
    const g = flat(host(t, 'countdown-badge-empty-glow').props.style);
    return { root: [root.width, root.height], glow: [g.left, g.top, g.width, g.height] };
  };
  const a = metrics(render({ state: 'active' }));
  const e = metrics(render({ state: 'empty' }));
  expect(a).toEqual(e);
  expect(a.root).toEqual([BADGE_W, BADGE_H]);
});
