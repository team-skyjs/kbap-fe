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
