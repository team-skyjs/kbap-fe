/**
 * P-289(KB-436) — prod 채널 표면 감사(빌드 발주 첨부물).
 * expo-updates channel='production' 목 → flags.ts **모듈 실계산**(개별 플래그 목 0) —
 * "표는 맞는데 게이트 순서/채널 분기로 잠기는" 계열 차단. P-289 이후 prod = dev 동일.
 * ① 채널 분기 잔존 0(5종 감사표) ② Reviews 탭 = ReviewFeed ③ 프로필 메뉴 행(알림 포함)
 * ④ 홈 섹션 ⑤ 온보딩 ORDER 5스텝 ⑥ 탭 5 렌더 컴포넌트명.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// ⚠️ 최상단: flags.ts 로드 전에 채널이 production으로 보여야 한다(모듈 로드 시 계산)
jest.mock('expo-updates', () => ({ channel: 'production' }));

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, bezier: () => 0, in: () => () => 0 },
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
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.2' } } }));
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
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
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({ name: (c: string) => c, imageUrl: () => null }),
}));
jest.mock('@/lib/data/useHome', () => ({
  useHome: () => ({
    data: { recent: [{ foodId: '7', name: 'Kimbap', nameKo: '김밥', photoUrl: null, risk: 'safe', overall: { average: null, count: 0 } }], recommended: [], authenticated: true, avoided: [] },
    isLoading: false, isError: false, error: null, refetch: jest.fn(),
  }),
}));
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
jest.mock('@/lib/data/useFoods', () => ({
  useInfiniteFoods: () => ({ data: [{ foodId: '1', name: 'Food 1', nameKo: '음식 1', photoUrl: null, risk: 'safe', overall: { average: 4, count: 2 }, popularityRank: 1 }], isLoading: false, isError: false, error: null, refetch: jest.fn(), hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() }),
  useFoods: () => ({ data: [] }),
}));
jest.mock('@/lib/data/useFoodReviews', () => ({ useGlobalReviews: () => ({ data: { pages: [] } }) }));
jest.mock('@/lib/data/bookmarks', () => ({
  useBookmarks: () => ({ data: [], hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() }),
  useToggleBookmark: () => ({ mutate: jest.fn() }),
}));

import Home from '../(tabs)/index';
import Community from '../(tabs)/community';
import Profile from '../(tabs)/profile';
import { FLAGS, isProdChannel } from '@/lib/flags';

const trees: ReactTestRenderer[] = [];
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
const flat = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());

it('① P-289 감사표 — production 실계산: 구 채널 5종 = dev 동일(true)·채널 분기 잔존 0', () => {
  expect(isProdChannel()).toBe(true); // 채널 목이 실제로 관통했는지 방어
  expect({
    communityEnabled: FLAGS.communityEnabled,
    notificationCenter: FLAGS.notificationCenter,
    dietPresetsEnabled: FLAGS.dietPresetsEnabled,
    pushEnabled: FLAGS.pushEnabled,
    reviewsEnabled: FLAGS.reviewsEnabled,
    reviewsLiveEnabled: FLAGS.reviewsLiveEnabled,
    communityPostsEnabled: FLAGS.communityPostsEnabled,
    guestMode: FLAGS.guestMode,
    reviewPlaceEnabled: FLAGS.reviewPlaceEnabled,
  }).toEqual({
    communityEnabled: true,
    notificationCenter: true,
    dietPresetsEnabled: true,
    pushEnabled: true,
    reviewsEnabled: true,
    reviewsLiveEnabled: true,
    communityPostsEnabled: false, // 글 기능만 보존형 잠금(전 채널 동일)
    guestMode: true,
    reviewPlaceEnabled: true,
  });
  expect('homeAllContent' in FLAGS).toBe(false); // 소비처 0 — 삭제
  const src = require('fs').readFileSync('src/lib/flags.ts', 'utf8') as string;
  expect(src.match(/: !PROD_CHANNEL/g)).toBeNull(); // 채널 종속 플래그 잔존 0
});

it('② Reviews 탭 = ReviewFeed(가짜 ComingSoon 0) — 게이트 순서 회귀 방지', () => {
  const tree = render(<Community />);
  expect(tree.root.findAll((n) => n.props?.testID === 'review-feed-marker').length).toBeGreaterThanOrEqual(1);
  expect(flat(tree)).not.toContain('community.lockedTitle');
});

it('③ 프로필(prod) 메뉴 행 — 알림·차단·식이 행 포함 전부 렌더(감사표)', () => {
  const s = flat(render(<Profile />));
  for (const k of [
    'profile.myFoods', 'profile.saved', 'myReviews.title', 'profile.dietTitle',
    'profile.language', 'notif.title', 'profile.safetyNotice', 'community.blockedTitle',
    'profile.logout', 'profile.deleteAccount',
  ]) {
    expect(s).toContain(k);
  }
});

it('④ 홈(prod) 섹션 — FoodExplorer 블록 + RECENTLY(행)+ 벨(notificationCenter) 렌더', () => {
  const tree = render(<Home />);
  const s = flat(tree);
  expect(s).toContain('home-search'); // FoodExplorer 공용 블록
  expect(s).toContain('home-recent-head'); // RECENTLY 섹션(라벨은 uppercase 렌더)
  expect(s).toContain('Kimbap'); // recent 행
  expect(tree.root.findAll((n) => n.props?.testID === 'header-bell').length).toBeGreaterThanOrEqual(1); // 알림 벨
});

it('⑤⑥ 소스 감사 — 온보딩 ORDER 5스텝(프리셋 포함)·탭 4 스크린 + 스캔 진입·탭별 최상위 컴포넌트', () => {
  const fs = require('fs');
  const ob = fs.readFileSync('src/app/onboarding/index.tsx', 'utf8') as string;
  expect(ob).toContain("['consent', 'nationality', 'presets', 'restrictions', 'spice']"); // dietPresets true = 5스텝
  const layout = fs.readFileSync('src/app/(tabs)/_layout.tsx', 'utf8') as string;
  for (const name of ['index', 'food', 'community', 'profile']) expect(layout).toContain(`<Tabs.Screen name="${name}" />`);
  expect(fs.readFileSync('src/components/TabBar.tsx', 'utf8')).toContain('scan'); // 탭바 스캔 FAB 진입
  // 탭별 최상위 렌더 컴포넌트(감사표): 홈/음식 = FoodExplorer · Reviews = ReviewFeed · 프로필 = 자체(메뉴 행)
  expect(fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8')).toContain('<FoodExplorer variant="embedded"');
  expect(fs.readFileSync('src/app/(tabs)/food.tsx', 'utf8')).toContain('variant="screen"');
  expect(fs.readFileSync('src/app/(tabs)/community.tsx', 'utf8')).toContain('return <ReviewFeed />');
  // 버전 1.0.2(프로필 하단 버전 줄 소스)
  expect(JSON.parse(fs.readFileSync('app.json', 'utf8')).expo.version).toBe('1.0.2');
});
