/**
 * ⑨ 게스트 리스트 위험도 아이콘 회귀 테스트 (정책 확정 2026-07-14 예진).
 * 정책: 게스트에겐 리스트류 화면(홈·음식탭·검색·앞으로 생길 목록 전부)에서
 * 위험도 아이콘(RiskMark/RiskPill)을 일절 렌더하지 않는다 — guest-access-policy 원칙 2.
 * 상세 화면은 락카드로 별도 처리(KB-78).
 *
 * 카드 단위 렌더(react-test-renderer) — guest=true면 RiskMark가 렌더 트리에
 * 없어야 하고, guest=false면 있어야 한다(가드가 전체를 숨기는 오버슈트 방지).
 * 새 리스트 카드를 만들면 여기에 케이스를 추가할 것.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// 공식 mock(react-native-reanimated/mock)은 worklets 네이티브 초기화를 끌고 와
// jest에서 죽는다 — 카드는 reanimated를 안 쓰므로 표면만 흉내낸 인라인 mock.
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
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
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    withTiming: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { SafeCard, RecentRow } from '../(tabs)/index';
import { BrowseCard } from '../(tabs)/food';
import { ResultCard } from '../search';
import { RiskMark } from '@/components/RiskMark';
import type { FoodCard } from '@/lib/api/types';

const FOOD: FoodCard = {
  foodId: 'bibimbap',
  name: 'Bibimbap',
  nameKo: '비빔밥',
  photoUrl: null,
  risk: 'safe',
  overall: { average: 4.5, count: 12 },
};

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

const riskMarkCount = (tree: ReactTestRenderer) => tree.root.findAllByType(RiskMark).length;

// [라벨, guest만 바꿔 렌더하는 팩토리] — 새 리스트 카드는 여기에 한 줄 추가
const CARDS: [string, (guest: boolean) => React.ReactElement][] = [
  ['홈 SafeCard', (guest) => <SafeCard food={FOOD} hasRestrictions={false} guest={guest} onPress={() => {}} />],
  ['홈 RecentRow', (guest) => <RecentRow food={FOOD} hasRestrictions={false} guest={guest} reviewLabel="Review" onPress={() => {}} />],
  ['음식탭 BrowseCard', (guest) => <BrowseCard food={FOOD} hasRestrictions={false} guest={guest} onPress={() => {}} />],
  ['검색 ResultCard', (guest) => <ResultCard food={FOOD} risk="safe" guest={guest} onPress={() => {}} />],
];

describe.each(CARDS)('%s', (_label, make) => {
  it('guest면 위험도 아이콘(RiskMark)이 렌더 트리에 없다', () => {
    const tree = render(make(true));
    expect(riskMarkCount(tree)).toBe(0);
  });

  it('회원이면 위험도 아이콘이 렌더된다 (가드 오버슈트 방지)', () => {
    const tree = render(make(false));
    expect(riskMarkCount(tree)).toBeGreaterThanOrEqual(1);
  });
});
