/**
 * KB-140 회귀: 스캔 완료 시 기본 화면은 **리스트** — 오버레이(사진 위 마커)가
 * 기본이면 하단 버튼과 메뉴가 겹치는 문제(2026-07-14 결정으로 리스트 전환).
 * 오버레이는 토글로만 진입해야 한다.
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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  return { CameraView: View, useCameraPermissions: () => [{ granted: false }, jest.fn()] };
});
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
import { Btn } from '@/components/Btn';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('스캔 완료 시 기본 화면은 리스트 — 오버레이는 렌더되지 않는다', () => {
  const tree = render(<Scan />);
  // 카메라 화면의 "샘플 스캔" 버튼 → BE mock 즉시 성공 → 결과 화면
  const sample = tree.root
    .findAllByType(Btn)
    .find((b) => b.props.children === 'scan.sample');
  expect(sample).toBeDefined();
  act(() => {
    sample!.props.onPress();
  });
  // 기본 = 리스트: 오버레이 컴포넌트 없음 + 리스트 행(displayName) 렌더
  expect(tree.root.findAllByType(ScanResultOverlay).length).toBe(0);
  const texts = tree.root.findAll((n) => n.props?.children === 'Doenjang Jjigae');
  expect(texts.length).toBeGreaterThanOrEqual(1);
  // P-002: idx=null(사진에서만 추출) 항목도 리스트에 노출 — 드롭 금지 (헌법 III)
  const photoOnlyRow = tree.root.findAll((n) => n.props?.children === '사진전용육회');
  expect(photoOnlyRow.length).toBeGreaterThanOrEqual(1);
  // §14-5: unmatched(맥북)도 리스트에서 숨겨지지 않는다
  expect(tree.root.findAll((n) => n.props?.children === '맥북').length).toBeGreaterThanOrEqual(1);
});
