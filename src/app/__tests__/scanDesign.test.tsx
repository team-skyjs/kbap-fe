/**
 * P-062(KB-232): 스캔 화면 디자인 정합 잠금.
 *  - ⓪ 셔터/갤러리 ref 동기 가드 — 연속 2회 호출에도 픽커 1회(레이스)
 *  - ① Run sample scan 부재(카메라·에러 화면)
 *  - ③ D3 하단 바 — 원형 버튼 4(리스트/위험도/원본/다시찍기)·활성 뷰 주황
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// scanDefaultView 프렐류드 재사용
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
  return { CameraView: View, useCameraPermissions: () => [{ granted: true }, jest.fn()] };
});
const mockLaunchLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (o: unknown) => mockLaunchLibrary(o) }));
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
  // P-136 리치 리스트 행이 상세 프리페치 — 표면 목
  useFoodDetail: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => ({ data: { restrictions: [{ kind: 'allergy', code: 'EGG' }] } }),
  useMyReviews: () => ({ data: [] }),
}));
jest.mock('@/lib/data/useScan', () => ({
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
const texts = (tree: ReactTestRenderer, s: string) => tree.root.findAll((n) => n.props?.children === s).length;
const galleryBtn = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.props?.accessibilityLabel === 'scan.gallery' && typeof n.props?.onPress === 'function')[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:menu.jpg', width: 900, height: 1200 }] });
});

it('⓪ ref 동기 가드: 연속 2회 탭 → 픽커 1회만 (리렌더 전 레이스 차단)', async () => {
  let release!: (v: unknown) => void;
  mockLaunchLibrary.mockReturnValue(new Promise((r) => (release = r)));
  const tree = render(<Scan />);
  const g = galleryBtn(tree);
  await act(async () => {
    void g.props.onPress(); // 첫 탭 — pending
    void g.props.onPress(); // 즉시 재탭(리렌더 전) — ref 가드가 차단해야
    release({ canceled: true });
  });
  expect(mockLaunchLibrary).toHaveBeenCalledTimes(1);
});

it('① Run sample scan 부재 — 카메라·권한 화면 어디에도 없음', () => {
  const tree = render(<Scan />);
  expect(texts(tree, 'scan.sample')).toBe(0);
});

it('③→P-136 콰이엇 크롬 — 세그 토글·다시찍기·범례 4종, 구 플로팅 라벨·캡션 부재', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  expect(texts(tree, 'scan.resultCaption')).toBe(0); // P-064: 캡션 삭제 유지
  expect(texts(tree, '₩8,000')).toBe(0); // 기본=risk 뷰 — 가격은 리스트 행만
  // 구 D3 플로팅 라벨 소멸 (원본 세그 소멸 — 피크로 존치)
  for (const k of ['scan.showList', 'scan.showResult', 'scan.showOriginal']) expect(texts(tree, k)).toBe(0);
  // 콰이엇 헤더: 세그 2 + 다시찍기 아이콘 버튼
  for (const id of ['seg-risk', 'seg-list', 'retake']) {
    expect(tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function').length).toBeGreaterThanOrEqual(1);
  }
  // P-136(S1b 채택): 위험도 범례 4종 줄
  expect(tree.root.findAll((n) => n.props?.testID === 'risk-legend').length).toBeGreaterThanOrEqual(1);
  for (const k of ['risk.safe', 'risk.caution', 'risk.danger', 'risk.unable']) {
    expect(texts(tree, k)).toBeGreaterThanOrEqual(1);
  }
});

it('P-064③→P-136 원본 피크 존치 — 배경 꾹=미니시트 pointerEvents none, 뗌=복귀', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  // 기본=risk 뷰 — 배경(사진) 롱프레스 진입점
  const bg = tree.root.findAll((n) => typeof n.props?.onLongPress === 'function');
  expect(bg.length).toBeGreaterThanOrEqual(1);
  act(() => {
    bg[0].props.onLongPress();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'mini-sheet-wrap' && n.props?.pointerEvents === 'none').length).toBeGreaterThanOrEqual(1);
  act(() => {
    bg[0].props.onPressOut();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'mini-sheet-wrap' && n.props?.pointerEvents === 'box-none').length).toBeGreaterThanOrEqual(1);
});

it('P-136 뷰 전환 — 범례는 risk 뷰 전용, 리스트 뷰=프로필 체크 줄+하단 안내문', async () => {
  const tree = render(<Scan />);
  await act(async () => {
    await galleryBtn(tree).props.onPress();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'risk-legend').length).toBeGreaterThanOrEqual(1);
  const toList = tree.root.findAll((n) => n.props?.testID === 'seg-list')[0];
  act(() => {
    toList.props.onPress();
  });
  expect(tree.root.findAll((n) => n.props?.testID === 'risk-legend').length).toBe(0);
  const s = JSON.stringify(tree.toJSON());
  expect(s).toContain('scan.checkedAgainst');
  expect(s).toContain('scan.listFootNote');
  // 리스트 스크롤 여백 — 필/탭바 클리어런스 (mock inset 0 → 120)
  expect(tree.root.findAll((n) => n.props?.contentContainerStyle?.paddingBottom === 120).length).toBeGreaterThanOrEqual(1);
});
