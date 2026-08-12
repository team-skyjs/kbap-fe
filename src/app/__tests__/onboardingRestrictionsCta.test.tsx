/**
 * P-011(KB-178, B안): 온보딩 restrictions 스텝의 CTA가 **스크롤 밖 하단 고정**인지
 * 잠근다 — 81종 목록 아래(스크롤 안)로 돌아가는 회귀 방지.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ScrollView } from 'react-native';

// P-174: 재료 카탈로그 훅 표면 목 — 폴백 경로(서버 무데이터) = 종전 렌더와 동일
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => (require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients')).ingredientLabel(c),
    imageUrl: () => null,
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// 컴포넌트 인덱스(TopBar→StickyHeader)가 reanimated를 끌고 옴 — 표면 mock
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
    useReducedMotion: () => false,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    cancelAnimation: () => {},
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k },
}));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en', regionCode: 'US' }] }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/lib/data/profileImage', () => ({ pickProfileImage: jest.fn(), uploadProfileImage: jest.fn() }));
jest.mock('@/lib/onboarding/submit', () => ({ UNSET: 'UNSET', submitOnboardingProfile: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
// LanguagePicker가 useUpdateMe(RQ)를 씀 — Provider 없이 렌더되게 mock
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: undefined }),
  useMyReviews: () => ({ data: [] }),
  useUpdateMe: () => ({ mutate: jest.fn() }),
}));
// 드래프트 복귀로 restrictions 스텝에 바로 진입시킨다
jest.mock('@/lib/onboarding/draft', () => ({
  loadOnboardingDraft: jest.fn().mockResolvedValue({
    consented: true,
    step: 'restrictions',
    nickname: 'Yejin',
    nationality: 'KR',
    language: 'en',
    restrictions: [],
    spice: null,
    updatedAt: '2026-07-20T00:00:00Z',
  }),
  saveOnboardingDraft: jest.fn(),
  clearOnboardingDraft: jest.fn(),
}));

import Onboarding from '../onboarding/index';
import { Btn } from '@/components/Btn';

it('restrictions 스텝 CTA(계속)는 ScrollView 밖 스티키 바에 있다', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Onboarding />);
  });
  const continueBtn = tree.root
    .findAllByType(Btn)
    // P-101: 라벨이 단일 문자열이 됨 — 배열/문자열 겸용 판정
    .find((b) => {
      const c = b.props.children;
      return (Array.isArray(c) ? c.join('') : String(c ?? '')).includes('onboarding.continue');
    })!;
  expect(continueBtn).toBeDefined();
  // 부모 체인에 ScrollView가 없어야 스티키 (스크롤 콘텐츠로 돌아가면 회귀)
  let p = continueBtn.parent;
  let insideScroll = false;
  while (p) {
    if (p.type === ScrollView) insideScroll = true;
    p = p.parent as typeof p;
  }
  expect(insideScroll).toBe(false);
});
