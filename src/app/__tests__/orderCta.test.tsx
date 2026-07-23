/**
 * P-030(KB-205): 주문 CTA 노출 조건 + 원카드 화면 잠금.
 *  - 상세 CTA는 개인화 판정 safe/caution만 (danger 미노출, unable=owner 카드 자리)
 *  - 게스트 미노출 (프로필 기피 없이는 고지 카드가 성립 안 함)
 *  - 카드: 기피 0개 → 고지 문단 생략(순수 주문), 보유 → 고지 렌더
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// tabStates.test 프렐류드 재사용
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
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
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
  useLocalSearchParams: () => ({ id: '7' }),
  usePathname: () => '/',
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// orderCard.ts의 getFixedT('ko')까지 커버하는 i18n 표면 mock — 라벨은 defaultValue(영문)로
// 떨어지지만 이 테스트는 문단 유무만 잠근다 (ko 라벨 정확성은 orderCard.test.ts 몫).
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: {
    language: 'en',
    t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
    getFixedT: () => (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
  },
}));
const mockIsGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest() }));

const mockUseFoodDetail = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: () => mockUseFoodDetail() }));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({ useMe: () => mockUseMe() }));
jest.mock('@/lib/data/bookmarks', () => ({ useToggleBookmark: () => ({ mutate: jest.fn() }) }));

import FoodDetailScreen from '../food/[id]/index';
import OrderCard from '../food/[id]/order';
import type { FoodDetail, RiskState } from '@/lib/api/types';

const FOOD = (risk: RiskState): FoodDetail => ({
  foodId: '7',
  name: 'Kimchi Jjigae',
  nameKo: '김치찌개',
  risk,
  riskBasis: [],
  overall: { average: null, count: 0 },
  sameNationality: { average: null, count: 0 },
  description: 'desc',
  spiceLevel: null,
  photoUrl: null,
  ingredients: [],
  isRegistered: true,
  bookmarked: false,
});

const ME = (codes: string[]) => ({
  data: {
    id: '1', nickname: 'A', nationality: 'US', readerLanguage: 'en', spiceTolerance: null,
    restrictions: codes.map((code) => ({ kind: 'allergy' as const, code })),
    rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null },
  },
});

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (tree: ReactTestRenderer) => JSON.stringify(tree.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest.mockReturnValue(false);
  mockUseMe.mockReturnValue(ME(['EGG']));
  mockUseFoodDetail.mockReturnValue({ data: FOOD('safe'), isLoading: false, error: null, refetch: jest.fn() });
});

describe('상세 CTA 노출 조건 — safe/caution만', () => {
  it.each<[RiskState, boolean]>([
    ['safe', true],
    ['caution', true],
    ['danger', false],
    ['unable', false],
  ])('%s → CTA %s', (risk, shown) => {
    mockUseFoodDetail.mockReturnValue({ data: FOOD(risk), isLoading: false, error: null, refetch: jest.fn() });
    const s = flat(render(<FoodDetailScreen />));
    expect(s.includes('order.cta')).toBe(shown);
  });

  it('게스트 → 미노출 (판정 safe여도)', () => {
    mockIsGuest.mockReturnValue(true);
    expect(flat(render(<FoodDetailScreen />))).not.toContain('order.cta');
  });

  it('기피 프로필 없음 → BE 판정 그대로 safe 표시 (헌법 v2.1.0 — 강등 폐지) + CTA 노출', () => {
    mockUseMe.mockReturnValue(ME([]));
    const s = flat(render(<FoodDetailScreen />));
    expect(s).toContain('detail.verdictSafe'); // v2.1.0: 미설정=BE 그대로
    expect(s).not.toContain('detail.verdictCaution');
    expect(s).toContain('order.cta');
  });
});

describe('원카드 화면', () => {
  it('기피 보유 → 주문 문장 + 고지 문단 렌더', () => {
    const s = flat(render(<OrderCard />));
    expect(s).toContain('김치찌개');
    expect(s).toContain('개 주세요.');
    expect(s).toContain('저는 ');
    expect(s).toContain('order.caption');
  });

  it('기피 0개 → 고지 생략 (순수 주문 카드)', () => {
    mockUseMe.mockReturnValue(ME([]));
    const s = flat(render(<OrderCard />));
    expect(s).toContain('개 주세요.');
    expect(s).not.toContain('저는 ');
  });
});
