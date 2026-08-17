/**
 * P-176: 프로필 탭 회피 = 사진 미니 타일(선택분만·플랫) — 구 칩 잔존 0,
 * 8개 초과 접기 + Show all 토글(38종 수용), 타일 탭 = Edit 진입.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    withRepeat: (v) => v,
    withSequence: (...vals) => vals[vals.length - 1],
    withDelay: (_d, v) => v,
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/profile',
  useFocusEffect: () => {},
  Redirect: () => null,
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
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/components/SocialAuthButtons', () => ({ SocialAuthButtons: () => null }));
jest.mock('@/lib/auth/session', () => ({ logOut: jest.fn() }));
jest.mock('@/lib/data/useFoods', () => ({ useFoods: () => ({ data: [] }) }));
jest.mock('@/lib/data/bookmarks', () => ({ useBookmarks: () => ({ data: [] }) }));
const mockHome = jest.fn(() => ({ data: { recent: [] } }));
jest.mock('@/lib/data/useHome', () => ({ useHome: () => mockHome() })); // P-181 ②
// P-227: 프로필 탭 식이 섹션 훅 표면 목(상수 폴백 형태 — P-208 관례)
jest.mock('@/lib/data/useDietPresets', () => ({
  useDietPresets: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DIET_PRESETS, presetSubstanceCodes } = require('@/lib/onboarding/dietPresets');
    return DIET_PRESETS.map((p: { id: string }) => ({ ...p, codes: [...presetSubstanceCodes(p)], serverName: null }));
  },
}));
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => `srv:${c}`,
    imageUrl: (c: string) => `https://cdn/${c.toLowerCase()}.webp`,
  }),
}));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => mockUseMe(),
  useMyReviews: () => ({ data: [], isLoading: false, error: null, refetch: jest.fn() }),
}));

import Profile from '../(tabs)/profile';

const ME = (codes: string[]) => ({
  data: {
    id: '1', nickname: 'A', nationality: 'US', readerLanguage: 'en', spiceTolerance: 'SKIP',
    restrictions: codes.map((code) => ({ kind: 'allergy' as const, code })),
    rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null },
    profileImageUrl: null, onboardingCompleted: true,
  },
  isLoading: false, isError: false, error: null, refetch: jest.fn(),
});

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Profile />);
  });
  return tree;
}
const flat = (t2: ReactTestRenderer) => JSON.stringify(t2.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMe.mockReturnValue(ME(['EGG', 'SHRIMP']));
});

it('회피 = 사진 미니 타일(선택분만) — 서버 이미지·번역명, 구 칩 잔존 0', () => {
  const tree = render();
  expect(tree.root.findAll((n) => n.props?.testID === 'avtile-EGG').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'avtile-SHRIMP').length).toBeGreaterThanOrEqual(1);
  const s = flat(tree);
  expect(s).toContain('srv:EGG'); // P-174 서버 번역명 승계
  expect(s).toContain('https://cdn/egg.webp'); // 서버 이미지 승계
  const src = require('fs').readFileSync('src/app/(tabs)/profile.tsx', 'utf8') as string;
  expect(src).not.toContain('AvoidChip'); // 구 solid 칩 문법 소멸(P-227 식이 presetChip과 무관)
  expect(src).not.toContain('profile.add'); // P-227 ④: "+ Add" 소멸 — 수정은 Show all 페이지
});

it('P-227 ④: 요약 = 4타일 한 줄 고정 — Show all n 토글·+Add 소멸, Show all 링크 = 전체 페이지', () => {
  mockUseMe.mockReturnValue(ME(['PORK', 'BEEF', 'EGG', 'MILK', 'SHRIMP', 'CRAB', 'PEANUT', 'WALNUT', 'WHEAT', 'SOYBEAN', 'ONION', 'GARLIC']));
  const many = render(<Profile />); // 12종 — 4개만 렌더돼야 한다
  // 4개만 렌더(초과분 미노출 — 전체는 Show all 페이지). skel/img 변형 제외, 고유 코드만
  const codes = new Set(
    many.root
      .findAll((n) => typeof n.props?.testID === 'string' && /^avtile-[A-Z_]+$/.test(n.props.testID))
      .map((n) => n.props.testID as string),
  );
  expect(codes.size).toBe(4);
  expect(many.root.findAll((n) => n.props?.testID === 'avoid-toggle')).toHaveLength(0); // 토글 소멸
  expect(flat(many)).not.toContain('profile.add'); // +Add 소멸
  expect(flat(many)).toContain('profile.showAllLink'); // Edit → Show all 개명
  const showAll = many.root.findAll((n) => n.props?.testID === 'avoid-show-all' && typeof n.props?.onPress === 'function')[0];
  act(() => showAll.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/profile/restrictions'); // 전체 조회 페이지 = 기존 수정 화면(81종 카테고리+수정)
});

it('타일 탭 = Edit restrictions 진입(재량 채택)', () => {
  const tree = render();
  const tile = tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.testID === 'avtile-EGG').length > 0)[0];
  act(() => tile.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/profile/restrictions');
});

describe('P-181: 프로필 소형 4건', () => {
  it('② Recently scanned — useHome().recent 재사용(RecentRow) 렌더·빈 상태 미노출', () => {
    const empty = render();
    expect(JSON.stringify(empty.toJSON())).not.toContain('home.recentTitle');
    mockHome.mockReturnValue({ data: { recent: [{ foodId: '7', name: 'Kimbap', nameKo: '김밥', photoUrl: null, risk: 'safe', overall: { average: null, count: 0 } }] } } as never);
    const tree = render();
    const s2 = JSON.stringify(tree.toJSON());
    expect(s2).toContain('home.recentTitle');
    expect(s2).toContain('Kimbap');
  });

  it('⑤ 국가 필 = 국기+국가명(코드 생짜 0) · ④ 연필 박스 배경 제거', () => {
    const tree = render();
    const { StyleSheet } = require('react-native');
    const pill = tree.root.findAll((n) => n.props?.testID === 'nation-pill')[0];
    const pillTexts = pill.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
    expect(pillTexts).toContain('United States'); // 온보딩 국가명 재사용
    expect(pillTexts).not.toContain('US'); // 코드 생짜 소멸
    const pencil = tree.root.findAll((n) => n.props?.testID === 'profile-edit-pencil')[0];
    const st = StyleSheet.flatten(pencil.props.style ?? {}) as { backgroundColor?: string; borderWidth?: number };
    expect(st.backgroundColor).toBeUndefined(); // 박스 소멸
    expect(st.borderWidth).toBeUndefined();
    expect(pencil.props.hitSlop).toBeGreaterThanOrEqual(13); // 44pt 터치 유지
  });

  it('① 홈 추천 타이틀 en 정본 = "Popular dishes"(안전 보증 오인 소지 문구 소멸)', () => {
    const en = require('fs').readFileSync('src/lib/i18n/en.json', 'utf8') as string;
    expect(JSON.parse(en).home.safeTitle).toBe('Popular dishes');
  });
});
