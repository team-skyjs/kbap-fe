/**
 * P-132(한국어 카피 구조 변경): 키 분리·제거·값 변경 잠금 —
 * 신규 키 ×10 존재 · langDetected 제거 ×10 · anonymous="탈퇴한 유저" 의미 ·
 * 게이트/재개 배너가 분리 키를 실제 렌더.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['springify', 'damping', 'stiffness', 'mass', 'duration', 'delay', 'easing']) b[k] = () => b;
    return b;
  };
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    cancelAnimation: () => {},
    useReducedMotion: () => false,
    FadeIn: chain(), FadeOut: chain(), FadeInDown: chain(), SlideInDown: chain(), ZoomIn: chain(), ZoomOut: chain(),
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/onboarding/draft', () => ({
  loadOnboardingDraft: jest.fn(() => Promise.resolve({ consented: true, step: 'spice', nickname: '', nationality: 'US', language: 'en', restrictions: [], spice: 'HOT', updatedAt: new Date(2100, 0).toISOString() })),
  clearOnboardingDraft: jest.fn(),
}));

jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { onboardingCompleted: false } }),
  useMyReviews: () => ({ data: [] }),
}));

import { AuthGateSheet } from '@/components/AuthGateSheet';
import { ResumeOnboardingBanner } from '@/components/ResumeOnboardingBanner';

const LANGS = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
type Locale = { gate: Record<string, string>; onboarding: Record<string, string>; order: Record<string, string>; review: Record<string, string>; reviews: Record<string, string> };
const load = (lang: string) => require(`../${lang}.json`) as Locale;

it.each(LANGS)('%s — 분리 키 존재·제거 키 부재 (KC-0603/0210/0302/0329/0292)', (lang) => {
  const d = load(lang);
  expect(d.gate.keepBrowsing).toBeTruthy(); // 게이트 닫기 분리
  expect(d.onboarding.resumeLater).toBeTruthy(); // 재개 배너 분리
  expect(d.onboarding.skip).toBeTruthy(); // 스텝 스킵 잔류
  expect(d.order.captionWithAvoids).toBeTruthy();
  expect(d.order.captionNoAvoids).toBeTruthy();
  expect(d.order.caption).toBeUndefined(); // 구 단일 키 대체
  expect(d.review.deleteError).toBeTruthy();
  expect(d.review.langDetected).toBeUndefined(); // 허위 표시 칩 제거
  expect(d.reviews.emptySameNat).toBeTruthy();
});

it('KC-0324 — anonymous 의미 변경(탈퇴한 유저) ko/en 값 잠금', () => {
  expect(load('ko').reviews.anonymous).toBe('탈퇴한 유저');
  expect(load('en').reviews.anonymous).toBe('Deleted user');
  expect(load('ko').onboarding.skip).toBe('건너뛰기'); // KC-0603 ① 확정값
});

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const hasText = (tree: ReactTestRenderer, key: string) =>
  tree.root.findAll((n) => n.props?.children === key).length > 0;

it('게이트 닫기 = gate.keepBrowsing 렌더 (onboarding.skip 재사용 해체)', () => {
  const tree = render(<AuthGateSheet context="profile" open onClose={jest.fn()} />);
  expect(hasText(tree, 'gate.keepBrowsing')).toBe(true);
  expect(hasText(tree, 'onboarding.skip')).toBe(false);
});

it('재개 배너 닫기 = onboarding.resumeLater 렌더', async () => {
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><ResumeOnboardingBanner /></QueryClientProvider>);
  });
  expect(hasText(tree, 'onboarding.resumeLater')).toBe(true);
  expect(hasText(tree, 'onboarding.skip')).toBe(false);
});
