/**
 * KB-431(P-276) D-3 — 음식 상세·리뷰 화면 디자인 4차 잠금.
 * ① 위험 요약 행 4상태 틴트(9/5 예진 확정 — 시안 인스턴스 그대로: caution 붉은/danger 노란)
 * ② 재료 필터 칩 4상태 클라 필터 ③ 평점 세로 바 높이 = 점수/5 비례
 * ④ 재료 타일 그리드 = 태그 단위 줄바꿈(flexWrap·flexShrink 0·이름 1줄) 소스 잠금.
 */
import * as fs from 'fs';
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
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0 },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: '7' }),
  usePathname: () => '/',
  useFocusEffect: () => {},
  Redirect: () => null,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));

import { riskTone } from '@/lib/theme';
// eslint-disable-next-line import/first -- jest.mock 뒤(옛 import 자리 그대로)
import { AxisBar } from '@/features/review/RatingSummaryBox'; // KB-848: 목록·상세 공용 모듈로 이동

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id);

it('① 위험 요약 행 틴트 — KB-908: 띠 배경 = 리본(fg)을 흰 위에 10% 섞은 값(danger 붉은 · caution 주황)', () => {
  const mix10 = (hex: string) => '#' + [1, 3, 5].map((i) => Math.round(255 - (255 - parseInt(hex.slice(i, i + 2), 16)) * 0.1).toString(16).padStart(2, '0')).join('').toUpperCase();
  expect(riskTone.safe.bg).toBe('#EFFFF7');
  expect(riskTone.caution.bg).toBe(mix10(riskTone.caution.fg));
  expect(riskTone.danger.bg).toBe(mix10(riskTone.danger.fg));
  expect([riskTone.caution.bg, riskTone.danger.bg]).toEqual(['#FFF6E9', '#FEF0EF']); // 옛 #FFF3EF / #FFFDEF(뒤바뀌어 보임, QA aos#1)
  expect(riskTone.unable.bg).toBe('#ECECEC');
  // 상세 위험 요약 행 = riskTone.bg 배선(소스 잠금 — 4상태 자동 추종)
  const src = require('fs').readFileSync('src/app/food/[id]/index.tsx', 'utf8') as string;
  // KB-914: 띠 = 공용 VerdictBand(riskTone[state].bg) — 상세는 그 부품을 쓴다
  expect(src).toContain('<VerdictBand state={dishRisk}');
  expect(fs.readFileSync('src/components/VerdictBand.tsx', 'utf8')).toContain('backgroundColor: riskTone[state].bg');
});

it('② 재료 필터 칩 — All + personalRisk 3상태 클라 필터(소스 잠금)', () => {
  const src = require('fs').readFileSync('src/app/food/[id]/index.tsx', 'utf8') as string;
  expect(src).toContain("const ING_CHIPS: IngChip[] = ['all', 'safe', 'danger', 'caution']");
  expect(src).toContain('ingredients.filter((i) => personalRisk(i.risk, hasRestrictions) === ingChip)');
  expect(src).toContain('testID={`ing-chip-${c}`}');
});

it('③ 평점 세로 바 — fill 높이 = 점수/5 × 46(트랙), 최고값 강조', () => {
  const t5 = render(<AxisBar label="Taste" value={5} top testID="ax" />);
  const fill5 = t5.root.findAll((n) => n.props?.testID === 'ax-fill')[0];
  expect(JSON.stringify(fill5.props.style)).toContain('"height":46');
  const t25 = render(<AxisBar label="Speed" value={2.5} top={false} testID="ax2" />);
  const fill25 = t25.root.findAll((n) => n.props?.testID === 'ax2-fill')[0];
  expect(JSON.stringify(fill25.props.style)).toContain('"height":23');
  // 뱃지: top = #2F3137(흰 텍스트) / 나머지 = 회색 뱃지
  expect(JSON.stringify(t5.toJSON())).toContain('#2F3137');
});

it('⑤ RiskBadge 글리프 정렬(Codex #30 P1) — 이중 이동 소멸, 흰 원 중심 +2/+3 단일 이동', () => {
  const src = require('fs').readFileSync('src/components/RiskBadge.tsx', 'utf8') as string;
  expect(src).toContain('"matrix(1,0,0,1,2,3)"');
  expect(src).not.toContain('"matrix(1,0,0,1,6,7)"');
  const { RiskBadge } = require('@/components/RiskBadge') as typeof import('@/components/RiskBadge');
  const tree = render(<RiskBadge state="safe" />);
  expect(byId(tree, 'risk-badge-safe').length).toBeGreaterThanOrEqual(1);
});

it('⑥ RankMedal(Codex #30 P2 → P-315) — 레벨 숫자 텍스트 오버레이 렌더(16/800 흰)', () => {
  const { RankMedal } = require('@/components/RankMedal') as typeof import('@/components/RankMedal');
  const tree = render(<RankMedal level={3} />);
  const num = tree.root.findAll((n) => n.props?.children === 3 || n.props?.children === '3');
  expect(num.length).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(tree.toJSON())).toContain('"fontWeight":"800"'); // P-315 시안: 숫자 16/800
});

it('④ 재료 타일 — 태그(타일) 단위 줄바꿈: flexWrap + flexShrink 0 + 이름 1줄(§3 규칙)', () => {
  // KB-914: 타일·격자 = 공용 IngredientTile(가공식품 감지 재료와 같은 부품) — 상세는 tile.grid 안에 IngredientTile
  const src = fs.readFileSync('src/components/IngredientTile.tsx', 'utf8');
  expect(src).toMatch(/grid: \{[^}]*flexWrap: 'wrap'/);
  expect(src).toMatch(/tile: \{[^}]*flexShrink: 0/);
  expect(src).toContain('<Text style={tile.name} numberOfLines={1}>');
  const detail = fs.readFileSync('src/app/food/[id]/index.tsx', 'utf8');
  expect(detail).toContain('<View style={tile.grid}>');
  expect(detail).toContain('<IngredientTile key={ing.code}');
});
