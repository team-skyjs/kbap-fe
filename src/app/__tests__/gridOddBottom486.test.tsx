/**
 * P-333/P-334(KB-486) — ① 2열 그리드 홀수 자리표시자(마지막 카드 풀폭 확장 방지)
 * ② 저장 그리드 카드 = 전원 위험 배지(캡처 누락 의심 — 현행 코드 판정 검증)
 * ③ 음식 상세 하단 바 flex 3/5·아이콘 없는 Ask·oneLine + Read all chevron 소스 잠금.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c ?? Pressable },
    createAnimatedComponent: (c: unknown) => c,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    useAnimatedScrollHandler: () => () => {},
    useAnimatedProps: () => ({}),
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@/lib/analytics', () => ({ EVENTS: new Proxy({}, { get: (_t, k) => String(k) }), track: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('expo-router', () => ({
  useSegments: () => [],
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  useFocusEffect: () => {},
}));

import { padOddGrid, isGridPad, FoodGridCard } from '@/features/food/FoodCards';
import type { FoodCard } from '@/lib/api/types';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
const FOOD = (id: string): FoodCard => ({
  foodId: id, name: `Food ${id}`, nameKo: `음식 ${id}`, photoUrl: null, risk: 'safe',
} as FoodCard);

it('P-333 ① padOddGrid — 홀수 = 자리표시자 1개로 마지막 행 2셀 유지 · 짝수 = 무변', () => {
  const three = padOddGrid([FOOD('1'), FOOD('2'), FOOD('3')]);
  expect(three).toHaveLength(4);
  expect(isGridPad(three[3])).toBe(true);
  expect(padOddGrid([FOOD('1'), FOOD('2')])).toHaveLength(2);
  expect(padOddGrid([])).toHaveLength(0);
});

it('P-333 ① 배선 — saved·음식 탭 그리드 = padOddGrid + __pad 빈 셀 렌더, gcard 구 47% 기본 폐기', () => {
  const sv = read('src/app/profile/saved.tsx');
  expect(sv).toContain('data={padOddGrid(items)}');
  expect(sv).toContain('testID="saved-grid-pad"');
  const fx = read('src/features/food/FoodExplorer.tsx');
  expect(fx).toContain('data={padOddGrid(gridFoods)}');
  expect(fx).toContain('testID="food-grid-pad"');
  const fc = read('src/features/food/FoodCards.tsx');
  expect(fc).not.toContain("width: '47%'");
  expect(fc).not.toMatch(/gcard: \{[^}]*flexGrow: 1/);
});

it('P-333 ② 저장 카드 배지 — 회원(guest=false) 카드 3장 전부 RiskBadge 렌더(캡처 누락 = 현행 코드 재현 불가 판정)', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <>
        {['1', '2', '3'].map((id) => (
          <FoodGridCard
            key={id}
            food={FOOD(id)}
            risk="safe"
            guest={false}
            saved
            riskLabel="Safe"
            onPress={() => {}}
            onBookmark={() => {}}
          />
        ))}
      </>,
    );
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'risk-badge-safe' && typeof n.type === 'string').length).toBe(3);
});

it('P-334 — 하단 바 Write flex3/Ask flex5·아이콘 없음·oneLine, Read all chevron 16, Btn pad 10 소스 잠금', () => {
  const fd = read('src/app/food/[id]/index.tsx');
  expect(fd).toContain('bottomWrite: { flex: 3 }');
  expect(fd).toMatch(/<View style=\{\{ flex: 5 \}\}>\{\/\* P-334[^]*?<Btn oneLine onPress=\{onAsk\} testID="bottom-ask">/);
  expect(fd).toMatch(/<Btn variant=\{onAsk \? 'ghost' : 'primary'\} oneLine onPress=\{onWrite\} testID="bottom-write">/);
  expect(fd).toMatch(/iconEnd=\{<IconChevron size=\{16\}[^}]*\}/);
  const btn = read('src/components/Btn.tsx');
  expect(btn).toContain('paddingHorizontal: 10, // P-334');
  expect(btn).toContain('iconEndGap: { marginLeft: 2 }');
  expect(btn).toContain('minimumFontScale={oneLine ? 0.85 : undefined}');
});
