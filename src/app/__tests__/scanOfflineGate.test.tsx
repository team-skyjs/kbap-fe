/**
 * P-046(KB-216): 스캔 진입 오프라인 게이트 잠금.
 *  - 오프라인 → 전체 J4, 카메라·갤러리·샘플 진입로 미렌더 (촬영 자체 불가)
 *  - 온라인 → 기존 카메라 화면 (무회귀)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// scanNudge.test 프렐류드 재사용
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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-camera', () => ({
  // View 재사용 금지 — findAllByType(CameraView)가 모든 View에 매칭됨. 전용 mock.
  CameraView: function MockCameraView() {
    return null;
  },
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-router', () => ({
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
jest.mock('@/lib/scan/ocr', () => ({ recognizeMenuLines: jest.fn() }));
const mockProbe = jest.fn();
jest.mock('@/lib/data/useFoods', () => ({ useInfiniteFoods: () => mockProbe() }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { restrictions: [] } }),
  useMyReviews: () => ({ data: [] }),
}));
jest.mock('@/lib/data/useScan', () => ({ useScan: () => ({ mutate: jest.fn() }) }));

import Scan from '../scan';
import { CameraView } from 'expo-camera';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const texts = (tree: ReactTestRenderer, s: string) => tree.root.findAll((n) => n.props?.children === s).length;

beforeEach(() => {
  jest.clearAllMocks();
  mockProbe.mockReturnValue({ isError: false, error: null, refetch: jest.fn() });
});

it('오프라인 → 전체 J4, 카메라·갤러리·샘플 미렌더 (촬영 자체 불가)', () => {
  mockProbe.mockReturnValue({ isError: true, error: new Error('NETWORK: request failed'), refetch: jest.fn() });
  const tree = render(<Scan />);
  expect(texts(tree, 'states.offlineTitle')).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAllByType(CameraView).length).toBe(0); // 카메라 미기동
  expect(texts(tree, 'scan.sample')).toBe(0); // 샘플 진입로 없음
  expect(texts(tree, 'scan.hint')).toBe(0); // 촬영 UI(갤러리 버튼 포함 하단 바) 없음
});

it('온라인 → 기존 카메라 화면 (무회귀)', () => {
  const tree = render(<Scan />);
  expect(tree.root.findAllByType(CameraView).length).toBe(1);
  expect(texts(tree, 'states.offlineTitle')).toBe(0);
});

it('서버 5xx(J3 아님) → 게이트 미발동 — 오프라인만 차단', () => {
  mockProbe.mockReturnValue({ isError: true, error: new Error('HTTP 500'), refetch: jest.fn() });
  const tree = render(<Scan />);
  expect(tree.root.findAllByType(CameraView).length).toBe(1); // 스캔은 5xx와 무관하게 가능
  expect(texts(tree, 'states.offlineTitle')).toBe(0);
});
