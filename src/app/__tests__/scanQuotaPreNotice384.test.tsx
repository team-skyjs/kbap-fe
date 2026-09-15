/**
 * P-384(KB-442) — 스캔 탭 사전 안내: 프로필 쿼터(서버 정본) 소진·미해금이면 티켓 응답 전에 쿼터 화면.
 * 티켓 요청은 유지(403 SCAN-004 경로) + 낡은 프로필(해금됨)은 발급 성공이 카메라 복원.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => (require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients')).ingredientLabel(c),
    imageUrl: () => null,
  }),
}));
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
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    FadeInDown: chain(),
    SlideInDown: chain(),
    ZoomIn: chain(),
    ZoomOut: chain(),
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
// P-064: ScanResultOverlay가 gesture-handler 사용 — 표면 mock
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['onUpdate', 'onEnd', 'onStart', 'onFinalize', 'onChange', 'numberOfTaps', 'maxPointers', 'minPointers', 'enabled', 'runOnJS']) b[k] = () => b; // KB-553: onFinalize(useSheetSwipeDismiss)
    return b;
  };
  return {
    GestureDetector: ({ children }: { children: unknown }) => children,
    Gesture: { Pinch: chain, Pan: chain, Tap: chain, Race: () => ({}), Simultaneous: () => ({}) },
    GestureHandlerRootView: View,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  return { CameraView: View, useCameraPermissions: () => [{ granted: false }, jest.fn()] };
});
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:menu.jpg', width: 900, height: 1200 }] }),
}));
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({
  // 실제처럼 콜백 정체성 기준 1회(렌더마다 재실행하면 포커스 의미가 사라진다)
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/scan',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/scan/ocr', () => ({
  recognizeMenuLines: jest.fn().mockResolvedValue([
    { text: '된장찌개', box: { x: 0.12, y: 0.16, width: 0.5, height: 0.08 } },
    { text: '김치찌개', box: { x: 0.12, y: 0.33, width: 0.5, height: 0.08 } },
    { text: '공기밥', box: { x: 0.12, y: 0.5, width: 0.5, height: 0.08 } },
    { text: '맥북', box: { x: 0.12, y: 0.67, width: 0.5, height: 0.08 } },
  ]),
}));
// P-046: 스캔 오프라인 프로브 — 기본 온라인
jest.mock('@/lib/data/useFoods', () => ({
  useInfiniteFoods: () => ({ isError: false, error: null, refetch: jest.fn() }),
  // P-136 리치 리스트 행이 상세 프리페치 — 표면 목
  useFoodDetail: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
}));
const mockIsGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest() }));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => mockUseMe(),
  useMyReviews: () => ({ data: [] }),
}));
const mockIssue = jest.fn();
jest.mock('@/lib/data/useScan', () => ({
  scanV2Enabled: () => true,
  issueScanTicket: () => mockIssue(),
  useScan: () => ({ mutate: jest.fn(), isPending: false }),
}));

import Scan from '../scan';

const QUOTA = (remaining: number | 'unlimited', unlocked = false) => ({ count: 3, limit: 3, unlocked, remaining });
const quotaShown = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.testID === 'scan-quota-review').length > 0;

function deferred() {
  let resolve!: (v: string) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest.mockReturnValue(false);
});

it('소진·미해금 = 티켓 응답 전에 쿼터 안내(요청은 계속 보냄)', () => {
  const d = deferred();
  mockIssue.mockReturnValue(d.promise);
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0) } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Scan />); });
  expect(mockIssue).toHaveBeenCalled();
  expect(quotaShown(tree)).toBe(true);
});

it('잔여 있음 = 티켓 대기 중 쿼터 안내 없음', () => {
  mockIssue.mockReturnValue(deferred().promise);
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(1) } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Scan />); });
  expect(quotaShown(tree)).toBe(false);
});

it('해금(unlimited)·구서버(null) = 쿼터 안내 없음', () => {
  for (const q of [QUOTA('unlimited', true), null]) {
    mockIssue.mockReturnValue(deferred().promise);
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: q } });
    let tree!: ReactTestRenderer;
    act(() => { tree = renderer.create(<Scan />); });
    expect(quotaShown(tree)).toBe(false);
    act(() => tree.unmount());
  }
});

it('낡은 프로필(소진 표시) + 발급 성공 = 카메라 복원', async () => {
  const d = deferred();
  mockIssue.mockReturnValue(d.promise);
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0) } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Scan />); });
  expect(quotaShown(tree)).toBe(true);
  await act(async () => { d.resolve('t-1'); await d.promise; });
  expect(quotaShown(tree)).toBe(false);
});

it('반증된 프로필은 재포커스에도 다시 잠그지 않음 · 재조회로 새 소진 값이 오면 다시 안내', async () => {
  const ok = Promise.resolve('t');
  mockIssue.mockReturnValue(ok);
  const stale = { data: { restrictions: [], scanQuota: QUOTA(0) } };
  mockUseMe.mockReturnValue(stale);
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Scan />); await ok; });
  expect(quotaShown(tree)).toBe(false); // 발급 성공 = 복원
  const refocus = async () => {
    mockIsGuest.mockReturnValue(true);
    await act(async () => { tree.update(<Scan />); });
    mockIsGuest.mockReturnValue(false);
    act(() => { tree.update(<Scan />); }); // 포커스 콜백 재실행 직후(발급 응답 전)
  };
  await refocus();
  expect(quotaShown(tree)).toBe(false);
  mockIssue.mockReturnValue(new Promise(() => {}));
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0) } }); // 재조회 = 새 객체
  await refocus();
  expect(quotaShown(tree)).toBe(true);
});
