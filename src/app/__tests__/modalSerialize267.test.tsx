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
    useSharedValue: (v: unknown) => ({ value: v, get() { return this.value; }, set(next: unknown) { this.value = next; } }),
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
  useFocusEffect: (cb: () => void) => cb(), // P-255: 진입 선발급 훅 목
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
})); // ML Kit 네이티브 차단
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

// P-267(KB-377): 코치마크·프라이머 제어 목 — 직렬화 실측용
const mockShouldShowCoach = jest.fn();
jest.mock('@/features/scan/ScanCoachMark', () => {
  const actual = jest.requireActual('@/features/scan/ScanCoachMark');
  return {
    ...actual,
    shouldShowCoachMark: () => mockShouldShowCoach(),
    markCoachSeen: jest.fn(),
  };
});
const mockGetPrimer = jest.fn();
jest.mock('@/lib/push/pushAdapter', () => ({
  ...jest.requireActual('@/lib/push/pushAdapter'),
  getPrimerResult: () => mockGetPrimer(),
}));

import Scan from '../scan';
import { ScanCoachMark } from '@/features/scan/ScanCoachMark';
import { PushPrimerModal } from '@/features/push/PushPrimerModal';
import { ReviewPromptSheet } from '@/components/ReviewPromptSheet';
import { ScanExitPrompts } from '@/features/scan/ScanExitPrompts';

// KB-908(T-010): 넛지·리뷰 유도 호스트는 루트에 — 스캔만 내려 "떠남"을 재현한다(같은 트리에서 호스트는 살아 있음)
function App({ scan = true }: { scan?: boolean }) {
  return (<>{scan && <Scan />}<ScanExitPrompts /></>);
}

/**
 * P-267(KB-377): 첫 스캔 결과 화면 먹통 — 코치마크·푸시 프라이머 일회성 모달
 * **직렬화** 잠금. 동시 present = 네이티브 fullScreenModal 위 RN Modal 2개 같은
 * 커밋 present → iOS UIKit 교착(터치 무반응). 코치 우선 → 닫힌 뒤 프라이머.
 */
function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

async function reachResult(tree: ReactTestRenderer) {
  const gallery = tree.root.findAll((n) => n.props?.accessibilityLabel === 'scanCamera.choosePhoto' && typeof n.props?.onPress === 'function');
  await act(async () => {
    await gallery[0].props.onPress();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0)); // 순차 판정 async 체인 플러시
  });
}
const coachOpen = (t: ReactTestRenderer) => t.root.findAllByType(ScanCoachMark).some((n) => n.props.open === true);
const primerOpen = (t: ReactTestRenderer) => t.root.findAllByType(PushPrimerModal).some((n) => n.props.open === true);

beforeEach(() => {
  jest.clearAllMocks();
  mockShouldShowCoach.mockResolvedValue(true);
  mockGetPrimer.mockResolvedValue(null); // 미응답자 = 프라이머 후보
});

it('① 첫 스캔(코치 대상·프라이머 후보) — 동시 present 불가: 코치만 열리고 프라이머 보류', async () => {
  const tree = render(<Scan />);
  await reachResult(tree);
  expect(coachOpen(tree)).toBe(true);
  expect(primerOpen(tree)).toBe(false); // KB-377 교착 원인 — 동시 true 절대 금지
});

const reviewOpen = (t: ReactTestRenderer) => t.root.findAllByType(ReviewPromptSheet).some((n) => n.props.open === true);
async function leaveScan(tree: ReactTestRenderer) {
  await act(async () => { tree.update(<App scan={false} />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); }); // runAfterInteractions + 판정 async 체인
}

it('② KB-908(T-010): 코치마크가 닫혀도 결과 화면엔 프라이머 0 — 스캔을 떠난 뒤 하나만', async () => {
  const tree = render(<App />);
  await reachResult(tree);
  const coach = tree.root.findAllByType(ScanCoachMark)[0];
  await act(async () => {
    coach.props.onClose();
    coach.props.onDismiss();
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(coachOpen(tree)).toBe(false);
  expect(primerOpen(tree)).toBe(false); // 결과 직후 2연속 금지(QA aos#7)
  expect(reviewOpen(tree)).toBe(false);
  await leaveScan(tree);
  expect(primerOpen(tree)).toBe(true);
  expect(reviewOpen(tree)).toBe(false); // 한 번에 하나
});

it('②-b 배선 — 코치마크 onDismiss·안드 onClose 큐 완료는 그대로 · 결과 큐엔 코치마크만 · 나갈 때 루트 호스트', () => {
  const fs = require('fs');
  expect(fs.readFileSync('src/features/scan/ScanCoachMark.tsx', 'utf8')).toContain('onDismiss={onDismiss}');
  const scan = fs.readFileSync('src/app/scan.tsx', 'utf8') as string;
  expect(scan).toContain("onDismiss={Platform.OS === 'ios' ? () => settle(coachDoneRef) : undefined}");
  expect(scan).toContain("if (Platform.OS !== 'ios') settle(coachDoneRef);");
  expect(scan).toContain('armScanExitPrompt({ isGuest, ready: scanRecordedRef.current });');
  expect(scan).toContain('useEffect(() => () => fireScanExitPrompt(), []);');
  expect(scan).not.toMatch(/nudgeStep|reviewStep|<PushPrimerModal|<ReviewPromptSheet/);
  expect(fs.readFileSync('src/app/_layout.tsx', 'utf8')).toContain('<ScanExitPrompts />');
});

it('③ 코치마크 비대상(기존자) = 결과 화면엔 아무것도 안 뜸 · 떠나면 프라이머', async () => {
  mockShouldShowCoach.mockResolvedValue(false);
  const tree = render(<App />);
  await reachResult(tree);
  expect(coachOpen(tree)).toBe(false);
  expect(primerOpen(tree)).toBe(false);
  await leaveScan(tree);
  expect(primerOpen(tree)).toBe(true);
});

it('③-b 결과 없이 스캔을 닫음(카메라에서 X) = 아무것도 안 뜸', async () => {
  mockShouldShowCoach.mockResolvedValue(false);
  const tree = render(<App />);
  await leaveScan(tree);
  expect(primerOpen(tree)).toBe(false);
  expect(reviewOpen(tree)).toBe(false);
});

it('④ 프라이머 기응답자 = 떠나도 프라이머 안 뜸(기록 로직 무변)', async () => {
  mockGetPrimer.mockResolvedValue('declined');
  const tree = render(<App />);
  await reachResult(tree);
  await leaveScan(tree);
  expect(primerOpen(tree)).toBe(false);
});
