/**
 * P-164: 에러 상태 전수 감사 잠금 — ① 4xx 무재시도(전역 retry 정책)
 * ② 리뷰 목록 로드 실패 = 공용 에러(+재시도 배선) ③ 대표 적용분(내 리뷰) 에러 렌더.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/community/hooks', () => ({
  useBlockedUsers: () => ({ data: [] }),
})); // P-186: 차단 숨김 훅 표면 목
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
    useReducedMotion: () => false,
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    FadeIn: chain(),
    FadeOut: chain(),
    FadeInDown: chain(),
    SlideInDown: chain(),
    ZoomIn: chain(),
    ZoomOut: chain(),
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({
  useSegments: () => [], // P-214: 계측 화면 식별(StateBlock·HelpfulButton)
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: '7' }),
  usePathname: () => '/',
  useFocusEffect: () => {}, // P-194: 피드 포커스 재조회 훅 표면 목
  Redirect: () => null,
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
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k },
}));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { nationality: 'US', restrictions: [] } }),
  useMyReviews: () => mockMyReviews(),
}));
jest.mock('@/lib/data/useFoods', () => ({
  useFoods: () => ({ data: [] }),
  useFoodDetail: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock('@/lib/data/useReviewMutations', () => ({
  useUpdateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useToggleReviewLike: () => ({ mutate: jest.fn() }), useDeleteReview: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/data/useReviewTranslation', () => ({ useReviewTranslation: () => ({ translate: jest.fn(), state: {} }) }));
jest.mock('@/features/community/moderation', () => ({ ModerationFlow: () => null }));

const mockRefetch = jest.fn();
const mockMyReviews = jest.fn();
jest.mock('@/lib/data/useFoodReviews', () => ({ useFoodReviews: () => mockFoodReviews() }));
const mockFoodReviews = jest.fn();

import FoodReviews from '../food/[id]/reviews';
import MyReviews from '../profile/reviews';
import { shouldRetry } from '@/lib/queryClient';
import { ApiError } from '@/lib/api/client';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (t2: ReactTestRenderer) => JSON.stringify(t2.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockMyReviews.mockReturnValue({ data: [], error: null, refetch: jest.fn() });
  mockFoodReviews.mockReturnValue({
    data: undefined, isError: false, error: null, refetch: mockRefetch,
    hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
  });
});

describe('P-164 ③: 전역 재시도 정책 — 4xx 무재시도', () => {
  it('4xx(404 등) → 재시도 0회', () => {
    expect(shouldRetry(0, new ApiError('HTTP 404', 404))).toBe(false);
    expect(shouldRetry(0, new ApiError('bad request', 400))).toBe(false);
  });
  it('5xx·네트워크(status 없음) → 1회만 재시도', () => {
    expect(shouldRetry(0, new ApiError('HTTP 500', 500))).toBe(true);
    expect(shouldRetry(1, new ApiError('HTTP 500', 500))).toBe(false);
    expect(shouldRetry(0, new ApiError('NETWORK: timeout'))).toBe(true);
    expect(shouldRetry(1, new ApiError('NETWORK: timeout'))).toBe(false);
  });
});

describe('P-164 ①: 리뷰 목록 — 로드 실패 = 공용 에러 + 재시도', () => {
  it('isError + 항목 0 → Something went wrong(공용) 렌더, 빈 화면 아님', () => {
    mockFoodReviews.mockReturnValue({
      data: undefined, isError: true, error: new ApiError('HTTP 404', 404), refetch: mockRefetch,
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    const tree = render(<FoodReviews />);
    const s = flat(tree);
    expect(s).toContain('states.errorTitle');
    expect(s).toContain('common.tryAgain');
  });

  it('재시도 탭 → refetch 호출', () => {
    mockFoodReviews.mockReturnValue({
      data: undefined, isError: true, error: new ApiError('HTTP 404', 404), refetch: mockRefetch,
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    const tree = render(<FoodReviews />);
    const retry = tree.root.findAll(
      (n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'common.tryAgain').length > 0,
    )[0];
    act(() => retry.props.onPress());
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('NETWORK 에러 → 오프라인 변형(J4) 분기', () => {
    mockFoodReviews.mockReturnValue({
      data: undefined, isError: true, error: new ApiError('NETWORK: timeout'), refetch: mockRefetch,
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    expect(flat(render(<FoodReviews />))).toContain('states.offlineTitle');
  });
});

describe('P-164 ②: 대표 적용분 — 내 리뷰', () => {
  it('로드 실패 → 공용 에러 렌더(빈 상태 위장 금지)', () => {
    const rf = jest.fn();
    mockMyReviews.mockReturnValue({ data: undefined, error: new ApiError('HTTP 500', 500), refetch: rf });
    const tree = render(<MyReviews />);
    const s = flat(tree);
    expect(s).toContain('states.errorTitle');
    expect(s).not.toContain('myReviews.emptyTitle');
  });
});

describe('P-184: 상태 화면 센터 구조 승격', () => {
  it('QueryErrorBlock = fill 자체 소유(수동 배치 불요 구조)', () => {
    const src = require('fs').readFileSync('src/components/StateBlock.tsx', 'utf8') as string;
    expect(src).toContain("fill: { flex: 1, flexGrow: 1, justifyContent: 'center' }");
    // QueryErrorBlock 두 변형(J3/J4) 모두 fill
    expect((src.match(/<StateBlock\n      fill/g) ?? []).length + (src.match(/fill\n        icon=\{<IconWifiOff/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('전 표면 수동 배치 잔존 0 — QueryErrorBlock 주변 paddingTop 래퍼 소스 잠금', () => {
    const fs = require('fs');
    const files = [
      'src/app/(tabs)/index.tsx', 'src/app/(tabs)/profile.tsx', 'src/app/(tabs)/food.tsx',
      'src/app/(tabs)/community.tsx', 'src/app/food/[id]/index.tsx', 'src/app/food/[id]/reviews.tsx',
      'src/app/profile/ranking.tsx', 'src/app/profile/saved.tsx', 'src/app/profile/reviews.tsx',
      'src/app/community/blocked.tsx', 'src/app/community/post/[id].tsx',
      'src/features/community/ReviewFeed.tsx', 'src/app/search.tsx',
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8') as string;
      // 상태 블록을 paddingTop 뷰로 감싸는 구 문법 금지
      expect(src).not.toMatch(/paddingTop:[^\n]*\n\s*<QueryErrorBlock/);
    }
  });
});

describe('P-183: 홈 부제 false-safe', () => {
  it('홈 추천 = hasScans 무관 popular 계열 — safeTitle/safeSub 소스 잔존 0', () => {
    // KB-430 후속: 탭 라벨(popularTitle) = FoodExplorer 이동 — 홈은 safe* 잔존 0만 잠금
    const src = require('fs').readFileSync('src/app/(tabs)/index.tsx', 'utf8') as string;
    expect(src).not.toContain('home.safeTitle');
    expect(src).not.toContain('home.safeSub');
    expect(require('fs').readFileSync('src/features/food/FoodExplorer.tsx', 'utf8')).toContain('home.popularTitle');
    const en = JSON.parse(require('fs').readFileSync('src/lib/i18n/en.json', 'utf8'));
    expect(en.home.popularTitle).toBe('Popular dishes'); // P-181 확정값 일원화
  });
});
