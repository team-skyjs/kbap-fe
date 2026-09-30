/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-604(P-422) — `react-hooks/rules-of-hooks` 소진: `FLAGS` early return 아래 있던 훅을 **훅 없는 게이트 + 화면
 * 컴포넌트**로 분리(review.tsx KB-620 문법). 잠그는 성질 = "플래그 off면 화면 훅(쿼리)이 마운트되지 않는다":
 *  - community: 글 기능 off → `useCommunityFeed` 호출 0(전엔 early return **위**에서 돌아 목 피드를 조회했다 — 이 유닛은
 *    구조 전 코드에서 red) · on → 호출 1(양성 대조군)
 *  - profile/reviews: reviewsEnabled off → `useMyReviews` 호출 0(전과 동일 — 회귀 잠금) · on → 1
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// jest.mock 팩토리는 호이스팅되므로 플래그 객체는 팩토리 안에서 만들고 requireMock으로 되돌려 받는다(communityComingSoon 문법)
jest.mock('@/lib/flags', () => ({
  FLAGS: { communityEnabled: true, communityPostsEnabled: true, reviewsLiveEnabled: true, reviewsEnabled: true },
  isProdChannel: () => false,
  isDiagnosticChannel: () => true,
}));
const mockFlags = (jest.requireMock('@/lib/flags') as { FLAGS: { communityEnabled: boolean; communityPostsEnabled: boolean; reviewsLiveEnabled: boolean; reviewsEnabled: boolean } }).FLAGS;
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
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: () => {},
  Redirect: () => null,
}));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false, useSession: () => null }));
jest.mock('@/features/community/ReviewFeed', () => ({ ReviewFeed: () => null }));
jest.mock('@/features/community/parts', () => ({ PostCard: () => null, timeAgo: () => '' }));
jest.mock('@/features/community/moderation', () => ({ ModerationFlow: () => null }));
jest.mock('@/features/community/tagSheets', () => ({ FoodTagSheet: () => null, PlaceTagSheet: () => null }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/components/Snackbar', () => ({ Snackbar: () => null }));
jest.mock('@/components/Skeleton', () => ({ SkeletonMyReviews: () => null }));
jest.mock('@/features/review/FeedCard', () => ({ FeedCard: () => null }));
const mockFeed = jest.fn(() => ({ data: { pages: [] }, isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(), refetch: jest.fn() }));
jest.mock('@/lib/community/hooks', () => ({ useCommunityFeed: () => mockFeed(), useReact: () => ({ mutate: jest.fn() }), useDeletePost: () => ({ mutate: jest.fn() }) }));
const mockMyReviews = jest.fn(() => ({ data: [], isLoading: false, error: null, refetch: jest.fn() }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '9' } }), useMyReviews: () => mockMyReviews() }));
jest.mock('@/lib/data/useFoods', () => ({ useFoods: () => ({ data: [] }) }));
jest.mock('@/lib/data/useReviewMutations', () => ({ useDeleteReview: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/community/pendingToast', () => ({ consumePendingToast: () => null }));

import Community from '../(tabs)/community';
import MyReviews from '../profile/reviews';

function render(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockFlags, { communityEnabled: true, communityPostsEnabled: true, reviewsLiveEnabled: true, reviewsEnabled: true });
});

describe('community 탭 — 게이트는 훅 없는 바깥, 피드 훅은 화면 컴포넌트', () => {
  it('글 기능 off(리뷰 피드 분기) → 피드 쿼리 훅 호출 0', () => {
    mockFlags.communityPostsEnabled = false;
    render(<Community />);
    expect(mockFeed).not.toHaveBeenCalled();
  });
  it('coming-soon 분기 → 피드 쿼리 훅 호출 0', () => {
    mockFlags.reviewsLiveEnabled = false;
    mockFlags.communityEnabled = false;
    render(<Community />);
    expect(mockFeed).not.toHaveBeenCalled();
  });
  it('전부 on → 피드 쿼리 훅 호출(양성 대조군 — 목이 실제로 관통한다)', () => {
    render(<Community />);
    expect(mockFeed).toHaveBeenCalled();
  });
});

describe('내 리뷰 — reviewsEnabled 게이트', () => {
  it('off → Redirect, 내 리뷰 쿼리 훅 호출 0', () => {
    mockFlags.reviewsEnabled = false;
    render(<MyReviews />);
    expect(mockMyReviews).not.toHaveBeenCalled();
  });
  it('on → 내 리뷰 쿼리 훅 호출(양성 대조군)', () => {
    render(<MyReviews />);
    expect(mockMyReviews).toHaveBeenCalled();
  });
});
