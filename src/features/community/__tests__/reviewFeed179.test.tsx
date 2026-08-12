/**
 * P-179: 커뮤니티 탭 = 전역 리뷰 피드 — 카드(서버 food·Helpful)·FAB 플로우·
 * 게스트 게이트(인증 필수 계약 = 호출 0)·글 기능 플래그 숨김/채널 분기 소스 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/community',
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
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
// 픽커 = 작성 시트 재사용 — 표면 목(kind 전달만 검사)
const mockSheet = jest.fn(() => null);
jest.mock('@/app/community/compose', () => ({ TagPickerSheet: (p: unknown) => mockSheet(p) }));
const mockIsGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest() }));
const mockToggle = jest.fn();
jest.mock('@/lib/data/useReviewMutations', () => ({
  useToggleReviewLike: () => ({ mutate: mockToggle }),
  useUpdateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteReview: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/features/community/moderation', () => ({ ModerationFlow: () => null }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '9' } }) }));
const mockFeed = jest.fn();
jest.mock('@/lib/data/useFoodReviews', () => ({ useGlobalReviews: (enabled: boolean) => mockFeed(enabled) }));

import { ReviewFeed } from '../ReviewFeed';

const REVIEW = {
  id: 'r1', foodId: '7', rating: 4, body: 'Great dish', photos: [], memberId: '9',
  foodName: 'Server Kimbap', foodImageUrl: 'https://cdn/kimbap.jpg',
  author: { memberId: '9', nickname: 'Amy', nationality: 'US', tier: 'taster', level: 2 },
  authorNationality: 'US', authorRankTier: 'taster', anonymized: false,
  createdAt: '2026-08-11T00:00:00Z', likes: 3, myLike: false,
};

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ReviewFeed />);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest.mockReturnValue(false);
  mockFeed.mockReturnValue({
    data: { pages: [{ items: [REVIEW], hasNext: false, nextCursor: null }] },
    isLoading: false, isError: false, error: null, refetch: jest.fn(),
    hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
  });
});

it('카드 = P-169 문법 — 작성자·별점·서버 음식 카드·Helpful, 탭 라우팅 3종', () => {
  const tree = render();
  // FlatList 엘리먼트 prop(circular) 회피 — 텍스트/이미지 노드 직접 수집
  const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
  expect(texts).toContain('Amy');
  expect(texts).toContain('Server Kimbap');
  expect(texts.some((x) => x.includes('reviews.helpful'))).toBe(true);
  // CardPhoto(expo-image)는 source가 문자열 — 양쪽 형태 수집
  const imgs = tree.root
    .findAll((n) => n.props?.source != null)
    .map((n) => (typeof n.props.source === 'string' ? n.props.source : (n.props.source?.uri as string)))
    .filter(Boolean);
  expect(imgs).toContain('https://cdn/kimbap.jpg');
  // P-182: 카드 전체 탭 제거 — feed 카드에 onPress 없음, ⋯는 본인(memberId 9 = me) 셀에 존재
  const card = tree.root.findAll((n) => n.props?.testID === 'feed-r1');
  expect(card.every((n) => typeof n.props?.onPress !== 'function')).toBe(true);
  expect(tree.root.findAll((n) => n.props?.testID === 'feed-more-r1').length).toBeGreaterThanOrEqual(1);
  act(() => tree.root.findAll((n) => n.props?.testID === 'feed-food-r1')[0].props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/food/7');
  act(() => tree.root.findAll((n) => n.props?.testID === 'feed-helpful-r1')[0].props.onPress());
  expect(mockToggle).toHaveBeenCalledWith({ reviewId: 'r1', foodId: '7' });
});

it('FAB → 음식 픽커(작성 시트 재사용, kind=food) → 선택 = 리뷰 작성 라우팅', () => {
  const tree = render();
  act(() => tree.root.findAll((n) => n.props?.testID === 'feed-write-fab')[0].props.onPress());
  const props = mockSheet.mock.calls.at(-1)![0] as { kind: string; onToggleFood: (f: { foodId: string; name: string }) => void };
  expect(props.kind).toBe('food');
  act(() => props.onToggleFood({ foodId: '7', name: 'Kimbap' }));
  expect(mockPush).toHaveBeenCalledWith('/food/7/review');
});

it('게스트 = 피드 호출 0(인증 필수 계약) + 게이트 카드', () => {
  mockIsGuest.mockReturnValue(true);
  mockFeed.mockReturnValue({
    data: undefined, isLoading: false, isError: false, error: null, refetch: jest.fn(),
    hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
  });
  const tree = render();
  expect(mockFeed).toHaveBeenCalledWith(false); // enabled=false — 호출 0
  expect(tree.root.findAll((n) => n.props?.testID === 'feed-guest-gate').length).toBeGreaterThanOrEqual(1);
});

it('P-181 ③: 헤더 장식 벨 부재(피드·구 글 피드 소스 모두)', () => {
  const tree = render();
  expect(tree.root.findAll((n) => n.props?.testID === 'review-feed').length).toBeGreaterThanOrEqual(1);
  const fs = require('fs');
  expect(fs.readFileSync('src/features/community/ReviewFeed.tsx', 'utf8')).not.toContain('IconBell');
  const tab = fs.readFileSync('src/app/(tabs)/community.tsx', 'utf8') as string;
  expect(tab.includes('<IconBell')).toBe(false);
});

it('소스 잠금 — 글 기능 보존형 플래그·리뷰 피드 분기는 coming-soon 가드 뒤(prod 무변)', () => {
  const fs = require('fs');
  const flags = fs.readFileSync('src/lib/flags.ts', 'utf8') as string;
  expect(flags).toContain('communityPostsEnabled: false');
  const tab = fs.readFileSync('src/app/(tabs)/community.tsx', 'utf8') as string;
  const guardIdx = tab.indexOf('FLAGS.communityEnabled) return <ComingSoon');
  const feedIdx = tab.indexOf('FLAGS.communityPostsEnabled) return <ReviewFeed');
  expect(guardIdx).toBeGreaterThan(-1);
  expect(feedIdx).toBeGreaterThan(guardIdx); // 채널 가드가 먼저 — prod coming-soon 유지
  expect(tab).toContain('PostCard'); // 글 피드 코드 보존
});
