/**
 * KB-948(예진 10/31 — Mobbin 벤치마킹) 2열 카드: 영어 이름 2줄 말줄임 · 한국어 1줄 · 리뷰 있으면 한국어 줄 아래 "★ 4.5 (12)"(OverallRating) · 0건 = 줄째 없음.
 * FoodGridCard = Dishes 그리드·홈 레일(HomeGridCard)·검색·저장 공통.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// 공식 mock(react-native-reanimated/mock)은 worklets 네이티브 초기화를 끌고 와
// jest에서 죽는다 — 카드는 reanimated를 안 쓰므로 표면만 흉내낸 인라인 mock.
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = jest.requireActual('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
    return b;
  };
  return {
    __esModule: true,
    useReducedMotion: () => false, // KB-772: Shimmer·Spinner
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
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
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
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* eslint-disable import/first -- jest.mock 뒤 */
import { FoodGridCard, CARD_TITLE } from '@/features/food/FoodCards';
import { OverallRating } from '@/components/Stars';
import { StyleSheet } from 'react-native';
import type { FoodCard } from '@/lib/api/types';
/* eslint-enable import/first */

const FOOD = (overall: FoodCard['overall']): FoodCard => ({ foodId: 'bibimbap', name: 'Bibimbap', nameKo: '비빔밥', photoUrl: null, risk: 'safe', overall });
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  return tree;
}
const card = (overall: FoodCard['overall'], guest = false) =>
  render(<FoodGridCard food={FOOD(overall)} risk="safe" guest={guest} saved={false} riskLabel="risk.safe" onPress={() => {}} onBookmark={() => {}} />);
const hostTexts = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);

describe('KB-948 음식 카드 평점 줄', () => {
  it('리뷰 있음 = 한국어 줄 바로 아래 OverallRating(평균·개수) — 게스트도', () => {
    for (const guest of [false, true]) {
      const t = card({ average: 4.5, count: 12 }, guest);
      const r = t.root.findAllByType(OverallRating);
      expect(r.map((x) => [x.props.average, x.props.count])).toEqual([[4.5, 12]]);
      const tx = hostTexts(t);
      expect(tx.indexOf('비빔밥')).toBeLessThan(tx.indexOf('4.5'));
      if (!guest) expect(tx.indexOf('4.5')).toBeLessThan(tx.indexOf('risk.safe'));
    }
  });
  it('리뷰 0건 = 줄째 없음(빈 문구·자리 확보 0)', () => {
    const t = card({ average: null, count: 0 });
    expect(t.root.findAllByType(OverallRating)).toHaveLength(0);
    expect(t.root.findAll((n) => n.props?.testID === 'food-card-rating-bibimbap')).toHaveLength(0);
  });
  it('영어 이름 = 2줄 말줄임 · 한국어 = 1줄', () => {
    expect(CARD_TITLE).toEqual({ numberOfLines: 2, ellipsizeMode: 'tail' });
    const t = card({ average: null, count: 0 });
    const ko = t.root.findAll((n) => typeof n.type === 'string' && n.props.children === '비빔밥')[0];
    expect(ko.props.numberOfLines).toBe(1);
  });
});

describe('KB-948 QA: 큰 글자에서 평점 줄 잘림', () => {
  it('행 = 고정 height 없음(minHeight 18) · 평균·개수 글자 = lineHeight 18 — 기본 크기 18 그대로, 큰 글자면 글자 lineHeight가 커져 행이 늘어남', () => {
    const t = render(<OverallRating average={5} count={3} />);
    const row = t.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'overall-rating-row')[0];
    const rs = StyleSheet.flatten(row.props.style);
    expect(rs.height).toBeUndefined();
    expect(rs.minHeight).toBe(18);
    const texts = t.root.findAll((n) => n.type === 'Text');
    expect(texts.map((n) => [n.props.children].flat().join(''))).toEqual(['5.0', '(3)']);
    for (const n of texts) expect(StyleSheet.flatten(n.props.style).lineHeight).toBe(18);
  });
});

describe('KB-948 후속(P-568): 카드 평점 줄 = 한국어 이름 줄 글자', () => {
  const flatTexts = (t: ReactTestRenderer) => t.root.findAll((n) => n.type === 'Text').map((n) => ({ text: [n.props.children].flat().join(''), style: StyleSheet.flatten(n.props.style) }));
  it('음식 카드: 평균·개수 = 한국어 이름 줄(gko)과 같은 fontSize·fontWeight·color · 평균만 굵게 0 · 별 13 · 행 minHeight 0', () => {
    const t = card({ average: 5, count: 1 });
    const all = flatTexts(t);
    const ko = all.find((x) => x.text === '비빔밥')!.style;
    for (const label of ['5.0', '(1)']) {
      const st = all.find((x) => x.text === label)!.style;
      expect([st.fontSize, st.fontWeight, st.color, st.fontFamily]).toEqual([ko.fontSize, ko.fontWeight, ko.color, ko.fontFamily]);
    }
    const r = t.root.findAllByType(OverallRating)[0];
    expect(r.props.starSize).toBe(13);
    const row = r.findAll((n) => typeof n.type === 'string' && n.props.testID === 'overall-rating-row')[0];
    const rs = StyleSheet.flatten(row.props.style);
    expect([rs.height, rs.minHeight]).toEqual([undefined, undefined]); // 글자 lineHeight를 따름(큰 글자 대응)
  });
  it('다른 사용처(변형 없음) = 기존 그대로: 평균 16/700 · 개수 13/700 · lineHeight 18 · 행 minHeight 18 · 별 14', () => {
    const t = render(<OverallRating average={4.2} count={9} />);
    const all = flatTexts(t);
    expect(all.find((x) => x.text === '4.2')!.style).toMatchObject({ fontSize: 16, fontWeight: '700', lineHeight: 18 });
    expect(all.find((x) => x.text === '(9)')!.style).toMatchObject({ fontSize: 13, fontWeight: '700', lineHeight: 18 });
    const row = t.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'overall-rating-row')[0];
    expect(StyleSheet.flatten(row.props.style).minHeight).toBe(18);
  });
});
