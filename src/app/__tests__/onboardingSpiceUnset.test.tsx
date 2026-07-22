/**
 * P-051(KB-195 후속, Q-03): **화면 그대로 제출** 원칙 잠금 (P-039 UI 롤백).
 *  - 미조작 + Continue → 화면 기본값 **5** 제출 (표시=전송 일치)
 *  - 불꽃 조작(7) + Continue → 7
 *  - Skip → UNSET (body -1은 submit.test가 잠금)
 * draft spice=null(구 스킵분) 복귀 → 5 표시 호환도 이 하네스가 겸한다.
 * spice가 마지막 스텝(interests 플래그 off)이라 계속 = 제출 — draft 복귀로 직행.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// onboardingRestrictionsCta.test 프렐류드 재사용
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
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
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    FadeInDown: chain(),
    SlideInDown: chain(),
    ZoomIn: chain(),
    ZoomOut: chain(),
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
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
const mockSubmit = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/onboarding/submit', () => ({ UNSET: 'UNSET', submitOnboardingProfile: (p: unknown) => mockSubmit(p) }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: undefined }),
  useMyReviews: () => ({ data: [] }),
  useUpdateMe: () => ({ mutate: jest.fn() }),
}));
// 드래프트 복귀로 spice 스텝(마지막)에 미조작 상태로 직행
jest.mock('@/lib/onboarding/draft', () => ({
  loadOnboardingDraft: jest.fn().mockResolvedValue({
    consented: true,
    step: 'spice',
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
import { IconFlame } from '@/components/icons';

async function renderSpiceStep(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Onboarding />);
  });
  return tree;
}
const continueBtn = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Btn).find((b) => {
    const c = b.props.children;
    return (Array.isArray(c) ? c.join('') : String(c ?? '')).includes('onboarding.continue');
  })!;
const skipLink = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'onboarding.skip').length > 0);

beforeEach(() => {
  mockSubmit.mockClear();
});

it('미조작 + Continue → 화면 기본값 5 제출 (표시=전송 일치, null draft→5 호환 겸)', async () => {
  const tree = await renderSpiceStep();
  await act(async () => {
    continueBtn(tree).props.onPress();
  });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockSubmit.mock.calls[0][0].spiceTolerance).toBe(5);
});

it('불꽃 조작(7) 후 계속 → 실값 7', async () => {
  const tree = await renderSpiceStep();
  // heatRow의 8번째 불꽃(i=7) — IconFlame을 품은 Pressable들 중 인덱스로 탐색
  const flames = tree.root.findAll(
    (n) => typeof n.props?.onPress === 'function' && n.props?.hitSlop === 6 && n.findAllByType(IconFlame).length === 1,
  );
  expect(flames.length).toBe(11);
  await act(async () => {
    flames[7].props.onPress();
  });
  await act(async () => {
    continueBtn(tree).props.onPress();
  });
  expect(mockSubmit.mock.calls[0][0].spiceTolerance).toBe(7);
});

it('Skip → UNSET (P-019 -1 경로 유지)', async () => {
  const tree = await renderSpiceStep();
  const skips = skipLink(tree);
  expect(skips.length).toBeGreaterThanOrEqual(1);
  await act(async () => {
    skips[skips.length - 1].props.onPress();
  });
  expect(mockSubmit.mock.calls[0][0].spiceTolerance).toBe('UNSET');
});
