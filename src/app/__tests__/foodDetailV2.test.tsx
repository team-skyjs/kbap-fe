/**
 * P-139: 음식 상세 v2 시안 정합 잠금.
 *  - 히어로 존재(사진 4:3 / 무사진 폴백) · 헤더 솔리드 전환(스크롤 210)
 *  - verdict 이유 = 성분 조립만(맵기-위험도 결합 문자열 0)
 *  - 재료 정렬 danger→caution→safe · caution 행에만 사유+Ask
 *  - 전부 오픈(접힘 0 — 탭 없이 사유 노출)
 *  - 게스트: verdict 잠금 슬롯 + 재료 고스트 5행 + 잠금 줄 1(섹션 유일 CTA)
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
    withSpring: (v: unknown) => v,
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    SlideInDown: chain(),
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ZoomIn: chain(),
    ZoomOut: chain(),
    FadeInDown: chain(),
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
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: '7' }),
  usePathname: () => '/',
  useFocusEffect: () => {},
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
  default: {
    language: 'en',
    t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
    getFixedT: () => (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
  },
}));
const mockIsGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest() }));
const mockUseFoodDetail = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: () => mockUseFoodDetail() }));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({ useMe: () => mockUseMe() }));
jest.mock('@/lib/data/bookmarks', () => ({ useToggleBookmark: () => ({ mutate: jest.fn() }) }));
// P-169: 상세가 Helpful/신고 뮤테이션·모더레이션 직접 배선 — 표면 목
const mockToggleLike = jest.fn();
jest.mock('@/lib/data/useReviewMutations', () => ({
  useUpdateReview: () => ({ mutate: jest.fn(), isPending: false }),
  useToggleReviewLike: () => ({ mutate: mockToggleLike }),
  useDeleteReview: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/features/community/moderation', () => ({ ModerationFlow: () => null }));
jest.mock('@/lib/data/useFoodReviews', () => ({
  useFoodReviews: () => ({
    refetch: jest.fn(),
    data: {
      pages: [
        {
          items: [
            { id: 'r1', foodId: '7', rating: 5, body: 'Great and safe for me', createdAt: '2026-08-01', authorNationality: 'US', authorRankTier: null, author: { nickname: 'Amy' } },
            { id: 'r2', foodId: '7', rating: 4, body: 'Loved it', createdAt: '2026-08-02', authorNationality: 'JP', authorRankTier: null, author: { nickname: 'Ken' } },
            { id: 'r3', foodId: '7', rating: 3, body: 'Third now renders', createdAt: '2026-08-03', authorNationality: 'US', authorRankTier: null, author: { nickname: 'Zed' } },
            { id: 'r4', foodId: '7', rating: 4, body: 'Fourth', createdAt: '2026-08-04', authorNationality: 'US', authorRankTier: null, author: { nickname: 'D' }, likes: 3, myLike: false },
            { id: 'r5', foodId: '7', rating: 5, body: 'Fifth', createdAt: '2026-08-05', authorNationality: 'US', authorRankTier: null, author: { nickname: 'E' }, photos: ['https://cdn/rv5.jpg'] },
            { id: 'r6', foodId: '7', rating: 2, body: 'Sixth — must not render', createdAt: '2026-08-06', authorNationality: 'US', authorRankTier: null, author: { nickname: 'F' } },
          ],
          hasNext: false,
          nextCursor: null,
        },
      ],
    },
  }),
}));
jest.mock('@/features/scan/ScanCoachMark', () => ({ ScanCoachMark: () => null, shouldShowCoachMark: async () => false, markCoachSeen: jest.fn() }));

import FoodDetailScreen from '../food/[id]/index';
import type { FoodDetail, RiskState } from '@/lib/api/types';

const FOOD = (risk: RiskState, over?: Partial<FoodDetail>): FoodDetail => ({
  foodId: '7',
  name: 'Kimchi Jjigae',
  nameKo: '김치찌개',
  risk,
  riskBasis: [],
  overall: { average: 4.5, count: 12 },
  sameNationality: { average: 4.0, count: 3 },
  description: 'A rich stew.',
  spiceLevel: 'MEDIUM' as FoodDetail['spiceLevel'],
  photoUrl: 'https://cdn/food.jpg',
  ingredients: [
    { code: 'ONION', name: 'Onion', percentage: 100, risk: 'safe', note: null },
    { code: 'PORK', name: 'Pork', percentage: 90, risk: 'danger', note: null },
    { code: 'SHRIMP', name: 'Shrimp', percentage: 30, risk: 'caution', note: 'store-dependent' },
  ],
  isRegistered: true,
  bookmarked: false,
  ...over,
});

const ME = {
  data: {
    id: '1', nickname: 'A', nationality: 'US', readerLanguage: 'en', spiceTolerance: null,
    restrictions: [{ kind: 'allergy' as const, code: 'PORK' }],
    rank: { tier: 'bronze', level: 1, score: 0, nextTier: null, pointsToNext: null },
  },
};

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id);

beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest.mockReturnValue(false);
  mockUseMe.mockReturnValue(ME);
  mockUseFoodDetail.mockReturnValue({ data: FOOD('caution'), isLoading: false, error: null, refetch: jest.fn() });
});

it('히어로 — 사진 4:3 풀블리드, 무사진 = 낮은 폴백 블록', () => {
  const tree = render(<FoodDetailScreen />);
  expect(byId(tree, 'detail-hero').length).toBeGreaterThanOrEqual(1);
  mockUseFoodDetail.mockReturnValue({ data: FOOD('caution', { photoUrl: null }), isLoading: false, error: null, refetch: jest.fn() });
  const tree2 = render(<FoodDetailScreen />);
  expect(byId(tree2, 'detail-hero').length).toBe(0);
  expect(byId(tree2, 'detail-hero-fallback').length).toBeGreaterThanOrEqual(1);
});

it('플로팅 헤더 — 스크롤 210 통과 시 솔리드 전환(버튼 다크 원 해제)', () => {
  const tree = render(<FoodDetailScreen />);
  const backStyle = () => JSON.stringify(tree.root.findAll((n) => n.props?.testID === 'detail-back')[0].props.style);
  expect(backStyle()).toContain('rgba(20,24,31,0.38)'); // 사진 위 = 반투명 다크 원
  const scroller = tree.root.findAll((n) => typeof n.props?.onScroll === 'function' && n.props?.scrollEventThrottle === 16)[0];
  act(() => {
    scroller.props.onScroll({ nativeEvent: { contentOffset: { y: 300 } } });
  });
  expect(backStyle()).toContain('transparent'); // 솔리드 전환
});

it('verdict — 성분 조립 이유(회피 매칭 재료명), 맵기-위험도 결합 문자열 0', () => {
  const tree = render(<FoodDetailScreen />);
  const s = flat(tree);
  expect(s).toContain('detail.verdictContains'); // Contains {list} — 성분 기준
  expect(s).toContain('detail.verdictCaution');
  // 시안의 "6/10"·chili-limit류 결합 금지 — verdict 블록에 맵기 근거 없음
  expect(s).not.toContain('6/10');
  expect(s).not.toContain('chili');
  // 맵기 메타는 타이틀 블록에 현행 5단계로만 존재
  expect(s).toContain('\ud83c\udf36'); // 🌶️ 현행 5단계 표기
});

it('재료 — danger→caution→safe 정렬, 전부 오픈, caution 행에만 사유+Ask', () => {
  const tree = render(<FoodDetailScreen />);
  const s = flat(tree);
  // 정렬: Pork(danger) < Shrimp(caution) < Onion(safe)
  expect(s.indexOf('Pork')).toBeLessThan(s.indexOf('Shrimp'));
  expect(s.indexOf('Shrimp')).toBeLessThan(s.indexOf('Onion'));
  // 전부 오픈 — 탭 없이 caution 사유 노출(기존 중립 조립 키)
  expect(s).toContain('detail.ingBasisCaution');
  // caution 행에만 Ask
  expect(byId(tree, 'ask-SHRIMP').length).toBeGreaterThanOrEqual(1);
  expect(byId(tree, 'ask-PORK').length).toBe(0);
  expect(byId(tree, 'ask-ONION').length).toBe(0);
  // 빈도 실데이터
  expect(s).toContain('detail.ofShops');
});

it('게스트 — verdict 잠금 슬롯 + 재료 고스트 5행 + 잠금 줄(섹션 유일 CTA), 리뷰·평점 풀 오픈', () => {
  mockIsGuest.mockReturnValue(true);
  const tree = render(<FoodDetailScreen />);
  expect(byId(tree, 'verdict-lock').length).toBeGreaterThanOrEqual(1);
  expect(byId(tree, 'detail-verdict').length).toBe(0);
  expect(byId(tree, 'ing-ghost').length).toBeGreaterThanOrEqual(1);
  expect(byId(tree, 'ing-lock').length).toBeGreaterThanOrEqual(1);
  const s = flat(tree);
  expect(s).toContain('detail.lockIngredients');
  // 재료 실명·사유 미노출
  expect(s).not.toContain('Pork');
  expect(s).not.toContain('detail.ingBasisCaution');
  // 리뷰 프리뷰·평점은 풀 오픈(시안 노트 08) — P-169 브리프 헤더로 대체
  expect(s).toContain('Great and safe for me');
  expect(s).toContain('reviews.subtitle');
});

it('P-169: 리뷰 브리프 — 프리뷰 5 제한·헤더 병기·전체보기·Write 고스트 강등', () => {
  const tree = render(<FoodDetailScreen />);
  const s = flat(tree);
  // 프리뷰 5 제한
  expect(s).toContain('Great and safe for me');
  expect(s).toContain('Fifth');
  expect(s).not.toContain('Sixth — must not render');
  // 헤더: 리뷰 수 + 같은 국적 병기 보조 줄(차별점) — 구 2열 카드 소멸
  expect(s).toContain('reviews.subtitle');
  expect(byId(tree, 'same-nat-line').length).toBeGreaterThanOrEqual(1);
  expect(s).not.toContain('detail.allUsers');
  // 전체보기 풀폭(고스트 Btn — Read all 라벨 재사용) + Write a review 존재
  expect(s).toContain('detail.readAll');
  expect(s).toContain('reviews.writeReview');
  // 프리뷰 아이템: 날짜·사진 스트립·Helpful. P-182: 신고 링크 소멸(⋯ = 본인 전용)
  expect(s).toContain('https://cdn/rv5.jpg');
  expect(s).toContain('reviews.helpful');
  expect(s).not.toContain('community.report');
});

it('P-182→P-186: 카드 전체 탭 제거 · ⋯ = 본인+타인(신고/차단), 익명(탈퇴)만 부재', () => {
  const tree = render(<FoodDetailScreen />);
  const rows = tree.root.findAll((n) => n.props?.testID === 'rv-preview-r1');
  expect(rows.length).toBeGreaterThanOrEqual(1);
  expect(rows.every((n) => typeof n.props?.onPress !== 'function')).toBe(true);
  // P-186: 타인 리뷰에도 ⋯(신고·차단 진입 — 스토어 UGC 정책)
  expect(tree.root.findAll((n) => n.props?.testID === 'rv-more-r1').length).toBeGreaterThanOrEqual(1);
});

it('P-182 ③: 리뷰 0건 = 조회 UI 전부 숨김 — 첫 리뷰 CTA만', () => {
  mockUseFoodDetail.mockReturnValue({
    data: FOOD('safe', { overall: { average: null, count: 0 }, sameNationality: { average: null, count: 0 } }),
    isLoading: false, error: null, refetch: jest.fn(),
  });
  const tree = render(<FoodDetailScreen />);
  const s = flat(tree);
  expect(byId(tree, 'review-brief').length).toBe(0); // 평점·병기·프리뷰·전체보기 전부 숨김
  expect(s).not.toContain('detail.readAll');
  expect(byId(tree, 'review-empty-cta').length).toBeGreaterThanOrEqual(1);
  expect(s).toContain('detail.beFirstReview');
  expect(s).toContain('reviews.writeReview'); // Write CTA만
});

it('P-169: 솔리드 CTA 위계 — Btn primary는 Ask the owner 1개뿐', () => {
  const tree = render(<FoodDetailScreen />);
  // Btn 라벨 중 솔리드(primary)는 detail.askOwner만 — writeReview·readAll은 ghost
  const btnLabels = tree.root
    .findAll((n) => n.props?.accessibilityState !== undefined && typeof n.props?.onPress === 'function')
    .map((n) => JSON.stringify(n.children?.toString?.() ?? ''));
  const s = flat(tree);
  const solidCount = (s.match(/"backgroundColor":"#E2580C"/g) ?? []).length;
  expect(s).toContain('detail.askOwner');
  expect(solidCount).toBe(1); // Ask the owner 하나만 솔리드 주황
  void btnLabels;
});

it('P-169: Helpful 탭 → 좋아요 API 배선(회원) — 행 오픈과 독립', () => {
  const tree = render(<FoodDetailScreen />);
  const helpful = tree.root.findAll((n) => n.props?.testID === 'helpful-r4')[0];
  const { act } = require('react-test-renderer');
  act(() => helpful.props.onPress());
  expect(mockToggleLike).toHaveBeenCalledWith({ reviewId: 'r4', foodId: '7' });
});
