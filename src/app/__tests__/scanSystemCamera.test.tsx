/**
 * P-137: 시스템 카메라 경로 A/B — flag on일 때 런처·촬영 합류·취소 복귀·권한
 * 딥링크·autolaunch 분기. flag off(기본)의 현행 무변은 scanDesign/scanDefaultView
 * 등 기존 스위트가 잠근다(기본 FLAGS로 커스텀 카메라 크롬 단언).
 */
import * as React from 'react';
import { Alert } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// P-137: 플래그 게터 목 — 케이스별로 autolaunch 변형 토글
let mockAuto = false;
// P-174: 재료 카탈로그 훅 표면 목 — 폴백 경로(서버 무데이터) = 종전 렌더와 동일
jest.mock('@/lib/data/useIngredientCatalog', () => ({
  useIngredientCatalog: () => ({
    name: (c: string) => (require('@/lib/mocks/ingredients') as typeof import('@/lib/mocks/ingredients')).ingredientLabel(c),
    imageUrl: () => null,
  }),
}));
jest.mock('@/lib/flags', () => ({
  get FLAGS() {
    return { ...jest.requireActual('@/lib/flags').FLAGS, systemCamera: true };
  },
  get SYSTEM_CAMERA_AUTOLAUNCH() {
    return mockAuto;
  },
  isProdChannel: () => false,
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
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = () => {
    const b: Record<string, (..._a: unknown[]) => unknown> = {};
    for (const k of ['onUpdate', 'onEnd', 'onStart', 'numberOfTaps', 'maxPointers', 'minPointers', 'enabled', 'runOnJS']) b[k] = () => b;
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
  return { CameraView: View, useCameraPermissions: () => [{ granted: true }, jest.fn(), jest.fn()] };
});
const mockLaunchLibrary = jest.fn();
const mockLaunchCamera = jest.fn();
const mockReqCamPerm = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (o: unknown) => mockLaunchLibrary(o),
  launchCameraAsync: (o: unknown) => mockLaunchCamera(o),
  requestCameraPermissionsAsync: () => mockReqCamPerm(),
}));
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => cb(), // P-255: 진입 선발급 훅 목
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/scan',
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('@/features/scan/ScanCoachMark', () => ({ ScanCoachMark: () => null, shouldShowCoachMark: async () => false, markCoachSeen: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/scan/ocr', () => ({
  recognizeMenuLines: jest.fn().mockResolvedValue([
    { text: '된장찌개', box: { x: 0.12, y: 0.16, width: 0.5, height: 0.08 } },
  ]),
}));
jest.mock('@/lib/data/useFoods', () => ({
  useInfiniteFoods: () => ({ isError: false, error: null, refetch: jest.fn() }),
  useFoodDetail: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { restrictions: [{ kind: 'allergy', code: 'EGG' }] } }),
  useMyReviews: () => ({ data: [] }),
}));
jest.mock('@/lib/data/useScan', () => ({
  scanV2Enabled: () => false, // P-153: 이 스위트 픽스처는 v1(온디바이스 OCR) 경로 잠금
  useScan: () => ({
    mutate: (
      _vars: unknown,
      { onSuccess }: { onSuccess: (r: { items: unknown[]; photoOnly: unknown[]; degraded: boolean }) => void },
    ) =>
      onSuccess({
        degraded: false,
        items: [
          { itemId: 0, rawMenuName: '된장찌개', box: { x: 0, y: 0, width: 0.1, height: 0.1 }, risk: 'safe', matched: true, foodId: '1', displayName: 'Doenjang Jjigae', koreanName: '된장찌개', price: 8000 },
        ],
        photoOnly: [],
      }),
  }),
}));

import Scan from '../scan';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}
const flat = (tree: ReactTestRenderer) => JSON.stringify(tree.toJSON());
const captureBtn = (tree: ReactTestRenderer) =>
  tree.root
    .findAll((n) => n.props?.testID === 'sys-capture-wrap')[0]
    .findAll((n) => typeof n.props?.onPress === 'function')[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockAuto = false;
  mockReqCamPerm.mockResolvedValue({ granted: true });
  mockLaunchCamera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:cam.jpg', width: 900, height: 1200 }] });
});

it('flag on → 런처 렌더: 촬영 CTA+갤러리 보조+안내, 커스텀 카메라 크롬 부재', () => {
  const tree = render(<Scan />);
  const s = flat(tree);
  expect(s).toContain('scan.launcherHint');
  expect(s).toContain('photo.take');
  expect(s).toContain('scan.gallery');
  expect(tree.root.findAll((n) => n.props?.testID === 'sys-capture-wrap').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'sys-gallery').length).toBeGreaterThanOrEqual(1);
  // 커스텀 크롬(줌 프리셋·셔터 힌트) 부재
  expect(s).not.toContain('scan.cameraHintPortrait');
  expect(tree.root.findAll((n) => n.props?.testID === 'zoom-x1').length).toBe(0);
});

it('촬영 → launchCameraAsync 산출물이 기존 처리(OCR→BE→결과)로 합류', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await captureBtn(tree).props.onPress();
  });
  expect(mockLaunchCamera).toHaveBeenCalledWith(expect.objectContaining({ quality: 0.8 }));
  // 결과 화면 도달 — P-138⑤ 기본=List(프로필 체크 줄)
  expect(flat(tree)).toContain('scan.checkedAgainst');
});

it('취소 → 런처 복귀(에러 없음)', async () => {
  mockLaunchCamera.mockResolvedValue({ canceled: true });
  const tree = render(<Scan />);
  await act(async () => {
    await captureBtn(tree).props.onPress();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'sys-capture-wrap').length).toBeGreaterThanOrEqual(1);
  expect(flat(tree)).not.toContain('scan.errCapture');
});

it('권한 거부 → P-122 설정 딥링크 분기(Alert) 재사용, 흐름 불막음', async () => {
  mockReqCamPerm.mockResolvedValue({ granted: false });
  const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = render(<Scan />);
  await act(async () => {
    await captureBtn(tree).props.onPress();
  });
  expect(mockLaunchCamera).not.toHaveBeenCalled();
  expect(spy).toHaveBeenCalledWith(
    'scan.permissionTitle',
    'scan.permissionSettingsBody',
    expect.arrayContaining([expect.objectContaining({ text: 'photo.openSettings' })]),
  );
  // 런처 유지 — 재시도 가능
  expect(tree.root.findAll((n) => n.props?.testID === 'sys-capture-wrap').length).toBeGreaterThanOrEqual(1);
  spy.mockRestore();
});

it('autolaunch 변형 → 탭 진입 즉시 카메라 실행(1회)', async () => {
  mockAuto = true;
  mockLaunchCamera.mockResolvedValue({ canceled: true }); // 취소 → 런처 표시
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Scan />);
  });
  expect(mockLaunchCamera).toHaveBeenCalledTimes(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'sys-capture-wrap').length).toBeGreaterThanOrEqual(1);
});
