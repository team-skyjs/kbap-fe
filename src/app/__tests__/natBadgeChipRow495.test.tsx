/**
 * P-340(KB-495) — ① 리뷰 작성자 국기 배지(1-B) ② 음식 탭 칩 한 줄 고정(2-A) 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

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
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: (p: Record<string, unknown>) => <View {...p} testID="chip-fade" /> };
});
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
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
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '9', restrictions: [] } }) }));
jest.mock('@/lib/data/useFoods', () => ({ useInfiniteFoods: () => ({ data: [], isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() }) }));
jest.mock('@/lib/data/bookmarks', () => ({
  useBookmarks: () => ({ data: [], hasNextPage: false, isFetchingNextPage: false, isFetching: false, fetchNextPage: jest.fn() }),
  useToggleBookmark: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/data/useReviewMutations', () => ({ useToggleReviewLike: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/analytics', () => ({ EVENTS: new Proxy({}, { get: (_t, k) => String(k) }), track: jest.fn() }));

import { FeedCard } from '@/features/review/FeedCard';
import { FoodExplorer } from '@/features/food/FoodExplorer';
import type { Review } from '@/lib/api/types';

const REVIEW = {
  id: 'r1', foodId: '7', rating: 4, body: 'Great', photos: [], memberId: '5',
  foodName: 'Kimbap', foodImageUrl: null,
  author: { memberId: '5', nickname: 'Amy', nationality: 'US', tier: 'taster', level: 2 },
  authorNationality: 'US', authorRankTier: 'taster', anonymized: false,
  createdAt: '2026-08-11T00:00:00Z', likes: 3, myLike: false,
} as unknown as Review;

const t = (k: string) => k;

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  return tree;
}

it('1-B 국기 배지 — 국적 있으면 아바타 우하단 렌더(장식 — 무음) · 탈퇴/국적 null = 없음', () => {
  const on = render(<FeedCard review={REVIEW} t={t} mine={false} onOpenFood={() => {}} onMore={() => {}} />);
  const badge = on.root.findAll((n) => n.props?.testID === 'feed-flag-r1')[0];
  expect(badge).toBeTruthy();
  // Codex #101 P2: 배지 = 장식(스크린리더 무음) — 국가명 라벨 없음(10로케일 미도입)
  expect(badge.props.accessibilityElementsHidden).toBe(true);
  expect(JSON.stringify(on.toJSON())).not.toContain('United States');

  const anon = render(<FeedCard review={{ ...REVIEW, anonymized: true } as Review} t={t} mine={false} onOpenFood={() => {}} onMore={() => {}} />);
  expect(anon.root.findAll((n) => n.props?.testID === 'feed-flag-r1')).toHaveLength(0);
  const noNat = render(<FeedCard review={{ ...REVIEW, authorNationality: null } as unknown as Review} t={t} mine={false} onOpenFood={() => {}} onMore={() => {}} />);
  expect(noNat.root.findAll((n) => n.props?.testID === 'feed-flag-r1')).toHaveLength(0);
});

it('1-B 소스 잠금 — FlagEmoji = 국기 한정 이모지 예외 주석 + 흰 링 배지 스타일', () => {
  const fc = require('fs').readFileSync('src/features/review/FeedCard.tsx', 'utf8') as string;
  expect(fc).toContain('국기 한정 헌법 이모지 예외');
  expect(fc).toMatch(/flagBadge: \{ position: 'absolute', right: -2, bottom: -2, width: 14, height: 14/);
});

it('2-A 음식 탭 칩 = 한 줄 가로 스크롤 + 우측 페이드 + 정렬 버튼 스크롤 밖 · 홈은 무변', () => {
  const tree = render(<FoodExplorer variant="screen" guest={false} srcTag="list" />);
  const scroll = tree.root.findAll((n) => n.props?.testID === 'food-chip-scroll')[0];
  expect(scroll).toBeTruthy();
  expect(scroll.props.horizontal).toBe(true);
  expect(tree.root.findAll((n) => n.props?.testID === 'chip-fade').length).toBeGreaterThanOrEqual(1);
  // 정렬 버튼은 스크롤 밖(형제) — 스크롤 서브트리에 미포함
  expect(scroll.findAll((n: { props?: { testID?: string } }) => n.props?.testID === 'food-sort')).toHaveLength(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'food-sort').length).toBeGreaterThanOrEqual(1);
  // 홈 embedded = 구 chipRow 유지(스크롤 없음)
  const home = render(<FoodExplorer variant="embedded" guest={false} srcTag="home" />);
  expect(home.root.findAll((n) => n.props?.testID === 'food-chip-scroll')).toHaveLength(0);
  // 행 높이 고정 소스 잠금(칩 34 + pad 14/12 + 헤어라인)
  const fx = require('fs').readFileSync('src/features/food/FoodExplorer.tsx', 'utf8') as string;
  expect(fx).toMatch(/chipRowScreen: \{[^}]*paddingTop: 14, paddingBottom: 12[^}]*borderBottomColor: '#EAEBEE'/);
  expect(fx).toMatch(/chipScrollContent: \{[^}]*height: 34/);
});

it('2-A 파라미터 진입 — 선택 칩이 뒤쪽이면 마운트 시 scrollTo', () => {
  const scrollToSpy = jest.fn();
  const { ScrollView } = require('react-native');
  const orig = ScrollView.prototype.scrollTo;
  ScrollView.prototype.scrollTo = scrollToSpy;
  try {
    const tree = render(<FoodExplorer variant="screen" guest={false} initialSaved srcTag="list" />);
    expect(scrollToSpy).toHaveBeenCalledWith({ x: expect.any(Number), animated: false });
    // Codex #101 P2 ③: 마운트 유지 중 파라미터 재동기화에도 재실행
    scrollToSpy.mockClear();
    act(() => { tree.update(<FoodExplorer variant="screen" guest={false} initialRisk="caution" paramsKey="t2" srcTag="list" />); });
    expect(scrollToSpy).toHaveBeenCalled();
  } finally {
    ScrollView.prototype.scrollTo = orig;
  }
});
