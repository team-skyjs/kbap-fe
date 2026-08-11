/**
 * P-129(멘토 피드백 9건): 인트로 라벨 값 · 홈 헤더 sign in 부재·explore 부재 ·
 * 프로필 탭 게스트 = 로그인 화면(소셜 버튼) 임베드 잠금.
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
    withSpring: (v: unknown) => v,
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    SlideInDown: chain(),
    FadeInDown: chain(),
    ZoomIn: chain(),
    ZoomOut: chain(),
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
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
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => {},
  usePathname: () => '/profile',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('@/components/SocialAuthButtons', () => {
  const { View } = require('react-native');
  const Mock = (props: Record<string, unknown>) => <View testID="social-auth" {...props} />;
  return { SocialAuthButtons: Mock };
});
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => true }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: undefined, isLoading: false, isError: false, refetch: jest.fn() }),
  useMyReviews: () => ({ data: [] }),
  useUpdateMe: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/data/useHome', () => ({
  useHome: () => ({ data: { authenticated: false, avoidedSubstances: [], recommendedFoods: [], recentScannedFoods: [] }, isLoading: false, isError: false, error: null, refetch: jest.fn() }),
}));

import Home from '../(tabs)/index';
import Profile from '../(tabs)/profile';

function render(el: React.ReactElement): ReactTestRenderer {
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
  });
  return tree;
}

const allTexts = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.type === 'Text').map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)));

it('인트로 라벨 값 — Sign in · Start K-Bap (×10 대표 en 잠금)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require('@/lib/i18n/en.json') as { intro: Record<string, string>; home: Record<string, string> };
  expect(en.intro.signUp).toBe('Sign in');
  expect(en.intro.browseFirst).toBe('Start K-Bap');
  expect(en.home.emptyTitle).toBe("What's your first Korean menu?");
});

it('홈 — 헤더 sign in 부재 + explore 요소 부재 (게스트여도)', () => {
  const tree = render(<Home />);
  const texts = allTexts(tree);
  expect(texts).not.toContain('home.explore');
  expect(texts).not.toContain('common.signIn');
  // StickyHeader에 signIn prop 미전달 — sign in 버튼 렌더 없음
  expect(texts.filter((x) => x === 'intro.signUp').length).toBeLessThanOrEqual(1); // 게스트 스캔 카드 CTA만 허용
});

it('프로필 탭 게스트 — 게이트 카드 대신 로그인 화면(소셜 버튼) 임베드', () => {
  const tree = render(<Profile />);
  expect(tree.root.findAll((n) => n.props?.testID === 'social-auth').length).toBeGreaterThanOrEqual(1);
  expect(allTexts(tree)).not.toContain('gate.profileTitle'); // 구 게이트 카피 잔재 0
});

it('P-171 ②: 홈 회피 카운트 칸 숨김 — 플래그 보존형(코드 잔존·false 한 줄 복원)', () => {
  // 렌더 부재 (avoided가 있어도 — 위 useHome 목은 빈 배열이지만 소스 게이트가 정본)
  const tree = render(<Home />);
  expect(JSON.stringify(tree.toJSON())).not.toContain('home.avoidCount');
  // 소스 잠금: 배너 코드는 보존 + FLAGS.homeAvoidBanner 게이트 + 플래그 기본 false
  const fs = require('fs');
  const home = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8') as string;
  expect(home).toContain('FLAGS.homeAvoidBanner && avoided.length > 0');
  expect(home).toContain('home.avoidCount'); // 컴포넌트 코드 잔존(재활용 대비)
  const flags = fs.readFileSync('src/lib/flags.ts', 'utf8') as string;
  expect(flags).toContain('homeAvoidBanner: false');
});
