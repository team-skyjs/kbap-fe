/**
 * P-145 → P-188: 회피 타일 — expo-image(디스크 캐시) + 상태 분리:
 * 로딩 = 스켈레톤(약어 미노출) · 로드 성공 = 사진 · 실패(체인 소진) = 색 폴백+약어.
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
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', script: 'latin' }) }));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k },
}));

import { AvoidTile } from '../AvoidTile';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('P-188: expo-image 소스(문자열 — 디스크 캐시 기본) + 로딩 = 스켈레톤·약어 미노출', () => {
  const tree = render(<AvoidTile code="PINE_NUT" abbr="PN" tint="rgba(0,0,0,0.1)" />);
  const img = tree.root.findAll((n) => n.props?.testID === 'avtile-img-PINE_NUT')[0];
  expect(img.props.source).toBe('https://d29c1cr2ng7w0.cloudfront.net/images/webp/ingredients/pine_nut.webp');
  expect(tree.root.findAll((n) => n.props?.testID === 'avtile-skel-PINE_NUT').length).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(tree.toJSON())).not.toContain('"PN"'); // 로딩 중 약어("GM") 노출 소멸
});

it('로드 성공(onLoad) → 스켈레톤 해제·사진 유지', () => {
  const tree = render(<AvoidTile code="EGG" abbr="EG" tint="rgba(0,0,0,0.1)" />);
  const img = tree.root.findAll((n) => n.props?.testID === 'avtile-img-EGG')[0];
  act(() => img.props.onLoad());
  expect(tree.root.findAll((n) => n.props?.testID === 'avtile-skel-EGG').length).toBe(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'avtile-img-EGG').length).toBeGreaterThanOrEqual(1);
});

it('로드 실패(체인 소진) → 이미지 언마운트·색 폴백+약어만', () => {
  const tree = render(<AvoidTile code="EGG" abbr="EG" tint="rgba(0,0,0,0.1)" />);
  const img = tree.root.findAll((n) => n.props?.testID === 'avtile-img-EGG')[0];
  act(() => img.props.onError()); // 소스 1개(클라 조립) — 소진
  expect(tree.root.findAll((n) => n.props?.testID === 'avtile-img-EGG').length).toBe(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'avtile-skel-EGG').length).toBe(0);
  expect(JSON.stringify(tree.toJSON())).toContain('EG'); // 실패 폴백 약어
});
