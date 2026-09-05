/**
 * KB-436 — prod 채널 실효 플래그 렌더 잠금.
 * expo-updates channel='production' 목 → 실제 flags.ts가 PROD_CHANNEL=true로
 * 계산한 **실효값 그대로** 화면을 구동한다(플래그 개별 목 금지 — "표는 맞는데
 * 게이트 순서로 잠기는" 계열을 잡는 게 목적).
 * ① Reviews 탭 = ReviewFeed(ComingSoon 미렌더) — b22 실기 회귀
 * ② prod 실효 플래그 표 잠금(채널 종속 전수)
 * ③ 홈 섹션 목록(prod): greeting·popular·recent만 — allContent 섹션·벨 숨김
 * ④ 프로필 메뉴 행 목록(prod): 알림·차단 행 숨김, 리뷰 행 노출
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// ⚠️ 최상단: flags.ts 로드 전에 채널이 production으로 보여야 한다(모듈 로드 시 계산)
jest.mock('expo-updates', () => ({ channel: 'production' }));

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
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.1' } } }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
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
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', setLang: jest.fn() }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/auth/session', () => ({ logOut: jest.fn() }));
jest.mock('@/lib/sentry', () => ({ tapSentrySelfcheck: () => null }));
jest.mock('@/components/SocialAuthButtons', () => ({ SocialAuthButtons: () => null }));
jest.mock('@/lib/community/hooks', () => ({
  useBlockedUsers: () => ({ data: [] }),
  useCommunityFeed: () => ({ data: { pages: [] }, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(), isLoading: false, isError: false, refetch: jest.fn() }),
  useReact: () => ({ mutate: jest.fn() }),
  useDeletePost: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/data/useReviewMutations', () => ({
  useToggleReviewLike: () => ({ mutate: jest.fn() }),
  useUpdateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteReview: () => ({ mutate: jest.fn() }),
}));
// KB-436 핵심 마커 — Reviews 탭이 이 컴포넌트로 렌더되는지가 판정
jest.mock('@/features/community/ReviewFeed', () => {
  const { View } = require('react-native');
  return { ReviewFeed: () => <View testID="review-feed-marker" /> };
});
jest.mock('@/lib/data/useDietPresets', () => ({ useDietPresets: () => [] }));
const mockUseHome = jest.fn();
jest.mock('@/lib/data/useHome', () => ({ useHome: () => mockUseHome() }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({
    data: {
      id: '9', nickname: 'A', nationality: 'US', spiceTolerance: 'SKIP',
      restrictions: [], dietCategories: [],
      rank: { tier: 'newcomer', level: 1, score: 0, nextTier: 'taster', pointsToNext: 30 },
      profileImageUrl: null, onboardingCompleted: true,
    },
    isLoading: false, isError: false, error: null, refetch: jest.fn(),
  }),
  useMyReviews: () => ({ data: [] }),
}));
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
import Community from '../(tabs)/community';
import Profile from '../(tabs)/profile';
import { FLAGS, isProdChannel } from '@/lib/flags';

const FOOD = (id: string) => ({
  foodId: id, name: `Food ${id}`, nameKo: `음식 ${id}`, photoUrl: null,
  risk: 'safe' as const, overall: { average: 4, count: 2 }, popularityRank: Number(id),
});

const trees: ReactTestRenderer[] = [];
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
const flat = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockUseHome.mockReturnValue({
    data: { recent: [FOOD('7')], recommended: [FOOD('1')], authenticated: true, avoided: [] },
    isLoading: false, isError: false, error: null, refetch: jest.fn(),
  });
  mockBrowse.mockReturnValue({ data: [FOOD('1'), FOOD('2')] });
  mockCatalog.mockReturnValue({ data: [FOOD('3')] });
  mockFeed.mockReturnValue({ data: { pages: [] } });
  mockSaved.mockReturnValue({ data: [FOOD('4')] });
});

it('② prod 실효 플래그 표 — 채널 종속 전수 잠금(모듈 실계산·개별 목 0)', () => {
  expect(isProdChannel()).toBe(true); // 채널 목이 실제로 관통했는지 방어
  expect({
    reviewsEnabled: FLAGS.reviewsEnabled,
    reviewsLiveEnabled: FLAGS.reviewsLiveEnabled,
    communityEnabled: FLAGS.communityEnabled,
    communityPostsEnabled: FLAGS.communityPostsEnabled,
    homeAllContent: FLAGS.homeAllContent,
    notificationCenter: FLAGS.notificationCenter,
    dietPresetsEnabled: FLAGS.dietPresetsEnabled,
    pushEnabled: FLAGS.pushEnabled,
    guestMode: FLAGS.guestMode,
    reviewPlaceEnabled: FLAGS.reviewPlaceEnabled,
  }).toEqual({
    reviewsEnabled: true, // KB-403 전 채널
    reviewsLiveEnabled: true,
    communityEnabled: false, // 글 기능 prod 숨김(P-110)
    communityPostsEnabled: false,
    homeAllContent: false,
    notificationCenter: false,
    dietPresetsEnabled: false,
    pushEnabled: false, // KB-422 v1.0.1 재숨김
    guestMode: true,
    reviewPlaceEnabled: true, // KB-403 부속 표면
  });
});

it('① KB-436 회귀: prod 조합(communityEnabled=false·reviewsLiveEnabled=true) = Reviews 탭 → ReviewFeed', () => {
  const tree = render(<Community />);
  expect(tree.root.findAll((n) => n.props?.testID === 'review-feed-marker').length).toBeGreaterThanOrEqual(1);
  const s = flat(tree);
  expect(s).not.toContain('community.lockedTitle'); // ComingSoon 미렌더
  expect(s).not.toContain('community.lockedBody');
});

it('③ 홈(prod): greeting·popular·recent 유지 — allContent 4섹션·알림 벨 숨김', () => {
  const tree = render(<Home />);
  const s = flat(tree);
  expect(s).toContain('home.greeting'); // 인사
  expect(s).toContain('home.popularTitle'); // 추천
  expect(s).toContain('home.recentTitle'); // 최근 스캔
  for (const hidden of ['tabs.food', 'tabs.community', 'search.popular', 'saved.title']) {
    expect(s).not.toContain(hidden); // homeAllContent=false
  }
  expect(tree.root.findAll((n) => n.props?.testID === 'header-bell')).toHaveLength(0); // notificationCenter=false
});

it('④ 프로필(prod) 메뉴 행 목록 — 알림·차단 행 숨김, 리뷰 행 노출(잠금 표)', () => {
  const tree = render(<Profile />);
  const s = flat(tree);
  const visible = [
    'profile.myFoods', 'profile.saved', 'myReviews.title', 'profile.language',
    'profile.safetyNotice', 'profile.logout', 'profile.deleteAccount',
  ];
  for (const k of visible) expect(s).toContain(k);
  for (const hidden of ['notif.title', 'community.blockedTitle', 'profile.dietTitle']) {
    expect(s).not.toContain(hidden); // pushEnabled·communityEnabled·dietPresetsEnabled = false
  }
});
