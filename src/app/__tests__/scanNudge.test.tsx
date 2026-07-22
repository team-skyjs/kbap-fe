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
jest.mock('@/lib/data/useFoods', () => ({ useInfiniteFoods: () => ({ isError: false, error: null, refetch: jest.fn() }) }));
const mockIsGuest = jest.fn(() => false);
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockIsGuest() }));
const mockUseMe = jest.fn();
jest.mock('@/lib/data/useMe', () => ({
  useMe: () => mockUseMe(),
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
import { Btn } from '@/components/Btn';
import { resetNudgeForTest } from '@/lib/scan/nudgeSession';
import { IconClose } from '@/components/icons';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

/** 카메라 화면 → 샘플 스캔 → 결과 화면 */
function renderResult(): ReactTestRenderer {
  const tree = render(<Scan />);
  const sample = tree.root.findAllByType(Btn).find((b) => b.props.children === 'scan.sample');
  act(() => {
    sample!.props.onPress();
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

it('회원 + 기피 0 → 배너 노출', () => {
  expect(nudgeCount(renderResult())).toBeGreaterThanOrEqual(1);
});

it('기피 1개 이상 → 미노출', () => {
  mockUseMe.mockReturnValue({ data: { restrictions: [{ kind: 'allergy', code: 'EGG' }] } });
  expect(nudgeCount(renderResult())).toBe(0);
});

it('게스트 → 미노출 (기존 로그인 게이트 흐름)', () => {
  mockIsGuest.mockReturnValue(true);
  // 게스트는 라우트 가드로 결과 화면 진입 자체가 없음 — 첫 렌더에서 배너 부재만 확인
  expect(nudgeCount(render(<Scan />))).toBe(0);
});

it('닫기 → 세션 내 재마운트에도 미노출 (재실행 시 리셋은 모듈 수명이 보장)', () => {
  const tree = renderResult();
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
  expect(nudgeCount(renderResult())).toBe(0);
});

it('P-057: 목록 뷰 전용 — 위험도 토글로 전환하면 배너 미렌더', () => {
  const tree = renderResult();
  expect(nudgeCount(tree)).toBeGreaterThanOrEqual(1);
  const riskToggle = tree.root.findAll(
    (n) => typeof n.props?.onPress === 'function' && n.findAll((c) => c.props?.children === 'scan.showResult').length > 0,
  );
  expect(riskToggle.length).toBeGreaterThanOrEqual(1);
  act(() => {
    riskToggle[riskToggle.length - 1].props.onPress();
  });
  expect(nudgeCount(tree)).toBe(0);
});
