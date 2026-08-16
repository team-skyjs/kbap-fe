/**
 * P-216(KB-310): 홈 전 콘텐츠 러프 — 섹션 조건 노출(빈 데이터 = 섹션 숨김,
 * P-210 원칙)·See all 라우팅·알림 벨 뱃지·플래그 분기(prod 무노출) 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({ name: (c: string) => c, imageUrl: () => null }),
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
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
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
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/community/hooks', () => ({ useBlockedUsers: () => ({ data: [] }) }));
jest.mock('@/lib/data/useReviewMutations', () => ({
  useToggleReviewLike: () => ({ mutate: jest.fn() }),
  useUpdateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteReview: () => ({ mutate: jest.fn() }),
}));

const mockUseHome = jest.fn();
jest.mock('@/lib/data/useHome', () => ({ useHome: () => mockUseHome() }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '9' } }), useMyReviews: () => ({ data: [] }) }));
const mockBrowse = jest.fn();
const mockCatalog = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({
  useInfiniteFoods: () => mockBrowse(),
  useFoods: () => mockCatalog(),
}));
const mockFeed = jest.fn();
jest.mock('@/lib/data/useFoodReviews', () => ({ useGlobalReviews: (e: boolean) => mockFeed(e) }));
const mockSaved = jest.fn();
jest.mock('@/lib/data/bookmarks', () => ({ useBookmarks: () => mockSaved() }));

import Home from '../(tabs)/index';

const FOOD = (id: string) => ({
  foodId: id, name: `Food ${id}`, nameKo: `음식 ${id}`, photoUrl: null,
  risk: 'safe' as const, overall: { average: 4, count: 2 }, popularityRank: Number(id),
});
const REVIEW = {
  id: 'r1', foodId: '7', rating: 5, body: 'Nice', photos: [], memberId: '5',
  foodName: 'Kimbap', foodImageUrl: null, author: { memberId: '5', nickname: 'Bob', level: 1 },
  authorNationality: 'US', authorRankTier: null, anonymized: false,
  createdAt: '2026-08-15T00:00:00Z', likes: 1, myLike: false,
};

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Home />); });
  return tree;
}
const flat = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseHome.mockReturnValue({
    data: { recent: [], recommended: [], authenticated: true, avoided: [] },
    isLoading: false, isError: false, error: null, refetch: jest.fn(),
  });
  mockBrowse.mockReturnValue({ data: [FOOD('1'), FOOD('2')] });
  mockCatalog.mockReturnValue({ data: [FOOD('3')] });
  mockFeed.mockReturnValue({ data: { pages: [{ items: [REVIEW], hasNext: false, nextCursor: null }] } });
  mockSaved.mockReturnValue({ data: [FOOD('4')] });
});

it('전 콘텐츠 섹션 렌더 — 음식·리뷰·인기검색·저장이 홈 한 화면에(캡쳐 조건)', () => {
  const tree = render();
  const s = flat(tree);
  expect(s).toContain('tabs.food');       // 음식 탐색
  expect(s).toContain('tabs.community');  // 리뷰 피드
  expect(s).toContain('search.popular');  // 검색 진입
  expect(s).toContain('saved.title');     // 저장 목록
  // 리뷰 셀 = 커뮤니티 FeedCard 재사용(새 문법 0) + 홈 프리뷰는 ⋯ 없음
  expect(byId(tree, 'feed-r1').length).toBeGreaterThanOrEqual(1);
  expect(byId(tree, 'feed-more-r1')).toHaveLength(0);
});

it('빈 데이터 = 섹션 자체 숨김(P-210 원칙) — 제목도 안 남는다', () => {
  mockBrowse.mockReturnValue({ data: [] });
  mockFeed.mockReturnValue({ data: { pages: [{ items: [], hasNext: false, nextCursor: null }] } });
  mockSaved.mockReturnValue({ data: [] });
  mockCatalog.mockReturnValue({ data: [] });
  const s = flat(render());
  expect(s).not.toContain('tabs.food');
  expect(s).not.toContain('tabs.community');
  expect(s).not.toContain('search.popular');
  expect(s).not.toContain('saved.title');
});

it('See all 라우팅 — 각 섹션이 해당 탭/화면으로', () => {
  const tree = render();
  const seeAlls = tree.root.findAll(
    (n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'home.seeAll').length > 0,
  );
  expect(seeAlls.length).toBeGreaterThanOrEqual(4);
  seeAlls.forEach((p) => act(() => p.props.onPress()));
  const targets = mockPush.mock.calls.map((c) => c[0]);
  expect(targets).toEqual(expect.arrayContaining(['/food', '/community', '/search', '/profile/saved']));
});

it('알림 벨 — 뱃지 = 안 읽은 수, 탭 = /notifications', () => {
  const tree = render();
  const bell = byId(tree, 'header-bell');
  expect(bell.length).toBeGreaterThanOrEqual(1);
  expect(byId(tree, 'header-bell-badge').length).toBeGreaterThanOrEqual(1); // 목 미읽음 2건
  act(() => bell[0].props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/notifications');
});

it('플래그 소스 잠금 — dev 계열만(prod 무노출), 벨도 같은 게이트', () => {
  const fs = require('fs');
  expect(fs.readFileSync('src/lib/flags.ts', 'utf8')).toContain('homeAllContent: !PROD_CHANNEL');
  const home = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8') as string;
  expect(home).toContain('FLAGS.homeAllContent &&');
  expect(home).toContain('bell={FLAGS.notificationCenter}');
});
