/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock 팩토리는 require, 대상 import는 목 뒤 */
/**
 * KB-969(P-592) 스캔 화면 배선 — 사진 스캔(packagedVisionScan) on: 모드 탭 없음(카메라 하나 = 가공식품 흐름) ·
 * 비전이 메뉴판으로 판별한 사진 = 같은 사진·이미 올린 경로로 메뉴 v2(uploadedPath, 재업로드 0, scan_start source vision) ·
 * 메뉴 쿼터 소진이면 기존 소진 화면(가공식품은 소진과 무관하게 열림 — 커맨드 11/03 합의).
 */
import * as React from 'react';
import { preloadReactNative, PRELOAD_TIMEOUT_MS } from '@/__tests__/helpers/preloadReactNative';
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
    useSharedValue: (v: unknown) => ({ value: v, get() { return this.value; }, set(next: unknown) { this.value = next; } }),
    cancelAnimation: jest.fn(),
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
// KB-769: 스캔 결과 이탈 가드(useLeaveConfirm) — 포커스·내비 표면 + usePreventRemove 기록(scanDesign이 콜백을 흉내)
jest.mock('expo-router/build/react-navigation/core', () => ({ usePreventRemove: (on: boolean, cb: unknown) => { (globalThis as { __prevent?: unknown }).__prevent = { on, cb }; } }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), /* P-508: scan.tsx 진입 파라미터(mode·label) */
  useIsFocused: () => true,
  useNavigation: () => ({ dispatch: (a: unknown) => (globalThis as { __navDispatch?: (a: unknown) => void }).__navDispatch?.(a) }),
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
const mockMutate = jest.fn();
jest.mock('@/lib/data/useScan', () => ({
  scanV2Enabled: () => true,
  issueScanTicket: () => mockIssue(),
  useScan: () => ({ isPending: false, mutate: (v: unknown) => mockMutate(v) }),
}));
let mockFlowProps: { onMenuPhoto?: (p: { uri: string; width: number; height: number }, path: string) => void } | null = null;
jest.mock('@/features/scan/PackagedScanFlow', () => ({
  ...jest.requireActual('@/features/scan/PackagedScanFlow'),
  PackagedScanFlow: (p: typeof mockFlowProps) => { mockFlowProps = p; return null; },
}));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));

import Scan from '../scan';
import { FLAGS } from '@/lib/flags';

const QUOTA = (remaining: number | 'unlimited', unlocked = false) => ({ count: 3, limit: 3, unlocked, remaining });
const quotaShown = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.testID === 'scan-quota-review').length > 0;
const SHOT = { uri: 'file:menu.jpg', width: 1200, height: 1600 };
const prev = FLAGS.packagedVisionScan;

beforeAll(preloadReactNative, PRELOAD_TIMEOUT_MS);
beforeEach(() => {
  jest.clearAllMocks();
  mockFlowProps = null;
  mockIsGuest.mockReturnValue(false);
  mockIssue.mockReturnValue(new Promise(() => {}));
  (FLAGS as { packagedVisionScan: boolean }).packagedVisionScan = true;
});
afterAll(() => { (FLAGS as { packagedVisionScan: boolean }).packagedVisionScan = prev; });

it('on: 모드 탭 없음 · 처음부터 가공식품 흐름(카메라 하나)에 메뉴 경로(onMenuPhoto)를 건넨다', () => {
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(2) } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Scan />); });
  expect(tree.root.findAll((n) => n.props?.testID === 'scan-mode-tabs')).toHaveLength(0);
  expect(typeof mockFlowProps?.onMenuPhoto).toBe('function');
});

it('메뉴판 판별 = 같은 사진·올린 경로로 메뉴 v2(재업로드 0) · scan_start source vision', () => {
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(2) } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Scan />); });
  act(() => mockFlowProps!.onMenuPhoto!(SHOT, 'images/packaged-scans/v1.jpg'));
  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ items: [], photo: SHOT, uploadedPath: 'images/packaged-scans/v1.jpg' }));
  expect(mockTrack).toHaveBeenCalledWith('scan_start', { source: 'vision' });
  expect(quotaShown(tree)).toBe(false);
});

it('메뉴 쿼터 소진 = 기존 소진 화면 · 메뉴 스캔 요청 0', () => {
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0) } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Scan />); });
  expect(quotaShown(tree)).toBe(false); // 진입은 열림(가공식품)
  act(() => mockFlowProps!.onMenuPhoto!(SHOT, 'images/packaged-scans/v1.jpg'));
  expect(quotaShown(tree)).toBe(true);
  expect(mockMutate).not.toHaveBeenCalled();
});
