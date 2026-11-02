/**
 * P-384(KB-442) — 스캔 탭 사전 안내: 프로필 쿼터(서버 정본) 소진·미해금이면 티켓 응답 전에 쿼터 화면.
 * → KB-963: 안내 시점 = 진입이 아니라 메뉴 촬영 시도(가공식품은 차감 없음이라 스캔 화면은 늘 열림).
 * 티켓 요청은 유지(403 SCAN-004 경로) + 낡은 프로필(해금됨)은 발급 성공이 카메라 복원.
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
jest.mock('@/lib/data/useScan', () => ({
  scanV2Enabled: () => true,
  issueScanTicket: () => mockIssue(),
  useScan: () => ({
    isPending: false,
    mutate: (_v: unknown, { onSuccess }: { onSuccess: (r: unknown) => void }) =>
      onSuccess({
        degraded: false,
        items: [{ itemId: 0, rawMenuName: '된장찌개', box: { x: 0, y: 0, width: 0.1, height: 0.1 }, risk: 'safe', matched: true, foodId: '1', displayName: 'Doenjang Jjigae', koreanName: '된장찌개', price: 8000 }],
        photoOnly: [],
      }),
  }),
}));

import Scan from '../scan';

const QUOTA = (remaining: number | 'unlimited', unlocked = false) => ({ count: 3, limit: 3, unlocked, remaining });
const quotaShown = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.testID === 'scan-quota-review').length > 0;

function deferred() {
  let resolve!: (v: string) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// KB-698: 첫 렌더의 react-native 지연 모듈 로딩·변환(콜드 캐시 1회 비용)을 첫 테스트의 5000ms 밖으로 — 원인·실측은 helpers 주석
beforeAll(preloadReactNative, PRELOAD_TIMEOUT_MS);
beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest.mockReturnValue(false);
});

// KB-963(예진 11/2): 진입 잠금 0 — 소진이어도 카메라(가공식품은 그대로 사용), 메뉴 촬영 시도(갤러리·셔터·시스템 카메라)에서만 쿼터 안내
const { launchImageLibraryAsync: mockPick } = jest.requireMock('expo-image-picker') as { launchImageLibraryAsync: jest.Mock };
async function shootMenu(tree: ReactTestRenderer) {
  const gallery = tree.root.findAll((n) => n.props?.accessibilityLabel === 'scanCamera.choosePhoto' && typeof n.props?.onPress === 'function');
  await act(async () => { await gallery[0].props.onPress(); });
}

it('KB-963: 소진·미해금 = 진입 시 쿼터 안내 0(카메라) · 메뉴 촬영 시도 = 쿼터 안내 + 사진 고르기 0 · 티켓 요청은 계속', async () => {
  mockIssue.mockReturnValue(deferred().promise);
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0) } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Scan />); });
  expect(mockIssue).toHaveBeenCalled();
  expect(quotaShown(tree)).toBe(false);
  await shootMenu(tree);
  expect(quotaShown(tree)).toBe(true);
  expect(mockPick).not.toHaveBeenCalled();
});

it('KB-963: 쿼터 안내 → 나중에 = 카메라로 복귀(스캔 화면 유지 — 모드 탭에서 가공식품 사용)', async () => {
  mockIssue.mockReturnValue(deferred().promise);
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0) } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Scan />); });
  await shootMenu(tree);
  const later = tree.root.findAll((n) => n.props?.testID === 'scan-quota-later' && typeof n.props?.onPress === 'function')[0];
  act(() => later.props.onPress());
  expect(quotaShown(tree)).toBe(false);
  expect(tree.root.findAll((n) => n.props?.accessibilityLabel === 'scanCamera.choosePhoto').length).toBeGreaterThan(0); // 카메라 화면(닫힘 아님)
  await shootMenu(tree); // 다시 메뉴 촬영 = 다시 안내
  expect(quotaShown(tree)).toBe(true);
});

it('잔여 있음 = 티켓 대기 중 쿼터 안내 없음', () => {
  mockIssue.mockReturnValue(deferred().promise);
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(1) } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Scan />); });
  expect(quotaShown(tree)).toBe(false);
});

it('해금(unlimited)·구서버(null) = 메뉴 촬영해도 쿼터 안내 없음', async () => {
  for (const q of [QUOTA('unlimited', true), null]) {
    mockIssue.mockReturnValue(deferred().promise);
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: q } });
    let tree!: ReactTestRenderer;
    act(() => { tree = renderer.create(<Scan />); });
    await shootMenu(tree);
    expect(quotaShown(tree)).toBe(false);
    act(() => tree.unmount());
  }
});

it('낡은 프로필(소진 표시) + 발급 성공 = 메뉴 촬영 통과(반증)', async () => {
  const d = deferred();
  mockIssue.mockReturnValue(d.promise);
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0) } });
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<Scan />); });
  await act(async () => { d.resolve('t-1'); await d.promise; });
  await shootMenu(tree);
  expect(quotaShown(tree)).toBe(false);
  expect(mockPick).toHaveBeenCalled();
});

describe('반증·재조회', () => {
  const refocus = async (tree: ReactTestRenderer) => {
    mockIsGuest.mockReturnValue(true);
    await act(async () => { tree.update(<Scan />); });
    mockIsGuest.mockReturnValue(false);
    act(() => { tree.update(<Scan />); }); // 포커스 콜백 재실행 직후(발급 응답 전)
  };
  it('반증된 프로필은 재포커스(발급 대기 중)에도 메뉴 촬영을 막지 않음', async () => {
    const ok = Promise.resolve('t');
    mockIssue.mockReturnValue(ok);
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0) } });
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Scan />); await ok; });
    mockIssue.mockReturnValue(new Promise(() => {}));
    await refocus(tree);
    await shootMenu(tree);
    expect(quotaShown(tree)).toBe(false);
  });
  it('재조회로 새 소진 값이 오면(포커스 유지 · 재포커스 불필요) 메뉴 촬영 시 다시 안내 — 진입 화면은 그대로 카메라', async () => {
    const ok = Promise.resolve('t');
    mockIssue.mockReturnValue(ok);
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(1) } });
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Scan />); await ok; });
    const callsBefore = mockIssue.mock.calls.length;
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0) } }); // 스캔 성공 후 재조회 = 새 객체
    act(() => { tree.update(<Scan />); });
    expect(quotaShown(tree)).toBe(false);
    await shootMenu(tree);
    expect(quotaShown(tree)).toBe(true);
    expect(mockIssue.mock.calls.length).toBe(callsBefore); // 포커스 재실행 아님 — 프로필 변화만으로
  });
});

it('Codex #395: 선발급 SCAN-004로 진입 → 카메라 중 해금 프로필 도착(광고·리뷰) = 메뉴 촬영 통과 · 대조: 같은 프로필 그대로면 안내', async () => {
  for (const arrive of [true, false]) {
    jest.clearAllMocks();
    mockIssue.mockRejectedValue(Object.assign(new Error('quota'), { code: 'SCAN-004' }));
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(1) } }); // 프로필은 아직 잔여(서버는 004)
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Scan />); });
    if (arrive) {
      mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA('unlimited', true) } });
      act(() => { tree.update(<Scan />); });
    }
    await shootMenu(tree);
    expect({ arrive, quota: quotaShown(tree) }).toEqual({ arrive, quota: !arrive });
    expect({ arrive, picked: mockPick.mock.calls.length > 0 }).toEqual({ arrive, picked: arrive });
    act(() => tree.unmount());
  }
});

describe('Codex #159 P1: 완료된 스캔 결과는 복귀 포커스로 쿼터 화면에 덮이지 않는다', () => {
  async function toResult() {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Scan />); });
    const gallery = tree.root.findAll((n) => n.props?.accessibilityLabel === 'scanCamera.choosePhoto' && typeof n.props?.onPress === 'function');
    await act(async () => { await gallery[0].props.onPress(); });
    return tree;
  }
  const inResult = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.testID === 'seg-list').length > 0;
  const refocus = async (tree: ReactTestRenderer) => {
    mockIsGuest.mockReturnValue(true);
    await act(async () => { tree.update(<Scan />); });
    mockIsGuest.mockReturnValue(false);
    await act(async () => { tree.update(<Scan />); });
  };

  it('마지막 무료 스캔 후 재조회(잔여 0) + 상세 갔다 복귀 = 결과 유지(프로필 게이트·티켓 403 둘 다)', async () => {
    mockIssue.mockResolvedValue('t');
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(1) } });
    const tree = await toResult();
    expect(inResult(tree)).toBe(true);
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0) } });
    mockIssue.mockRejectedValue(Object.assign(new Error('quota'), { code: 'SCAN-004' }));
    await refocus(tree);
    expect(mockIssue).toHaveBeenCalledTimes(2); // 서버 티켓 확인은 유지
    expect(quotaShown(tree)).toBe(false);
    expect(inResult(tree)).toBe(true);
  });
});

/* KB-670: 선발급 MEMBER-003(탈퇴·정지 회원의 남은 토큰 — 서버 KB-669로 전 회원 API 확대)은 세션 만료 흐름(KB-441
   beAuth → 게스트 전환)이 처리한다. 스캔 화면은 로컬 에러 화면을 세우지 않는다 — 세웠던 에러 state는 게스트 전환 뒤에도
   남아, 같은 기기에서 다시 로그인하면 카메라 대신 에러 화면이 보였다. */
describe('KB-670 선발급 MEMBER-003 = 에러 화면 없음 · 게스트 전환 시 게스트 게이트', () => {
  const errorShown = (tree: ReactTestRenderer) => JSON.stringify(tree.toJSON()).includes('scan.stage.be');
  const guestGate = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => n.props?.context === 'scan' && n.props?.open === true && typeof n.props?.onClose === 'function').length > 0;

  it('MEMBER-003 → 에러 화면을 세우지 않는다(카메라 단계 유지)', async () => {
    mockIssue.mockRejectedValue(Object.assign(new Error('no member'), { code: 'MEMBER-003' }));
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(1) } });
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Scan />); });
    expect(mockIssue).toHaveBeenCalled(); // 대조: 선발급이 실제로 MEMBER-003을 받았다
    expect(errorShown(tree)).toBe(false);
  });

  it('세션 만료로 게스트 전환 → 게스트 게이트 · 이어서 재로그인해도 옛 에러 화면이 남지 않는다', async () => {
    mockIssue.mockRejectedValueOnce(Object.assign(new Error('no member'), { code: 'MEMBER-003' }));
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(1) } });
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Scan />); });
    mockIsGuest.mockReturnValue(true); // KB-441 경로: sessionExpired → 게스트 재평가
    await act(async () => { tree.update(<Scan />); });
    expect(guestGate(tree)).toBe(true);
    mockIssue.mockReturnValue(deferred().promise);
    mockIsGuest.mockReturnValue(false); // 같은 화면에서 재로그인
    await act(async () => { tree.update(<Scan />); });
    expect(errorShown(tree)).toBe(false);
  });

  it('대조군: 선발급 SCAN-004(쿼터) = 진입은 카메라(KB-963) · 메뉴 촬영 시 안내 화면(다른 preflight 오류 무변)', async () => {
    mockIssue.mockRejectedValue(Object.assign(new Error('quota'), { code: 'SCAN-004' }));
    mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(1) } });
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Scan />); });
    expect(quotaShown(tree)).toBe(false);
    await shootMenu(tree);
    expect(quotaShown(tree)).toBe(true);
  });
});
