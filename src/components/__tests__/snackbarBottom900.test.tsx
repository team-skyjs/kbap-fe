/** KB-900: 탭 바 없는 화면(Saved)의 Undo 스낵바가 3버튼 내비 바에 덮였다 — 아래 위치를 호출부가 인셋만큼 올린다(기본 24 무변) */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import * as fs from 'fs';
import { Snackbar } from '../Snackbar';

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const chain = () => ({ springify: () => ({ damping: () => ({ stiffness: () => ({}) }) }), duration: () => ({}) });
  return { __esModule: true, default: { View }, SlideInDown: chain(), FadeOut: chain() };
});

const rootBottom = (el: React.ReactElement) => {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  const b = StyleSheet.flatten(tree.root.findAll((n) => n.props?.pointerEvents === 'box-none')[0].props.style).bottom;
  act(() => tree.unmount());
  return b;
};

it('기본 24 · bottom 넘기면 그 값', () => {
  expect(rootBottom(<Snackbar text="x" />)).toBe(24);
  expect(rootBottom(<Snackbar text="x" bottom={72} />)).toBe(72);
});

it('Saved = 24 + 하단 인셋', () => {
  const src = fs.readFileSync('src/app/profile/saved.tsx', 'utf8');
  expect(src).toContain('bottom={24 + bottomInset}');
  expect(src).toContain('const bottomInset = useBottomInset();');
});
