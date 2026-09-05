/**
 * P-227(KB-305): 프로필 재배치 — 섹션 순서(식이→기피→랭킹)·식이 역추론 표시·
 * diet 팝업 합집합(임의 덮어쓰기 금지)·고추 5개 투명도.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/data/useDietPresets', () => ({
  useDietPresets: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DIET_PRESETS, presetSubstanceCodes } = require('@/lib/onboarding/dietPresets');
    return DIET_PRESETS.map((p: { id: string }) => ({ ...p, codes: [...presetSubstanceCodes(p)], serverName: null }));
  },
}));
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
    FadeIn: chain(), FadeOut: chain(), SlideInDown: chain(), ZoomIn: chain(), ZoomOut: chain(), FadeInDown: chain(),
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
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/components/SocialAuthButtons', () => ({ SocialAuthButtons: () => null }));
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({ name: (c: string) => c, imageUrl: () => null }),
}));
jest.mock('@/lib/data/bookmarks', () => ({ useBookmarks: () => ({ data: [] }) }));
jest.mock('@/lib/data/useFoodReviews', () => ({ useGlobalReviews: () => ({ data: undefined }) }));
jest.mock('@/lib/data/useFoods', () => ({ useInfiniteFoods: () => ({ data: [] }), useFoods: () => ({ data: [] }) }));
jest.mock('@/lib/data/useHome', () => ({ useHome: () => ({ data: { recent: [], recommended: [], authenticated: true, avoided: [] } }) }));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => mockUseMe(),
  useMyReviews: () => ({ data: [], isLoading: false, error: null, refetch: jest.fn() }),
}));

import Profile from '../(tabs)/profile';
import { DIET_PRESETS, presetSubstanceCodes } from '@/lib/onboarding/dietPresets';

const NO_ALCOHOL_CODES = [...presetSubstanceCodes(DIET_PRESETS.find((p) => p.id === 'NO_ALCOHOL')!)];

const ME = (codes: string[], dietCategories: string[] = []) => ({
  data: {
    id: '1', nickname: 'A', nationality: 'US', readerLanguage: 'en', spiceTolerance: 'SKIP',
    restrictions: codes.map((code) => ({ kind: 'allergy' as const, code })), dietCategories,
    rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null },
    profileImageUrl: null, onboardingCompleted: true, currency: null,
  },
  isLoading: false, error: null, refetch: jest.fn(),
});

const trees: ReactTestRenderer[] = [];
function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Profile />); });
  trees.push(tree);
  return tree;
}
afterEach(() => {
  // 타이머 누수 방지(관례) — 렌더 트리 정리
  while (trees.length) act(() => trees.pop()!.unmount());
});
const flat = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMe.mockReturnValue(ME([...NO_ALCOHOL_CODES, 'EGG'], ['NO_ALCOHOL']));
});

it('① KB-434 D-6: 식이 칩 섹션 = 프로필 탭에서 소멸(시안 부재) — 진입은 메뉴 행으로 존치', () => {
  const tree = render();
  const s = flat(tree);
  expect(tree.root.findAll((n) => n.props?.testID === 'diet-NO_ALCOHOL')).toHaveLength(0); // 칩 소멸
  expect(s).toContain('profile.restrictionsTitle');
  expect(s).toContain('profile.dietTitle'); // Codex #33 P2: /profile/diet 진입 행(dietCategories 유일 편집 경로)
  expect(tree.root.findAll((n) => n.props?.testID === 'profile-rank-card').length).toBeGreaterThanOrEqual(1);
});

it('② KB-434: 랭킹 카드 = 기피 섹션 위(시안 순서 헤더→랭킹→기피→메뉴)', () => {
  const s = flat(render());
  const rank = s.indexOf('profile-rank-card');
  const avoid = s.indexOf('profile.restrictionsTitle');
  const menu = s.indexOf('profile.saved');
  expect(rank).toBeGreaterThan(-1);
  expect(rank).toBeLessThan(avoid);
  expect(avoid).toBeLessThan(menu);
});

it('③④ 소스 잠금 — 팝업 승인 시에만 합집합(unionResolvedCodes 유지)·자동 오픈·고추 투명도', () => {
  const fs = require('fs');
  const rest = fs.readFileSync('src/app/profile/restrictions.tsx', 'utf8') as string;
  expect(rest).toContain("setPresetConfirm(true)"); // Apply = 즉시 적용 아님 — 팝업 경유
  expect(rest).toContain('unionResolvedCodes(dietPresets, Array.from(presetSel), cur)'); // 합집합 유지(덮어쓰기 금지)
  expect(rest).toContain("presetsParam === '1'"); // 프로필 식이 Edit = 시트 자동 오픈
  const peppers = fs.readFileSync('src/components/SpicePeppers.tsx', 'utf8') as string;
  // KB-431: 이모지 → SVG 2색 고추 — 5개 상시 프레임 + 미달분 회색 변형(자리 유지 불변)
  expect(peppers).toContain('i <= rank ? <PepperOn'); // 시안 SVG on/off 스왑
  expect(peppers).toContain("from './design4Assets'");
  expect(peppers).not.toContain('\u{1F336}'); // 🌶️ 이모지 소멸(헌법)
  // KB-434 D-6: 편집 화면 = 슬라이더 박스만(고추 카운트 행 소멸 — 시안 h81)
  expect(fs.readFileSync('src/app/profile/edit.tsx', 'utf8')).toContain('<SpiceLevelSlider');
});
