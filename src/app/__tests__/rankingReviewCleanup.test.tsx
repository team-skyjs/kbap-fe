/**
 * P-048(KB-125): 랭킹 리뷰 흔적 정리 잠금.
 *  - "리뷰 하나 더 +10점"(oneMore) 행 부재 · 리뷰 쓰기 CTA 부재(스캔 CTA 유지)
 *  - 리뷰 팩터는 dim 예고 행으로 상시 노출(자물쇠+예고 라벨)
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
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', script: 'latin' }) }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/useBottomInset', () => ({ useBottomInset: () => 0 }));
jest.mock('@/lib/data/useRanking', () => ({
  useRanking: () => ({
    data: {
      tier: 'taster', level: 2, score: 45, nextTier: 'explorer', pointsToNext: 35,
      breakdown: {
        reviews: { count: 0, points: 0 },
        diversity: { count: 5, points: 25 },
        scans: { count: 4, points: 20 },
      },
    },
  }),
}));

import RankingScreen from '../profile/ranking';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const texts = (tree: ReactTestRenderer, s: string) => tree.root.findAll((n) => n.props?.children === s).length;

it('oneMore 행·리뷰 쓰기 CTA 부재, 스캔 CTA 유지(KB-434: "Scan a menu +2" 합성 라벨)', () => {
  const tree = render(<RankingScreen />);
  expect(texts(tree, 'ranking.oneMore')).toBe(0);
  expect(texts(tree, 'ranking.oneMorePlus')).toBe(0);
  expect(texts(tree, 'ranking.ctaReview')).toBe(0);
  expect(texts(tree, 'ranking.ctaScan ranking.ctaScanPts')).toBeGreaterThanOrEqual(1);
});

it('P-283(9/5 예진): 점수 내역 3칸 전부 활성 — 리뷰·다양성·스캔 detail+pts, 잠금 문구 0', () => {
  const tree = render(<RankingScreen />);
  expect(texts(tree, 'ranking.reviewsLabel')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'ranking.reviewsDetail')).toBeGreaterThanOrEqual(1); // n reviews × 10 pts
  expect(texts(tree, 'ranking.diversityDetail')).toBeGreaterThanOrEqual(1); // n unique dishes × 5 pts
  expect(texts(tree, 'ranking.scansDetail')).toBeGreaterThanOrEqual(1); // n menu scans × 2 pts
  expect(texts(tree, 'ranking.reviewsComing')).toBe(0); // 잠금 하드코딩 소멸
  expect(texts(tree, 'ranking.gain')).toBeGreaterThanOrEqual(3); // 점수 필 3개(+points)
  const src = require('fs').readFileSync('src/app/profile/ranking.tsx', 'utf8') as string;
  expect(src).not.toContain('D4Lock'); // 자물쇠 소멸
  expect(src).not.toContain('#30C120'); // 하드코드 색 소멸
  expect(src).not.toContain('locked?:'); // BreakCol locked 프롭 소멸
});

// KB-434 D-6: All ranks = 3열 그리드 카드 — 현재 등급 primary 보더 + NOW 배지
it('KB-434: 등급 그리드 — 7카드·NOW 배지·현재 카드 primary 보더·진행 바 대체(간격>30)', () => {
  const tree = render(<RankingScreen />);
  const { StyleSheet } = require('react-native');
  const tierNames = tree.root.findAll((n) => typeof n.props?.children === 'string' && String(n.props.children).startsWith('ranking.tier.'));
  expect(new Set(tierNames.map((n) => n.props.children)).size).toBe(7);
  expect(texts(tree, 'ranking.now')).toBeGreaterThanOrEqual(1); // NOW 배지
  const now = tree.root.findAll((n) => n.props?.testID === 'rank-now' && typeof n.props?.style === 'object')[0];
  expect((StyleSheet.flatten(now.props.style) as { borderColor?: string }).borderColor).toBe('#FF7134');
  // taster→explorer 간격 50pt > 30 = 1별=1pt 규칙 불일치 — 진행 바 대체(발주 규정)
  expect(tree.root.findAll((n) => n.props?.testID === 'ranking-progress-bar').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'ranking-star-grid')).toHaveLength(0);
});

// KB-434: 별 그리드 — newcomer→taster(30pt) = 1별=1pt 그리드, 획득분 채움
it('KB-434: 진행 별 그리드 — 간격 30 이하 = 별 30개(스캔 CTA·규칙은 STAR_GRID_MAX 잠금)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { STAR_GRID_MAX } = require('../profile/ranking') as typeof import('../profile/ranking');
  expect(STAR_GRID_MAX).toBe(30); // 6열 × 5행(시안 4150:14720)
  const src = require('fs').readFileSync('src/app/profile/ranking.tsx', 'utf8') as string;
  expect(src).toContain('span > 0 && span <= STAR_GRID_MAX'); // 그리드/바 분기 소스 잠금
  expect(src).toContain('<PointStar key={i} filled={i < gained} />');
});
