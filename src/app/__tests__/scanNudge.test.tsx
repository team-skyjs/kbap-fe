/**
 * P-038→P-057(KB-212): 빈 프로필 첫 스캔 배너 잠금 (A안 — 리스트 첫 카드).
 *  - 회원 + 기피 0 → 노출 / 기피 1+ → 미노출 / 게스트 → 미노출(로그인 게이트 흐름)
 *  - 닫기 → 세션 내 재마운트에도 미노출 (영구 아님 — 모듈 플래그)
 *  - 목록 뷰 전용 — 위험도/원본 토글 시 미노출 (P-057)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// scanDefaultView.test 프렐류드 재사용
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
import { resetNudgeForTest } from '@/lib/scan/nudgeSession';
import { IconClose } from '@/components/icons';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

/** P-062①: 샘플 스캔 폐기 — 갤러리 경로로 결과 화면 구동 (OCR mock → 실 segmentMenu) */
async function renderResult(): Promise<ReactTestRenderer> {
  const tree = render(<Scan />);
  const gallery = tree.root.findAll((n) => n.props?.accessibilityLabel === 'scan.gallery' && typeof n.props?.onPress === 'function');
  expect(gallery.length).toBeGreaterThanOrEqual(1);
  await act(async () => {
    await gallery[0].props.onPress();
  });
  // P-071: 기본=risk — 배너는 목록 뷰 전용(P-057)이라 리스트로 전환해 검증
  const toList = tree.root.findAll((n) => n.props?.testID === 'seg-list' && typeof n.props?.onPress === 'function');
  act(() => {
    toList[toList.length - 1].props.onPress();
  });
  return tree;
}

const nudgeCount = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.children === 'scan.nudgeAction').length;

beforeEach(() => {
  jest.clearAllMocks();
  resetNudgeForTest();
  mockIsGuest.mockReturnValue(false);
  mockUseMe.mockReturnValue({ data: { restrictions: [] } });
});

it('회원 + 기피 0 → 배너 노출', async () => {
  expect(nudgeCount(await renderResult())).toBeGreaterThanOrEqual(1);
});

it('기피 1개 이상 → 미노출', async () => {
  mockUseMe.mockReturnValue({ data: { restrictions: [{ kind: 'allergy', code: 'EGG' }] } });
  expect(nudgeCount(await renderResult())).toBe(0);
});

it('게스트 → 미노출 (기존 로그인 게이트 흐름)', () => {
  mockIsGuest.mockReturnValue(true);
  // 게스트는 라우트 가드로 결과 화면 진입 자체가 없음 — 첫 렌더에서 배너 부재만 확인
  expect(nudgeCount(render(<Scan />))).toBe(0);
});

it('닫기 → 세션 내 재마운트에도 미노출 (재실행 시 리셋은 모듈 수명이 보장)', async () => {
  const tree = await renderResult();
  expect(nudgeCount(tree)).toBeGreaterThanOrEqual(1);
  // 배너 내부의 × — 부모 체인(≤3)에 nudgeAction 텍스트가 있는 IconClose Pressable
  const closeBtns = tree.root
    .findAll((n) => typeof n.props?.onPress === 'function' && n.props?.hitSlop === 8 && n.findAllByType(IconClose).length === 1)
    .filter((n) => {
      let p = n.parent;
      for (let d = 0; p && d < 3; d++, p = p.parent as typeof p) {
        if (p.findAll((c) => c.props?.children === 'scan.nudgeAction').length > 0) return true;
      }
      return false;
    });
  expect(closeBtns.length).toBeGreaterThanOrEqual(1); // 컴포지트+호스트 이중 표현 허용
  act(() => {
    closeBtns[0].props.onPress();
  });
  expect(nudgeCount(tree)).toBe(0);
  // 재마운트(같은 세션) — 억제 유지
  expect(nudgeCount(await renderResult())).toBe(0);
});

it('P-057: 목록 뷰 전용 — 위험도 토글로 전환하면 배너 미렌더', async () => {
  const tree = await renderResult();
  expect(nudgeCount(tree)).toBeGreaterThanOrEqual(1);
  const riskToggle = tree.root.findAll((n) => n.props?.testID === 'seg-risk' && typeof n.props?.onPress === 'function');
  expect(riskToggle.length).toBeGreaterThanOrEqual(1);
  act(() => {
    riskToggle[riskToggle.length - 1].props.onPress();
  });
  expect(nudgeCount(tree)).toBe(0);
});
