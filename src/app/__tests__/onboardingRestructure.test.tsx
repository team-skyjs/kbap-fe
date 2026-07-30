/**
 * P-080(KB-261) 온보딩 재구조 잠금:
 *  - ① 약관 게이트: 필수 3항목 미동의 시 계속 불가(off) · 전체 동의 시 진행 가능
 *  - ③ 마크 데모: 탭 순환 safe→caution→danger→unable→safe (RiskMark 재사용)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

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
jest.mock('@/lib/onboarding/submit', () => ({ UNSET: 'UNSET', submitOnboardingProfile: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: undefined }),
  useMyReviews: () => ({ data: [] }),
  useUpdateMe: () => ({ mutate: jest.fn() }),
}));
// 테스트별 드래프트 전환: null = 신규(약관 스텝), 'riskdemo' = 데모 직행
let mockDraft: Record<string, unknown> | null = null;
jest.mock('@/lib/onboarding/draft', () => ({
  loadOnboardingDraft: jest.fn(() => Promise.resolve(mockDraft)),
  saveOnboardingDraft: jest.fn(),
  clearOnboardingDraft: jest.fn(),
}));

import Onboarding from '../onboarding/index';
import { Btn } from '@/components/Btn';
import { RiskMark } from '@/components/RiskMark';

async function render(): Promise<ReactTestRenderer> {
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
const textNodes = (tree: ReactTestRenderer, text: string) => tree.root.findAll((n) => n.props?.children === text);

it('약관 게이트 — 3항목 미동의면 계속 off, 개별 3행 전부 체크 시 진행 가능', async () => {
  mockDraft = null;
  const tree = await render();
  expect(continueBtn(tree).props.variant).toBe('off');
  expect(continueBtn(tree).props.onPress).toBeUndefined();
  // 개별 행 체크 3개 (hitSlop 6이 지문 — 행 본문 Pressable)
  const rows = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props?.hitSlop === 6);
  expect(rows.length).toBe(3);
  for (const row of rows) {
    await act(async () => {
      row.props.onPress();
    });
  }
  expect(continueBtn(tree).props.variant).toBe('primary');
});

it('약관 게이트 — 전체 동의 한 번으로 3항목 일괄 체크·진행 가능', async () => {
  mockDraft = null;
  const tree = await render();
  const agreeAll = tree.root.findAll(
    (n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'onboarding.agreeAll').length > 0,
  );
  expect(agreeAll.length).toBeGreaterThanOrEqual(1);
  await act(async () => {
    agreeAll[0].props.onPress();
  });
  expect(continueBtn(tree).props.variant).toBe('primary');
  // 계속 → 프로필 스텝 진입 (닉네임 필드 존재)
  await act(async () => {
    continueBtn(tree).props.onPress();
  });
  expect(textNodes(tree, 'onboarding.profileTitle').length).toBeGreaterThanOrEqual(1);
});

it('마크 데모 — 탭 순환 safe→caution→danger→unable→safe (4상태 전부)', async () => {
  mockDraft = {
    consented: true,
    step: 'riskdemo',
    nickname: 'Yejin',
    nationality: 'KR',
    language: 'en',
    restrictions: [],
    spice: null,
    updatedAt: '2026-07-20T00:00:00Z',
  };
  const tree = await render();
  const markTap = () => tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props?.hitSlop === 14)[0];
  const bigMark = () => tree.root.findAllByType(RiskMark).find((m) => m.props.size === 46)!;
  // Txt 래퍼가 RN Text를 감싸 같은 children이 중첩 노드로 2회 잡힌다 — ≥1로 판정
  const meaning = (s: string) => textNodes(tree, `onboarding.demo.${s}`).length;

  expect(bigMark().props.state).toBe('safe');
  expect(meaning('safe')).toBeGreaterThanOrEqual(1);
  for (const next of ['caution', 'danger', 'unable', 'safe'] as const) {
    await act(async () => {
      markTap().props.onPress();
    });
    expect(bigMark().props.state).toBe(next);
    expect(meaning(next)).toBeGreaterThanOrEqual(1);
    expect(meaning(next === 'safe' ? 'unable' : 'safe')).toBe(0); // 이전 의미 텍스트는 사라짐
  }
});
