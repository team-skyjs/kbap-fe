/**
 * P-385(KB-363) — 카드 NEW 배지(그리드·홈 레일): 공개 24시간 이내만, 우상단 절대 배치.
 * 시안 노드가 없어 위치는 커맨드 센터 결정(9/16) — RiskBadge 좌상단의 반대 모서리·동일 인셋.
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
    withRepeat: (v: unknown) => v,
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


import { FoodGridCard } from '@/features/food/FoodCards';
import { NewBadge } from '@/components/NewBadge';
import { RiskBadge } from '@/components/RiskBadge';
import { railCardW, RAIL_MIN_CARD_W } from '@/features/food/railLayout';
import type { FoodCard } from '@/lib/api/types';

const HOUR = 60 * 60 * 1000;
const FOOD = (publishedAt?: string | null): FoodCard => ({
  foodId: 'bibimbap',
  name: 'Bibimbap',
  nameKo: '비빔밥',
  photoUrl: null,
  risk: 'safe',
  overall: { average: 4.5, count: 12 },
  publishedAt,
});

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  return tree;
}

const card = (publishedAt?: string | null, guest = false) =>
  render(<FoodGridCard food={FOOD(publishedAt)} risk="safe" guest={guest} saved={false} riskLabel="risk.safe" onPress={() => {}} onBookmark={() => {}} />);
const badges = (tree: ReactTestRenderer) => tree.root.findAllByType(NewBadge).length;

it('공개 1시간 전 = NEW 배지 렌더', () => {
  expect(badges(card(new Date(Date.now() - HOUR).toISOString()))).toBe(1);
});

it('25시간 전 · publishedAt 없음 = 미렌더', () => {
  expect(badges(card(new Date(Date.now() - 25 * HOUR).toISOString()))).toBe(0);
  expect(badges(card(null))).toBe(0);
  expect(badges(card(undefined))).toBe(0);
});

it('게스트도 NEW는 보인다 — 개인화 정보가 아님(위험도 배지만 회원 전용)', () => {
  const tree = card(new Date(Date.now() - HOUR).toISOString(), true);
  expect(badges(tree)).toBe(1);
  expect(tree.root.findAllByType(RiskBadge).length).toBe(0);
});

it('배치 = RiskBadge(좌상단) 반대 모서리·동일 인셋, 같은 카드에 둘 다 떠도 겹치지 않음', () => {
  const tree = card(new Date(Date.now() - HOUR).toISOString());
  const flat = (s: unknown) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) as Record<string, number>;
  const risk = flat(tree.root.findAllByType(RiskBadge)[0].parent!.props.style);
  const neu = flat(tree.root.findAllByType(NewBadge)[0].parent!.props.style);
  expect(risk.position).toBe('absolute');
  expect(neu.position).toBe('absolute');
  expect(neu.top).toBe(risk.top);
  expect(neu.right).toBe(risk.left); // 동일 인셋, 반대 모서리
  expect(risk.right).toBeUndefined();
  expect(neu.left).toBeUndefined();
  // 겹침 = 두 배지 폭 합이 카드 폭을 넘을 때만. 가장 좁은 카드(홈 레일 최소폭)에서 확인.
  const narrowest = Math.min(railCardW(320), RAIL_MIN_CARD_W);
  const BADGE_MAX_W = 44; // NEW 필(10px 3글자 + 패딩 10) · RiskBadge 리본 폭 상한
  expect(BADGE_MAX_W * 2 + risk.left + neu.right).toBeLessThan(narrowest);
});
