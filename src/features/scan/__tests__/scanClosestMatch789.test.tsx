/**
 * KB-789 — 리치 리스트 대체 행(substituted): Closest match 칩(sparkles SVG) + "Menu says {{scanned}}" 줄.
 * 칩 탭 = 설명 카드 콜백(행 탭 = 상세 그대로) · 비대체 행 미렌더 · 기존 미등록(matched=false) 행 무변.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ScanRichList } from '@/features/scan/ScanRichList';
import type { ResultDish } from '@/lib/scan/segmentMenu';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), usePathname: () => '/', useLocalSearchParams: () => ({}) }));
jest.mock('react-native-reanimated', () => {
  const { View: V } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    useReducedMotion: () => false,
    default: { View: V, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    useAnimatedScrollHandler: () => () => {},
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en', regionCode: 'US' }] }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ lang: 'en', script: 'latin' }) }));
jest.mock('@/lib/i18n', () => ({
  __esModule: true,
  default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k },
}));
jest.mock('@/lib/data/useFoods', () => ({ useFoodDetail: () => ({ data: undefined }) }));


// 보간 확인용 — 옵션이 있으면 키 뒤에 값 병기
const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}:${Object.values(o).join('|')}` : k);
const BOX = { x: 0, y: 0, width: 0.1, height: 0.1 };
const SUB: ResultDish = { itemId: 0, rawMenuName: '김치찌게', box: BOX, priceKrw: 9000, latin: null, risk: 'caution', matched: true, foodId: '8', displayName: 'Kimchi Stew', koreanName: '김치찌개', substituted: true, originalScannedName: '김치찌게' };
const PLAIN: ResultDish = { itemId: 1, rawMenuName: '된장찌개', box: BOX, priceKrw: 8000, latin: null, risk: 'safe', matched: true, foodId: '7', displayName: 'Doenjang Jjigae', koreanName: '된장찌개', substituted: false, originalScannedName: null };
const MISS: ResultDish = { itemId: 2, rawMenuName: '수제비', box: BOX, priceKrw: null, latin: null, risk: 'unable', matched: false, foodId: null, displayName: '수제비', koreanName: null };

function render(dishes: ResultDish[], handlers: { onOpen?: jest.Mock; onClosestMatch?: jest.Mock } = {}): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ScanRichList dishes={dishes} currency="USD" cart={new Map()} onAdd={() => {}} onRemove={() => {}} onOpen={handlers.onOpen ?? (() => {})} onClosestMatch={handlers.onClosestMatch ?? jest.fn()} t={t} />,
    );
  });
  return tree;
}
const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function');
const flat = (tree: ReactTestRenderer) => JSON.stringify(tree.toJSON());

it('substituted=true → 칩(sparkles SVG + 라벨) + "Menu says {{scanned}}" 줄 렌더 · false·미등록 행 = 미렌더', () => {
  const tree = render([SUB, PLAIN, MISS]);
  const chip = byId(tree, 'closest-0');
  expect(chip.length).toBeGreaterThanOrEqual(1); // 공용 Pressable 래퍼 + RN Pressable 둘 다 testID 보유
  // 아이콘 = SVG(텍스트 기호 금지) — Glyph viewBox 24
  expect(chip[0].findAll((n) => n.props?.viewBox === '0 0 24 24').length).toBeGreaterThanOrEqual(1);
  const s = flat(tree);
  expect(s).toContain('scan.closestMatchChip');
  expect(s).toContain('scan.closestMatchLine:김치찌게'); // 보간 scanned = originalScannedName
  expect(byId(tree, 'closest-1')).toHaveLength(0);
  expect(byId(tree, 'closest-2')).toHaveLength(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'closest-line-1')).toHaveLength(0);
  // 기존 미등록 행 무변 — missNote + Google 칩 그대로, 칩 없음
  expect(tree.root.findAll((n) => n.props?.testID === 'miss-2').length).toBeGreaterThanOrEqual(1);
  expect(byId(tree, 'miss-google-2').length).toBeGreaterThanOrEqual(1);
  expect(s).toContain('scan.missNote');
  // 대체 행에는 missNote(부정 문구) 없음 — 긍정 프레임
  expect(tree.root.findAll((n) => n.props?.testID === 'miss-0')).toHaveLength(0);
});

it('칩 탭 = onClosestMatch(해당 dish)만 — 행 onOpen 미발화 · 행 탭 = onOpen 그대로', () => {
  const onOpen = jest.fn();
  const onClosestMatch = jest.fn();
  const tree = render([SUB], { onOpen, onClosestMatch });
  act(() => byId(tree, 'closest-0')[0].props.onPress());
  expect(onClosestMatch).toHaveBeenCalledTimes(1);
  expect(onClosestMatch).toHaveBeenCalledWith(SUB);
  expect(onOpen).not.toHaveBeenCalled();
  act(() => byId(tree, 'rich-0')[0].props.onPress());
  expect(onOpen).toHaveBeenCalledWith(SUB);
  // hitSlop — 11pt 칩의 탭 면적 보강
  expect(byId(tree, 'closest-0')[0].props.hitSlop).toBeGreaterThanOrEqual(8);
});

it('칩 메트릭(시안 14289:8235) — pad 2/8 · pill · primary 12% 틴트 · 보더 없음(상태 전환 없음)', () => {
  const tree = render([SUB]);
  const style = JSON.stringify(byId(tree, 'closest-0')[0].props.style ?? {});
  expect(style).toContain('"paddingVertical":2');
  expect(style).toContain('"paddingHorizontal":8');
  expect(style).toContain('"borderRadius":999');
  expect(style).toContain('rgba(255,113,52,0.12)');
  expect(style).not.toContain('borderWidth');
});

it('originalScannedName 결측(방어) — 칩은 뜨고 "Menu says" 줄만 생략(빈 보간 금지)', () => {
  const tree = render([{ ...SUB, originalScannedName: null }]);
  expect(byId(tree, 'closest-0').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'closest-line-0')).toHaveLength(0);
});
