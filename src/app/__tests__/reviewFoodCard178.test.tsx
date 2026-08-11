/**
 * P-116(KB-249): 리뷰 장소 태그 전면 숨김 잠금 — placeTagsEnabled off면
 * ① 작성 폼 장소 행 ② 디테일 장소 섹션 ③ 목록 행 장소 한 줄 전부 미렌더,
 * on이면 현행 렌더(기능 회귀 0). 코드 삭제 아님 — 플래그 숨김.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/flags', () => ({
  FLAGS: { reviewsEnabled: true, reviewsLiveEnabled: false, placeTagsEnabled: false, reviewTranslationEnabled: false, guestMode: true, communityEnabled: true },
  isProdChannel: () => false,
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockFlags = (jest.requireMock('@/lib/flags') as { FLAGS: { placeTagsEnabled: boolean } }).FLAGS;

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    withSpring: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    withTiming: (v: unknown) => v,
    cancelAnimation: () => {},
    useReducedMotion: () => false,
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
  Redirect: () => null,
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'r1', foodId: '7' }),
  useFocusEffect: () => {},
  usePathname: () => '/review/r1',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));

const mockReview: Record<string, unknown> = {};
const mockFoods = jest.fn();
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { id: '9', nickname: 'A', nationality: 'US', restrictions: [{ kind: 'allergy', code: 'EGG' }], rank: { tier: 'taster', level: 2 }, spiceTolerance: 'SKIP' } }),
  useMyReviews: () => ({ data: [mockReview], error: null, refetch: jest.fn() }),
}));
jest.mock('@/lib/data/useFoodReviews', () => ({
  useFoodReviews: () => ({ data: { pages: [] }, isLoading: false, isError: false, error: null, refetch: jest.fn(), fetchNextPage: jest.fn() }),
}));
jest.mock('@/lib/data/useFoods', () => ({
  useFoods: () => ({ data: mockFoods() }),
  useFoodDetail: () => ({ data: undefined }),
  useSearchFoods: () => ({ data: [] }),
  useInfiniteFoods: () => ({ data: [] }),
}));
jest.mock('@/lib/data/useReviewMutations', () => ({
  useCreateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteReview: () => ({ mutate: jest.fn(), isPending: false }),
  useToggleReviewLike: () => ({ mutate: jest.fn() }),
}));

import ReviewDetail from '../review/[id]';
import MyReviews from '../profile/reviews';

function render(el: React.ReactElement): ReactTestRenderer {
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
  });
  return tree;
}
const flat = (t2: ReactTestRenderer) => JSON.stringify(t2.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockReview).forEach((k) => delete mockReview[k]);
  Object.assign(mockReview, {
    id: 'r1', foodId: '501', rating: 5, body: 'good', photos: [], memberId: '9',
    foodName: 'Server Bibimbap', foodImageUrl: 'https://cdn/bibim.jpg',
    authorNationality: 'US', authorRankTier: 'taster', anonymized: false,
    createdAt: '2026-08-01T00:00:00Z', likes: 1, myLike: false,
  });
  mockFoods.mockReturnValue([]); // 카탈로그 캐시 미스 기본
});

it('P-178 ①: 디테일 음식 카드 = 서버 이름·사진(P-165 체계) — foodId 숫자 노출 0', () => {
  const tree = render(<ReviewDetail />);
  const s = flat(tree);
  expect(s).toContain('Server Bibimbap');
  expect(s).toContain('https://cdn/bibim.jpg');
  expect(s).not.toContain('"501"');
});

it('P-178 ①: 서버 food 부재 + 캐시 미스 → 중립 라벨 폴백(숫자 금지)', () => {
  mockReview.foodName = null;
  mockReview.foodImageUrl = null;
  const tree = render(<ReviewDetail />);
  const s = flat(tree);
  expect(s).toContain('myReviews.viewDish');
  expect(s).not.toContain('"501"');
});

it('P-178 ②: 캐시 미스 = 위험도 뱃지 미렌더(unable 물음표 대체 금지) — 디테일·목록 공통', () => {
  const detail = render(<ReviewDetail />);
  expect(detail.root.findAll((n) => n.props?.state != null && n.props?.size === 22).length).toBe(0);
  const list = render(<MyReviews />);
  expect(list.root.findAll((n) => n.props?.state != null && n.props?.size === 14).length).toBe(0);
});

it('P-178 ②: 캐시 히트 = 개인화 뱃지 정상 렌더', () => {
  mockFoods.mockReturnValue([{ foodId: '501', name: 'Bibimbap', nameKo: '비빔밥', risk: 'safe' }]);
  const detail = render(<ReviewDetail />);
  const marks = detail.root.findAll((n) => n.props?.state != null && n.props?.size === 22);
  expect(marks.length).toBeGreaterThanOrEqual(1);
  expect(marks[0].props.state).toBe('safe'); // v2.1.0: 회피 보유여도 BE safe = safe 유지(강등 폐지)
});
