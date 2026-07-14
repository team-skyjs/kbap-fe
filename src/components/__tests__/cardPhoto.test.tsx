/**
 * CardPhoto (⑩) — 로딩 shimmer 수명 계약:
 * 이미지 로드 전엔 shimmer가 돌고, onLoad/onError 후엔 언마운트된다
 * (리스트에 무한 애니메이션이 남으면 UI 스레드 낭비).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
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

it('onError 후에도 shimmer가 언마운트된다 (실패 시 무한 로딩 방지)', () => {
  const tree = render(<CardPhoto uri="https://cdn.example/broken.jpg" />);
  const img = tree.root.findByType('ExpoImage' as never) as unknown as { props: { onError: () => void } };
  act(() => img.props.onError());
  expect(shimmerCount(tree)).toBe(0);
});
