/** KB-846: RemoteImage placeholder — 기본 = Shimmer(공백 금지 P-207) · 'none' = 투명(아래 원본이 깔린 겹침 사본 전용) */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('expo-image', () => { const { View } = jest.requireActual('react-native'); return { Image: (p: object) => <View {...p} /> }; });
jest.mock('../Skeleton', () => { const { View } = jest.requireActual('react-native'); return { Shimmer: () => <View testID="shimmer" /> }; });

/* eslint-disable import/first -- jest.mock 뒤 */
import { RemoteImage } from '../RemoteImage';
/* eslint-enable import/first */

const shimmers = (el: React.ReactElement) => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(el); });
  return t.root.findAll((n) => n.props?.testID === 'shimmer' && typeof n.type === 'string').length;
};

it('기본 = Shimmer · placeholder none = 로딩 중에도 Shimmer 0', () => {
  expect(shimmers(<RemoteImage uri="https://cdn/a.jpg" />)).toBe(1);
  expect(shimmers(<RemoteImage uri="https://cdn/a.jpg" placeholder="none" />)).toBe(0);
});

it('KB-865(QA #338 다른 제품 사진 비침): hideUntilLoaded = 이번 소스 onLoad 전까지 이미지 투명 → 로드 뒤 표시 · 기본은 처음부터 보임', () => {
  const { StyleSheet } = jest.requireActual<typeof import('react-native')>('react-native');
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<RemoteImage uri="https://cdn/a.jpg" hideUntilLoaded />); });
  const img = () => t.root.findAll((n) => n.props?.source?.uri === 'https://cdn/a.jpg' && typeof n.type === 'string')[0];
  expect(StyleSheet.flatten(img().props.style).opacity).toBe(0);
  act(() => img().props.onLoad());
  expect(StyleSheet.flatten(img().props.style).opacity).toBeUndefined();
  let d!: renderer.ReactTestRenderer;
  act(() => { d = renderer.create(<RemoteImage uri="https://cdn/b.jpg" />); });
  const plain = d.root.findAll((n) => n.props?.source?.uri === 'https://cdn/b.jpg' && typeof n.type === 'string')[0];
  expect(StyleSheet.flatten(plain.props.style).opacity).toBeUndefined();
});
