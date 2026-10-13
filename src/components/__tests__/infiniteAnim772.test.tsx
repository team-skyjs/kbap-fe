/**
 * KB-772: 리스트에 대량으로 붙는 무한 애니메이션(Shimmer·Spinner)은 CSS 애니메이션으로만 돈다 —
 * useAnimatedStyle 매퍼(withRepeat)는 언마운트 직후 잔여 갱신이 Android 동기 갱신 목록에 죽은 태그를 남겨
 * SVG 그리기 이벤트마다 예외+스택 로그 폭주(정렬 전환 ANR). 매퍼 경로로 되돌리면 이 스위트가 깨진다.
 */
import * as React from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Shimmer } from '@/components/Skeleton';
import { Spinner } from '@/components/Spinner';

const mockAnim = { useAnimatedStyle: jest.fn(() => ({})), withRepeat: jest.fn((v: unknown) => v), reduced: false };
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock 팩토리는 import 불가(호이스팅)
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    get useAnimatedStyle() { return mockAnim.useAnimatedStyle; },
    get withRepeat() { return mockAnim.withRepeat; },
    useReducedMotion: () => mockAnim.reduced,
    withTiming: (v: unknown) => v,
    interpolate: () => 0,
    Easing: { linear: 0 },
  };
});

const infiniteNodes = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => {
    const s = StyleSheet.flatten(n.props?.style) as Record<string, unknown> | undefined;
    return !!s && s.animationIterationCount === 'infinite' && s.animationName != null;
  });

it.each([
  ['Shimmer', () => <Shimmer style={{ width: 100, height: 20 }} />],
  ['Spinner', () => <Spinner />],
])('%s — CSS 무한 애니메이션, useAnimatedStyle 매퍼·withRepeat 0', (_name, el) => {
  jest.clearAllMocks();
  mockAnim.reduced = false;
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el());
  });
  expect(infiniteNodes(tree).length).toBeGreaterThan(0);
  expect(mockAnim.useAnimatedStyle).not.toHaveBeenCalled();
  expect(mockAnim.withRepeat).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

it.each([
  ['Shimmer', () => <Shimmer style={{ width: 100, height: 20 }} />],
  ['Spinner', () => <Spinner />],
])('%s — 동작 줄이기 = 애니메이션 스타일 없음(정적)', (_name, el) => {
  mockAnim.reduced = true;
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el());
  });
  expect(infiniteNodes(tree)).toHaveLength(0);
  expect(tree.toJSON()).not.toBeNull();
  act(() => tree.unmount());
});
