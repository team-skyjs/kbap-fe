/**
 * P-122: 카메라 권한 게이트 — 거부 이력(canAskAgain=false)이면 "설정 열기" +
 * Linking.openSettings, 아니면 현행 requestPermission. 설정 복귀(AppState active)
 * 시 권한 재조회로 게이트 자동 해제. (프렐류드는 scanDefaultView 복제)
 */
/**
 * P-071(KB-233, 7/24 예진 확정): 스캔 완료 시 기본 화면은 **사진+마커(risk)** —
 * "찍었으니 사진이 보여야지"(신규 유저 멘탈 모델). KB-140의 리스트 기본은
 * 파파고 개편으로 근거 소멸. 리스트·원본은 하단 버튼 전환 — 전환 무회귀 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// P-174: 재료 카탈로그 훅 표면 목 — 폴백 경로(서버 무데이터) = 종전 렌더와 동일
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
    ReducedMotionConfig: () => null,
    ReduceMotion: { System: 'system' },
    FadeIn: chain(),
    FadeOut: chain(),
    SlideInDown: chain(),
    withDelay: (_d: number, v: unknown) => v,
    useAnimatedProps: () => ({}),
    ZoomIn: chain(),
    ZoomOut: chain(),
    FadeInDown: chain(),
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => true,
    withTiming: (v: unknown) => v,
    withSequence: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: 0 },
  };
});
// P-064: ScanResultOverlay가 gesture-handler 사용 — 표면 mock
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
  // 실 API 계약 = Promise<PermissionResponse> 반환(P-214 권한 결과 계측이 이걸 소비)
  const state = {
    perm: { granted: false, canAskAgain: true } as { granted: boolean; canAskAgain: boolean },
    request: jest.fn(() => Promise.resolve({ granted: false, canAskAgain: true })),
    get: jest.fn(),
  };
  return { CameraView: View, useCameraPermissions: () => [state.perm, state.request, state.get], __camState: state };
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
  useFocusEffect: (cb: () => void) => cb(), // P-255: 진입 선발급 훅 목
  useSegments: () => [], // P-214: 계측 화면 식별(StateBlock·HelpfulButton)
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
jest.mock('@/lib/data/useFoods', () => ({ useInfiniteFoods: () => ({ isError: false, error: null, refetch: jest.fn() }) })); // ML Kit 네이티브 차단
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { restrictions: [] } }),
  useMyReviews: () => ({ data: [] }),
}));
// BE 왕복 mock: 전 항목 즉시 판정 반환 (맥북=unmatched)
jest.mock('@/lib/data/useScan', () => ({
  scanV2Enabled: () => false, // P-153: 이 스위트 픽스처는 v1(온디바이스 OCR) 경로 잠금
  useScan: () => ({
    mutate: (
      _vars: unknown,
      { onSuccess }: { onSuccess: (r: { items: unknown[]; degraded: boolean }) => void },
    ) =>
      onSuccess({
        degraded: false,
        items: [
          { itemId: 0, rawMenuName: '된장찌개', box: { x: 0, y: 0, width: 0.1, height: 0.1 }, risk: 'safe', matched: true, foodId: '1', displayName: 'Doenjang Jjigae', koreanName: '된장찌개', price: 8000 },
          { itemId: 3, rawMenuName: '맥북', box: { x: 0, y: 0.5, width: 0.1, height: 0.1 }, risk: 'unable', matched: false, foodId: null, displayName: '맥북', koreanName: null, price: null },
        ],
        // idx=null(사진에서만 추출) — 리스트에 노출되어야 함 (P-002 안전 게이트, 드롭 금지)
        photoOnly: [
          { risk: 'danger', matched: true, foodId: '42', displayName: '사진전용육회', koreanName: null, price: null },
        ],
      }),
  }),
}));


import { AppState, Linking } from 'react-native';
import Scan from '../scan';

/* eslint-disable @typescript-eslint/no-require-imports */
const cam = (require('expo-camera') as unknown as { __camState: { perm: { granted: boolean; canAskAgain: boolean }; request: jest.Mock; get: jest.Mock } }).__camState;
/* eslint-enable @typescript-eslint/no-require-imports */

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

const gateBtn = (tree: ReactTestRenderer, key: string) =>
  tree.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === key).length > 0);

afterEach(() => jest.restoreAllMocks());

/* ---- KB-426: 진입 즉시 OS 팝업(자동 요청) ---- */
it('KB-426: 미결정(canAskAgain=true) — 마운트 시 자동 requestPermission 1회(재렌더에도 1회)', () => {
  cam.perm = { granted: false, canAskAgain: true };
  cam.request.mockClear();
  const tree = render(<Scan />);
  expect(cam.request).toHaveBeenCalledTimes(1); // 진입 즉시 OS 팝업
  act(() => tree.update(<Scan />)); // 리렌더(동일 인스턴스) — ref 가드로 재요청 없음
  expect(cam.request).toHaveBeenCalledTimes(1);
});

it('KB-426: granted — 자동 요청 0회', () => {
  cam.perm = { granted: true, canAskAgain: true };
  cam.request.mockClear();
  render(<Scan />);
  expect(cam.request).not.toHaveBeenCalled();
});

it('KB-426: 거부 이력(canAskAgain=false) — 자동 요청 0회(설정 CTA 경로 유지)', () => {
  cam.perm = { granted: false, canAskAgain: false };
  cam.request.mockClear();
  const tree = render(<Scan />);
  expect(cam.request).not.toHaveBeenCalled();
  expect(gateBtn(tree, 'photo.openSettings').length).toBeGreaterThanOrEqual(1);
});

it('KB-426 소스 잠금 — auto_prompt 계측 + 요청 결과 grant/deny 계측 동반', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const src = require('fs').readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(src).toContain("state: 'auto_prompt'");
  expect(src.split("state: 'auto_prompt'")[1]).toContain("r?.granted ? 'grant' : 'deny'");
});

it('canAskAgain=true — 현행 requestPermission 버튼(scan.grant)', () => {
  cam.perm = { granted: false, canAskAgain: true };
  const tree = render(<Scan />);
  const grant = gateBtn(tree, 'scan.grant');
  expect(grant.length).toBeGreaterThanOrEqual(1);
  act(() => grant[0].props.onPress());
  expect(cam.request).toHaveBeenCalled();
  expect(gateBtn(tree, 'photo.openSettings')).toHaveLength(0);
});

it('거부 이력(canAskAgain=false) — 설정 문구+설정 열기 버튼 → Linking.openSettings', () => {
  cam.perm = { granted: false, canAskAgain: false };
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as never);
  const tree = render(<Scan />);
  expect(gateBtn(tree, 'scan.grant')).toHaveLength(0);
  expect(tree.root.findAll((n) => n.props?.children === 'scan.permissionSettingsBody').length).toBeGreaterThanOrEqual(1);
  const btn = gateBtn(tree, 'photo.openSettings');
  expect(btn.length).toBeGreaterThanOrEqual(1);
  act(() => btn[0].props.onPress());
  expect(open).toHaveBeenCalled();
});

it('설정 복귀(AppState active) — 권한 재조회 호출(게이트 자동 해제 경로)', () => {
  cam.perm = { granted: false, canAskAgain: false };
  const handlers: ((s: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
    handlers.push(cb);
    return { remove: jest.fn() };
  }) as never);
  render(<Scan />);
  expect(handlers.length).toBeGreaterThanOrEqual(1);
  act(() => handlers.forEach((h) => h('active')));
  expect(cam.get).toHaveBeenCalled();
});

/* ---- P-131: 가로 허용 + 줌 UI ---- */
it('P-131: granted 카메라 — 세로 유도 오버레이 부재 + 줌 프리셋 1x/2x 렌더', () => {
  cam.perm = { granted: true, canAskAgain: true };
  const tree = render(<Scan />);
  const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children);
  expect(texts).not.toContain('scan.rotateToPortrait'); // 오버레이 소멸
  expect(tree.root.findAll((n) => n.props?.testID === 'zoom-x1').length).toBeGreaterThanOrEqual(1);
  expect(tree.root.findAll((n) => n.props?.testID === 'zoom-x2').length).toBeGreaterThanOrEqual(1);
});
