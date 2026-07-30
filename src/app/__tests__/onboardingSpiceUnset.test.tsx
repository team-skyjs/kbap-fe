/**
 * P-051 원칙(화면 그대로 제출) × P-081(KB-261 후속) enum 잠금:
 *  - 미조작 + Continue → 요약 → 제출: 기본 **MEDIUM** (와이어 5는 submit.test/어댑터가 잠금)
 *  - 스톱 조작(Hot) → **HOT** 제출 (enum 그대로 — 정수 변환은 spiceAdapter 격리)
 *  - Skip → **SKIP** (body -1은 submit.test가 잠금)
 * P-080 구조: 제출은 spice 스텝이 아니라 **요약 카드 CTA에서만** — 이 하네스가
 * spice→summary→제출 동선(1회 제출 회귀 0)도 겸해서 잠근다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

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
const mockSubmit = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/onboarding/submit', () => ({ UNSET: 'UNSET', submitOnboardingProfile: (p: unknown) => mockSubmit(p) }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: undefined }),
  useMyReviews: () => ({ data: [] }),
  useUpdateMe: () => ({ mutate: jest.fn() }),
}));
// 드래프트 복귀로 spice 스텝에 미조작 상태로 직행
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

async function renderSpiceStep(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Onboarding />);
  });
  return tree;
}
const btnWith = (tree: ReactTestRenderer, key: string) =>
  tree.root.findAllByType(Btn).find((b) => {
    const c = b.props.children;
    return (Array.isArray(c) ? c.join('') : String(c ?? '')).includes(key);
  })!;
// P-088⑤: 슬라이더 = 트랙 레벨 제스처 단일 — onLayout으로 폭 확정 후 릴리즈로 스냅
// (onLayout과 responder props는 같은 View에 있으나 test renderer 노드가 분리될 수
// 있어 각각 탐색)
async function selectStop(tree: ReactTestRenderer, index: 0 | 1 | 2 | 3 | 4) {
  // 트랙 컨테이너 지문 = height 44 스타일 + responder — ScrollView 등 다른
  // responder/onLayout 보유 노드 오탐 방지
  const isTrack = (n: { props?: { style?: unknown; onResponderRelease?: unknown } }) =>
    typeof n.props?.onResponderRelease === 'function' &&
    (StyleSheet.flatten(n.props?.style as never) as { height?: number } | undefined)?.height === 44;
  const track = tree.root.findAll(isTrack)[0];
  await act(async () => {
    track.props.onLayout({ nativeEvent: { layout: { width: 300, height: 44 } } });
  });
  await act(async () => {
    tree.root.findAll(isTrack)[0].props.onResponderRelease({ nativeEvent: { locationX: (300 * index) / 4 } });
  });
}
const skipLink = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'onboarding.skip').length > 0);
// spice 계속 → 요약 카드 진입 → CTA(onboarding.start)로 제출
async function continueToSummaryAndSubmit(tree: ReactTestRenderer) {
  await act(async () => {
    btnWith(tree, 'onboarding.continue').props.onPress();
  });
  await act(async () => {
    btnWith(tree, 'onboarding.start').props.onPress();
  });
}

beforeEach(() => {
  mockSubmit.mockClear();
});

it('미조작 + 계속 → 요약 제출: 기본 MEDIUM (표시=전송, null draft 호환 겸)', async () => {
  const tree = await renderSpiceStep();
  await continueToSummaryAndSubmit(tree);
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockSubmit.mock.calls[0][0].spiceTolerance).toBe('MEDIUM');
});

it('Hot 스톱 조작 → HOT 제출 (P-081 enum — 내부에 정수 없음)', async () => {
  const tree = await renderSpiceStep();
  await selectStop(tree, 3); // Hot — 릴리즈 스냅 (P-088⑤ 트랙 제스처)
  await continueToSummaryAndSubmit(tree);
  expect(mockSubmit.mock.calls[0][0].spiceTolerance).toBe('HOT');
});

it('Skip → 요약 제출 시 SKIP (구 UNSET/-1 의미 승계)', async () => {
  const tree = await renderSpiceStep();
  const skips = skipLink(tree);
  expect(skips.length).toBeGreaterThanOrEqual(1);
  await act(async () => {
    skips[skips.length - 1].props.onPress();
  });
  await act(async () => {
    btnWith(tree, 'onboarding.start').props.onPress();
  });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockSubmit.mock.calls[0][0].spiceTolerance).toBe('SKIP');
});
