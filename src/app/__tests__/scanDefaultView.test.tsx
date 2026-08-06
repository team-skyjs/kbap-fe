/**
 * P-071(KB-233, 7/24 예진 확정): 스캔 완료 시 기본 화면은 **사진+마커(risk)** —
 * "찍었으니 사진이 보여야지"(신규 유저 멘탈 모델). KB-140의 리스트 기본은
 * 파파고 개편으로 근거 소멸. 리스트·원본은 하단 버튼 전환 — 전환 무회귀 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

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

import Scan from '../scan';
import { ScanResultOverlay } from '@/features/scan/ScanResultOverlay';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('P-071: 스캔 완료 시 기본 화면은 사진+마커 — 리스트는 버튼 전환으로', async () => {
  const tree = render(<Scan />);
  // P-062①: 샘플 폐기 — 갤러리 경로(OCR mock→실 segmentMenu)로 결과 진입
  const gallery = tree.root.findAll((n) => n.props?.accessibilityLabel === 'scan.gallery' && typeof n.props?.onPress === 'function');
  expect(gallery.length).toBeGreaterThanOrEqual(1);
  await act(async () => {
    await gallery[0].props.onPress();
  });
  // 기본 = risk: 오버레이(사진+마커) 렌더 + 마커 표시
  const overlays = tree.root.findAllByType(ScanResultOverlay);
  expect(overlays.length).toBe(1);
  expect(overlays[0].props.showMarkers).toBe(true);
  // 리스트 전환 (하단 버튼) → 행 노출 무회귀
  const listBtn = tree.root.findAll(
    (n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'scan.showList').length > 0,
  );
  act(() => {
    listBtn[listBtn.length - 1].props.onPress();
  });
  expect(tree.root.findAllByType(ScanResultOverlay).length).toBe(0);
  const texts = tree.root.findAll((n) => n.props?.children === 'Doenjang Jjigae');
  expect(texts.length).toBeGreaterThanOrEqual(1);
  // P-002: idx=null(사진에서만 추출) 항목도 리스트에 노출 — 드롭 금지 (헌법 III)
  const photoOnlyRow = tree.root.findAll((n) => n.props?.children === '사진전용육회');
  expect(photoOnlyRow.length).toBeGreaterThanOrEqual(1);
  // §14-5: unmatched(맥북)도 리스트에서 숨겨지지 않는다
  expect(tree.root.findAll((n) => n.props?.children === '맥북').length).toBeGreaterThanOrEqual(1);
});
