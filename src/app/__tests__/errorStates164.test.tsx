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
const DETAIL_OK = { data: undefined, isLoading: false, error: null as unknown, refetch: jest.fn() };
const mockDetail = jest.fn(() => DETAIL_OK);
jest.mock('@/lib/data/useFoods', () => ({
  useFoods: () => ({ data: [] }),
  useFoodDetail: () => mockDetail(),
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

/** KB-626: 숨김 신호(hiddenFoods)는 실물 — 화면은 이 신호 하나로 판정한다. 실제 앱에선 FOOD-001을 받은 원천
 *  (상세·리뷰 fetch)이 세우는데 여기선 그 훅들이 목이라 테스트가 대신 세운다(`hide()`). */
const HIDDEN = jest.requireActual('@/lib/data/hiddenFoods') as typeof import('@/lib/data/hiddenFoods');
const hide = () => act(() => { HIDDEN.markFoodHidden('7'); });

beforeEach(() => {
  jest.clearAllMocks();
  HIDDEN.__resetHiddenFoodsForTest();
  mockDetail.mockReturnValue(DETAIL_OK); // KB-626: 상세는 기본 정상
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
    expect(s).toContain('common.retry'); // P-287: 최종본 에러 블록 = outline Retry
  });

  it('재시도 탭 → refetch 호출', () => {
    mockFoodReviews.mockReturnValue({
      data: undefined, isError: true, error: new ApiError('HTTP 404', 404), refetch: mockRefetch,
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    const tree = render(<FoodReviews />);
    const retry = tree.root.findAll(
      (n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'common.retry').length > 0,
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
    expect(src).toContain("errWrap: { flex: 1, flexGrow: 1, justifyContent: 'center'"); // P-287: 에러 블록이 fill 소유
    // P-287: 단일 블록(에러/오프라인 카피 분기)이 errWrap fill 소유
    expect(src).toContain('testID="query-error-block"');
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

/* KB-626(P-405 ③) — 전체 리뷰 화면: FOOD-001 = 음식이 READY 아님(서버 `listReviews` → `getReadyFood`).
   일반 에러는 P-164대로 "받아 둔 목록 유지 + 재시도"지만, FOOD-001은 재시도가 영원히 실패하고
   숨겨진 음식의 옛 리뷰를 남기면 안 된다. **처음부터 캐시된 목록 + 에러 조합**으로 짠다. */
describe('KB-626 전체 리뷰 화면 — FOOD-001은 중립 안내, 캐시된 목록도 버림', () => {
  const PAGE = { pages: [{ items: [{ id: 'r1', foodId: '7', rating: 5, body: 'cached old review', createdAt: '2026-08-01', authorNationality: 'US', authorRankTier: null, author: { nickname: 'Amy', memberId: 9 } }], hasNext: false, nextCursor: null }] };
  const state = (error: unknown, data: unknown = PAGE) => ({
    data, isError: error != null, error, refetch: mockRefetch,
    hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
  });
  const byTestId = (t2: ReactTestRenderer, id: string) => t2.root.findAll((n) => n.props?.testID === id);

  it('캐시된 목록 + FOOD-001 → 옛 리뷰 0 · 중립 안내 · 재시도·쓰기 CTA 0 (양성 대조군 동반)', () => {
    // 양성 대조군: 일반 에러면 P-164대로 받아 둔 목록이 **남아 있어야** 한다.
    // ⚠️ 표식은 카드의 testID(`helpful-<id>`)다 — 처음엔 본문 문자열을 썼는데 이 화면 본문은
    // 번역 경로를 거쳐 테스트 출력에 안 나온다. 대조군이 그걸 잡았다: 본문 문자열이었다면
    // 아래 "없음" 단언은 **처음부터 무조건 통과**했을 것이다.
    mockFoodReviews.mockReturnValue(state(new ApiError('boom', 500, 'COMMON-001')));
    expect(byTestId(render(<FoodReviews />), 'helpful-r1').length).toBeGreaterThan(0);

    mockFoodReviews.mockReturnValue(state(new ApiError('x', 400, 'FOOD-001')));
    hide(); // 리뷰 fetch가 받은 자리에서
    const tree = render(<FoodReviews />);
    const s = flat(tree);
    expect(byTestId(tree, 'helpful-r1')).toHaveLength(0); // 옛 목록 버림
    expect(byTestId(tree, 'reviews-food-hidden').length).toBeGreaterThan(0);
    expect(s).toContain('detail.foodHidden');
    expect(s).not.toContain('common.retry'); // 재시도 함정 없음
    expect(byTestId(tree, 'reviews-empty-write')).toHaveLength(0); // 숨겨진 음식에 "첫 리뷰 쓰기" 권유 금지
  });

  /* Codex #185 P1 — **상세가** FOOD-001인데 리뷰 쿼리는 정상(캐시가 독립적으로 신선)이거나 pending.
     리뷰 에러만 보는 게이트는 여기서 서지 않아 캐시된 리뷰·요약·컨트롤이 남았다. */
  const detailHidden = () => ({ ...DETAIL_OK, error: new ApiError('x', 400, 'FOOD-001') });

  it('상세 FOOD-001 + 리뷰 캐시 신선(에러 없음) → 카드 0 · 쓰기 CTA 0 · 중립 안내 (양성 대조군 동반)', () => {
    // 양성 대조군: 둘 다 정상이면 카드가 **보여야** 한다
    mockFoodReviews.mockReturnValue(state(null));
    expect(byTestId(render(<FoodReviews />), 'helpful-r1').length).toBeGreaterThan(0);

    mockDetail.mockReturnValue(detailHidden());
    mockFoodReviews.mockReturnValue(state(null)); // 리뷰 쪽은 캐시가 멀쩡하다
    hide(); // 상세 fetch가 받은 자리에서 — 리뷰 캐시와 무관하게 선다
    const tree = render(<FoodReviews />);
    expect(byTestId(tree, 'helpful-r1')).toHaveLength(0); // 캐시된 리뷰 카드 없음
    expect(byTestId(tree, 'rating-summary-box')).toHaveLength(0); // 음식 요약·컨트롤 없음
    expect(byTestId(tree, 'reviews-empty-write')).toHaveLength(0); // 숨겨진 음식에 "첫 리뷰 쓰기" 권유 없음
    expect(byTestId(tree, 'reviews-food-hidden').length).toBeGreaterThan(0);
  });

  it('상세 FOOD-001 + 리뷰 pending(data 없음·에러 없음) → 중립 안내', () => {
    mockDetail.mockReturnValue(detailHidden());
    mockFoodReviews.mockReturnValue({ ...state(null, undefined), isLoading: true });
    hide();
    const tree = render(<FoodReviews />);
    expect(byTestId(tree, 'reviews-food-hidden').length).toBeGreaterThan(0);
    expect(byTestId(tree, 'helpful-r1')).toHaveLength(0);
  });

  it('상세의 FOOD-001이 **아닌** 에러는 리뷰 화면을 막지 않는다(과잉 차단 금지)', () => {
    mockDetail.mockReturnValue({ ...DETAIL_OK, error: new ApiError('boom', 500, 'COMMON-001') });
    mockFoodReviews.mockReturnValue(state(null));
    const tree = render(<FoodReviews />);
    expect(byTestId(tree, 'helpful-r1').length).toBeGreaterThan(0);
    expect(byTestId(tree, 'reviews-food-hidden')).toHaveLength(0);
  });

  it('데이터 없음 + FOOD-001 → 에러 블록이 아니라 중립 안내', () => {
    mockFoodReviews.mockReturnValue(state(new ApiError('x', 400, 'FOOD-001'), undefined));
    hide();
    const tree = render(<FoodReviews />);
    expect(byTestId(tree, 'reviews-food-hidden').length).toBeGreaterThan(0);
    expect(flat(tree)).not.toContain('states.errorTitle');
  });
});
