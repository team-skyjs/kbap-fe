/**
 * P-048(KB-125): 랭킹 리뷰 흔적 정리 잠금.
 *  - "리뷰 하나 더 +10점"(oneMore) 행 부재 · 리뷰 쓰기 CTA 부재(스캔 CTA 유지)
 *  - 리뷰 팩터는 dim 예고 행으로 상시 노출(자물쇠+예고 라벨)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// P-305: TabBar가 배럴 경유로 useMe(i18n→AsyncStorage)·RemoteImage(expo-image) 체인을
// 물게 됨 — 이 스위트는 해당 표면 무관이라 목으로 차단
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-image', () => ({ Image: () => null }));

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
const RK_DEFAULT = () => ({
  tier: 'taster', level: 2, score: 45, nextTier: 'explorer', pointsToNext: 35,
  breakdown: {
    reviews: { count: 0, points: 0 },
    diversity: { count: 5, points: 25 },
    scans: { count: 4, points: 20 },
  },
});
const mockRk: { data: ReturnType<typeof RK_DEFAULT> } = { data: RK_DEFAULT() };
jest.mock('@/lib/data/useRanking', () => ({ useRanking: () => mockRk }));
beforeEach(() => { mockRk.data = RK_DEFAULT(); });

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
  // Codex #89 P2: 0점 칸(리뷰 0) = 비활성 필('-') — 활성 gain 2 + 비활성 1(숫자 판정)
  expect(tree.root.findAll((n) => n.props?.testID === 'gain-active' && typeof n.type === 'string')).toHaveLength(2);
  expect(tree.root.findAll((n) => n.props?.testID === 'gain-inactive' && typeof n.type === 'string')).toHaveLength(1);
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
  // P-327: 5각 PointStar → 12각 RankPointBadge(수저 글리프), 6칸 행 단위 chunk
  expect(src).toContain('<RankPointBadge on={i < gained} />');
  expect(src).toContain('chunk6(');
});

it('P-327: 배지 on/off 색·개수 + 6칸 chunk + NOW 카드만 보더', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tierByKey } = require('@/lib/ranking') as typeof import('@/lib/ranking');
  const cur = tierByKey('newcomer')!;
  const next = tierByKey('taster')!;
  const span = next.at - cur.at; // 30 = 그리드 케이스
  const score = cur.at + 8;
  mockRk.data = { ...RK_DEFAULT(), tier: 'newcomer', level: 1, score, nextTier: 'taster' };
  const gained = Math.max(0, Math.min(span, score - cur.at));
  const tree = render(<RankingScreen />);
  const on = tree.root.findAll((n) => n.props?.testID === 'rank-badge-on' && typeof n.type === 'string');
  const off = tree.root.findAll((n) => n.props?.testID === 'rank-badge-off' && typeof n.type === 'string');
  expect(on.length).toBe(gained);
  expect(on.length + off.length).toBe(span);
  // on = 12각 스타 primary fill + 흰 글리프 / off = #F2F3F6 + #D1D3D8 글리프(예진 확인 대기)
  const onNode = tree.root.findAll((n) => n.props?.testID === 'rank-badge-on')[0];
  expect(onNode.findAll((c) => c.props?.fill === '#FF7134').length).toBeGreaterThanOrEqual(1);
  const offNode = tree.root.findAll((n) => n.props?.testID === 'rank-badge-off')[0];
  expect(offNode.findAll((c) => c.props?.fill === '#F2F3F6').length).toBeGreaterThanOrEqual(1);
  expect(offNode.findAll((c) => c.props?.stroke === '#D1D3D8').length).toBeGreaterThanOrEqual(1);
  // 6칸 행 단위
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chunk6 } = require('../profile/ranking') as typeof import('../profile/ranking');
  expect(chunk6(Array.from({ length: span }, (_, i) => i)).length).toBe(Math.ceil(span / 6));
  // NOW 카드만 보더(비현재 = 보더 없음)
  const now = tree.root.findAll((n) => n.props?.testID === 'rank-now')[0];
  expect(JSON.stringify(now.props.style)).toContain('"borderColor":"#FF7134"');
  const others = tree.root.findAll(
    (n) => typeof n.props?.testID === 'string' && /^rank-[a-z]+$/.test(n.props.testID) && n.props.testID !== 'rank-now',
  );
  expect(others.length).toBeGreaterThanOrEqual(1);
  for (const o of others) expect(JSON.stringify(o.props.style)).not.toContain('borderColor');
});

it('P-328: My Foods 두 탭 빈 상태 = EmptyBlock + ScreenCenterFill(소스 잠금) · Go scan CTA 소멸', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const src = require('fs').readFileSync('src/app/profile/my-foods.tsx', 'utf8') as string;
  expect(src).toContain('testID="orders-empty"');
  expect(src).toContain('testID="scans-empty"');
  expect((src.match(/<ScreenCenterFill>/g) ?? []).length).toBe(2);
  expect(src).not.toContain('goScanCta');
  expect(src).not.toContain('emptyScansBody');
});

it('Codex #89 P2: ScreenCenterFill = box-none — 오버레이가 헤더·탭 터치를 안 삼킨다', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ScreenCenterFill } = require('@/components/StateBlock') as typeof import('@/components/StateBlock');
  const { View } = require('react-native');
  const tree = render(React.createElement(ScreenCenterFill, null, React.createElement(View)));
  const fill = tree.root.findAll((n) => n.props?.pointerEvents === 'box-none');
  expect(fill.length).toBeGreaterThanOrEqual(1);
});
