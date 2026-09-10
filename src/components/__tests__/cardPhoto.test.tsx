/**
 * CardPhoto (⑩) — 로딩 shimmer 수명 계약:
 * 이미지 로드 전엔 shimmer가 돌고, onLoad/onError 후엔 언마운트된다
 * (리스트에 무한 애니메이션이 남으면 UI 스레드 낭비).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
    return b;
  };
  return {
    __esModule: true,
    withSpring: (v: unknown) => v,
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    SlideInDown: chain(),
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ZoomIn: chain(),
    ZoomOut: chain(),
    FadeInDown: chain(),
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    interpolate: () => 0,
    Easing: { linear: 0 },
  };
});
jest.mock('expo-image', () => ({
  Image: (props: Record<string, unknown>) => {
    const React = require('react');
    return React.createElement('ExpoImage', props);
  },
}));

import { CardPhoto } from '../CardPhoto';
import { Shimmer } from '../Skeleton';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

const shimmerCount = (tree: ReactTestRenderer) => tree.root.findAllByType(Shimmer).length;

it('로드 전에는 shimmer가 렌더된다', () => {
  const tree = render(<CardPhoto uri="https://cdn.example/a.jpg" />);
  expect(shimmerCount(tree)).toBe(1);
});

it('onLoad 후 shimmer가 언마운트된다', () => {
  const tree = render(<CardPhoto uri="https://cdn.example/a.jpg" />);
  const img = tree.root.findByType('ExpoImage' as never) as unknown as { props: { onLoad: () => void } };
  act(() => img.props.onLoad());
  expect(shimmerCount(tree)).toBe(0);
});

it('P-353 ③: 원본 실패 = 기본 음식 이미지 1회 강등(shimmer 유지), 기본까지 실패 = shimmer 종료', () => {
  const { DEFAULT_FOOD_IMAGE_URL } = require('@/lib/api/foodAdapter') as typeof import('@/lib/api/foodAdapter');
  const tree = render(<CardPhoto uri="https://cdn.example/broken.jpg" />);
  const img = () => tree.root.findByType('ExpoImage' as never) as unknown as { props: { source: string; onError: () => void } };
  act(() => img().props.onError());
  expect(img().props.source).toBe(DEFAULT_FOOD_IMAGE_URL); // 강등
  expect(shimmerCount(tree)).toBe(1); // 기본 이미지 로딩 중
  act(() => img().props.onError()); // 기본 이미지도 실패
  expect(shimmerCount(tree)).toBe(0); // 무한 로딩 방지
});

it('P-353 ③: uri null = 처음부터 기본 음식 이미지', () => {
  const { DEFAULT_FOOD_IMAGE_URL } = require('@/lib/api/foodAdapter') as typeof import('@/lib/api/foodAdapter');
  const tree = render(<CardPhoto uri={null} />);
  const img = tree.root.findByType('ExpoImage' as never) as unknown as { props: { source: string } };
  expect(img.props.source).toBe(DEFAULT_FOOD_IMAGE_URL);
});
