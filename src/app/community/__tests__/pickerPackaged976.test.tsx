/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock 팩토리는 require, 대상 import는 목 뒤 */
/**
 * KB-976(P-589): 리뷰 탭 작성 대상 고르기 — 통합 검색과 같은 All/Dishes/Packaged 칩 + 가공식품 구역.
 * 빈 검색 = 편의점 인기(스캔분 아래) · 검색 = 음식 결과 아래 · Packaged 칩 = 가공식품만 · Dishes = 음식만(요청 0).
 * onPickPackaged를 안 넘기는 호출(글 작성·필터) = 현행 그대로. 쓰기 플래그 off = 칩 없음.
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
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
    // P-337: GestureDetector(RNGH)가 요구하는 이벤트 훅 스텁
    runOnJS: (fn: (...a: unknown[]) => void) => fn,
    useEvent: () => () => {},
    useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
  };
});
// P-337 3R: Modal 내 GestureHandlerRootView — jest엔 네이티브 install 부재라 통짜 목
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = () => {
    const g: Record<string, unknown> = {};
    for (const k of ['runOnJS', 'enabled', 'numberOfTaps', 'maxPointers', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'activeOffsetY', 'failOffsetX']) g[k] = () => g;
    return g;
  };
  return {
    GestureDetector: ({ children }: { children: unknown }) => children,
    GestureHandlerRootView: View,
    Gesture: { Pan: chain, Pinch: chain, Tap: chain, Simultaneous: (...g: unknown[]) => g, Exclusive: (...g: unknown[]) => g },
  };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-image-picker', () => ({}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useScrollToTop: () => {},
  useSegments: () => [],
  useRouter: () => ({ push: mockPush, navigate: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
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
jest.mock('@/components/SuccessCheck', () => ({ SuccessCheck: () => null }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/lib/analytics', () => ({ EVENTS: new Proxy({}, { get: (_t, k) => k }), track: jest.fn() }));
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: '9', restrictions: [] } }) }));
jest.mock('@/lib/community/hooks', () => ({
  useCommunityPost: () => ({ data: null }),
  useCreatePost: () => ({ mutate: jest.fn() }),
  useUpdatePost: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/community/places', () => ({ searchPlaces: () => [] }));
const mockIsGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest() }));

const SCANNED = [{ foodId: '1', name: 'Kimchi Stew', nameKo: '김치찌개', photoUrl: null }];
const POPULAR = [{ foodId: '10', name: 'Tteokbokki', nameKo: '떡볶이', photoUrl: null }];
const RAMYEON = [{ foodId: '20', name: 'Ramyeon Stew', nameKo: '라면찌개', photoUrl: null }];
jest.mock('@/lib/data/useFoods', () => ({
  useScannedFoods: (enabled: boolean) => (enabled ? { data: SCANNED, isPending: false } : { data: undefined }),
  useSearchFoods: (q: string) => ({ data: q ? RAMYEON : [] }),
  useInfiniteFoods: () => ({ data: POPULAR }),
}));
const pf = (id: string, name: string) => ({ id, name, nameKo: `${name}-ko`, maker: null, imageUrl: null });
const CVS = Array.from({ length: 8 }, (_, i) => pf(`c${i}`, `Snack ${i}`));
const mockPkg = jest.fn((q: string, _f?: unknown) => ({ data: { items: q ? [pf('1711', 'Shin Ramyun')] : CVS }, isPending: false, isSuccess: true, isError: false }));
jest.mock('@/lib/data/useProcessedFoods', () => ({
  useProcessedSearchPaged: (q: string, f?: unknown) => mockPkg(q, f),
}));

import { TagPickerSheet } from '../compose';
import { FLAGS } from '@/lib/flags';

const t = (k: string) => k;
const trees: ReactTestRenderer[] = [];
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });

const sheet = (onPickPackaged?: jest.Mock) => (
  <TagPickerSheet kind="food" foodTags={[]} placeTag={null} onToggleFood={jest.fn()} onTogglePlace={jest.fn()} onClose={jest.fn()} t={t} context="review" onPickPackaged={onPickPackaged} />
);
const texts = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.type === 'Text').map((n) => n.children.join(''));
// testID는 Pressable 래퍼마다 반복된다 — 가장 바깥(부모에 같은 testID 없음)만
const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function' && n.parent?.props?.testID !== id);
const type = (tree: ReactTestRenderer, q: string) => act(() => tree.root.findAll((n) => typeof n.props?.onChangeText === 'function')[0].props.onChangeText(q));

beforeEach(() => { jest.clearAllMocks(); mockIsGuest.mockReturnValue(false); });

it('빈 검색: 칩 3개 + 스캔분 아래 "편의점 인기" 5개 — 고르면 onPickPackaged(제품)', () => {
  const pick = jest.fn();
  const tree = render(sheet(pick));
  expect(['all', 'dishes', 'packaged'].map((s) => byId(tree, `picker-seg-${s}`).length > 0)).toEqual([true, true, true]);
  const tx = texts(tree);
  expect(tx).toContain('home.cvsTitle');
  expect(tx.indexOf('community.sectionRecentlyScanned')).toBeLessThan(tx.indexOf('home.cvsTitle'));
  expect(tx.indexOf('home.cvsTitle')).toBeLessThan(tx.indexOf('community.sectionAllFoods')); // 스캔분 바로 아래
  expect(byId(tree, 'compose-result-packaged')).toHaveLength(5);
  expect(mockPkg).toHaveBeenLastCalledWith('', {}); // 홈 편의점 줄과 같은 빈 검색 쿼리
  act(() => byId(tree, 'compose-result-packaged')[0].props.onPress());
  expect(pick).toHaveBeenCalledWith(expect.objectContaining({ id: 'c0' }));
});

it("검색 'ramyeon': 전체 = Dishes 구역 + Packaged 구역 · Packaged 칩 = 가공식품만 · Dishes 칩 = 음식만(가공식품 요청 off)", () => {
  const tree = render(sheet(jest.fn()));
  type(tree, 'ramyeon');
  let tx = texts(tree);
  expect(tx).toEqual(expect.arrayContaining(['packaged.segmentDishes', 'packaged.segmentPackaged', 'Ramyeon Stew', 'Shin Ramyun']));
  expect(tx.indexOf('Ramyeon Stew')).toBeLessThan(tx.indexOf('Shin Ramyun'));
  act(() => byId(tree, 'picker-seg-packaged')[0].props.onPress());
  tx = texts(tree);
  expect(tx).toContain('Shin Ramyun');
  expect(tx).not.toContain('Ramyeon Stew');
  mockPkg.mockClear();
  act(() => byId(tree, 'picker-seg-dishes')[0].props.onPress());
  tx = texts(tree);
  expect(tx).toContain('Ramyeon Stew');
  expect(tx).not.toContain('Shin Ramyun');
  expect(mockPkg).not.toHaveBeenCalled(); // Dishes = 가공식품 구역 언마운트(요청 0)
});

it('onPickPackaged 없음(글 작성·필터 픽커) = 칩·가공식품 0, 요청 off — 음식 흐름 현행', () => {
  const tree = render(sheet(undefined));
  expect(byId(tree, 'picker-seg-all')).toHaveLength(0);
  expect(byId(tree, 'compose-result-packaged')).toHaveLength(0);
  expect(texts(tree)).toEqual(expect.arrayContaining(['community.sectionRecentlyScanned', 'Kimchi Stew']));
  expect(mockPkg).not.toHaveBeenCalled();
});

it('가공식품 리뷰 쓰기 플래그 off = 상세 버튼과 같이 칩·구역 없음', () => {
  const prev = FLAGS.packagedReviewWrite;
  (FLAGS as { packagedReviewWrite: boolean }).packagedReviewWrite = false;
  try {
    const tree = render(sheet(jest.fn()));
    expect(byId(tree, 'picker-seg-all')).toHaveLength(0);
    expect(byId(tree, 'compose-result-packaged')).toHaveLength(0);
  } finally {
    (FLAGS as { packagedReviewWrite: boolean }).packagedReviewWrite = prev;
  }
});
