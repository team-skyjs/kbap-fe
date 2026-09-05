/**
 * KB-431(P-276) D-3 — 음식 상세·리뷰 화면 디자인 4차 잠금.
 * ① 위험 요약 행 4상태 틴트(9/5 예진 확정 — 시안 인스턴스 그대로: caution 붉은/danger 노란)
 * ② 재료 필터 칩 4상태 클라 필터 ③ 평점 세로 바 높이 = 점수/5 비례
 * ④ 재료 타일 그리드 = 태그 단위 줄바꿈(flexWrap·flexShrink 0·이름 1줄) 소스 잠금.
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
import { AxisBar } from '../food/[id]/reviews';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id);

it('① 위험 요약 행 틴트 — riskTone 매핑(시안 인스턴스: caution #FFF3EF / danger #FFFDEF)', () => {
  expect(riskTone.safe.bg).toBe('#EFFFF7');
  expect(riskTone.caution.bg).toBe('#FFF3EF');
  expect(riskTone.danger.bg).toBe('#FFFDEF');
  expect(riskTone.unable.bg).toBe('#ECECEC');
  // 상세 위험 요약 행 = riskTone.bg 배선(소스 잠금 — 4상태 자동 추종)
  const src = require('fs').readFileSync('src/app/food/[id]/index.tsx', 'utf8') as string;
  expect(src).toContain('backgroundColor: riskTone[dishRisk].bg');
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

it('④ 재료 타일 — 태그(타일) 단위 줄바꿈: flexWrap + flexShrink 0 + 이름 1줄(§3 규칙)', () => {
  const src = require('fs').readFileSync('src/app/food/[id]/index.tsx', 'utf8') as string;
  expect(src).toMatch(/ingGrid: \{[^}]*flexWrap: 'wrap'/);
  expect(src).toMatch(/ingTile: \{[^}]*flexShrink: 0/);
  expect(src).toContain('<Text style={styles.ingTileName} numberOfLines={1}>');
});
