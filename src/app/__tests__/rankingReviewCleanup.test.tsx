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

it('oneMore 행·리뷰 쓰기 CTA 부재, 스캔 CTA 유지', () => {
  const tree = render(<RankingScreen />);
  expect(texts(tree, 'ranking.oneMore')).toBe(0);
  expect(texts(tree, 'ranking.oneMorePlus')).toBe(0);
  expect(texts(tree, 'ranking.ctaReview')).toBe(0);
  expect(texts(tree, 'ranking.ctaScan')).toBeGreaterThanOrEqual(1);
});

it('리뷰 팩터 dim 예고 행 상시 노출 — 라벨+예고 문구', () => {
  const tree = render(<RankingScreen />);
  expect(texts(tree, 'ranking.reviewsLabel')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'ranking.reviewsComing')).toBeGreaterThanOrEqual(1);
});

// P-058: 다양성도 dim 예고 (리뷰 작성 적립 구조 — MVP에선 죽은 지표)
it('P-058: 다양성 행 dim 예고 — 실적 detail 미렌더, 예고 2행·스캔만 활성', () => {
  const tree = render(<RankingScreen />);
  expect(texts(tree, 'ranking.diversityLabel')).toBeGreaterThanOrEqual(1);
  expect(texts(tree, 'ranking.diversityDetail')).toBe(0); // 실적 문구 제거
  expect(texts(tree, 'ranking.reviewsComing')).toBeGreaterThanOrEqual(2); // 리뷰+다양성 (Txt 래퍼 중복 계상 허용)
  expect(texts(tree, 'ranking.scansDetail')).toBeGreaterThanOrEqual(1); // 스캔은 활성
});
