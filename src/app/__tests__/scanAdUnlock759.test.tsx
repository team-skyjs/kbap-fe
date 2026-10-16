/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일(homeQuotaBadgeAds739). */
/**
 * KB-759 재현 — 스캔 제한 화면에서 광고 3회 → 3번째 신고 응답 scanUnlocked=true → preflight(새 티켓) → 카메라 복귀.
 * 하네스 = scanQuotaPreNotice384 복제 + 광고 목(루트 __mocks__)·api.post 목·QueryClientProvider.
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
    cancelAnimation: jest.fn(),
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
    useSharedValue: (v: unknown) => { const shared = { value: v, set: (next: unknown) => { shared.value = next; } }; return shared; },
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
jest.mock('expo-router', () => ({
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

jest.mock('react-native-google-mobile-ads');
jest.mock('expo-tracking-transparency');
jest.mock('@/lib/flags', () => ({ ...jest.requireActual<typeof import('@/lib/flags')>('@/lib/flags'), isProdChannel: () => false }));
jest.mock('@/lib/metaSdk', () => ({ setMetaTrackingEnabled: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuid}` }));
let mockUuid = 0;
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => ({ ...jest.requireActual('@/lib/api/client'), api: { ...jest.requireActual<{ api: object }>('@/lib/api/client').api, post: (...a: unknown[]) => mockPost(...a) } }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as adsModule from 'react-native-google-mobile-ads';
import { _resetAdsSessionForTest, initAds } from '@/lib/ads/adsSession';
import { _resetAdsSdkForTest } from '@/lib/ads/sdk';
import { ApiError } from '@/lib/api/client';
import Scan from '../scan';
import { AppState, Modal, Platform } from 'react-native';
import { observeUnlock, resetUnlockSession } from '@/features/scan/unlockCelebrationStore';
import { currentGen } from '@/lib/auth/beTokens';
const { mockAds } = adsModule as unknown as typeof import('../../../__mocks__/react-native-google-mobile-ads');

const QUOTA = (remaining: number | 'unlimited', unlocked = false) => ({ count: 3, limit: 3, unlocked, remaining });
const quotaShown = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.testID === 'scan-quota-review').length > 0;
const adBtn = (t: ReactTestRenderer) => t.root.findAll((x) => x.props?.testID === 'quota-watch-ad' && typeof x.props?.onPress === 'function' && typeof x.type !== 'string')[0];
const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };

beforeAll(preloadReactNative, PRELOAD_TIMEOUT_MS);
let qc: QueryClient;
beforeEach(async () => {
  jest.clearAllMocks();
  resetUnlockSession(currentGen());
  mockIsGuest.mockReturnValue(false);
  mockAds.reset(); mockUuid = 0;
  _resetAdsSessionForTest(); _resetAdsSdkForTest();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await act(async () => { await initAds(); });
});

const me = (remaining: number, unlocked = false) => ({ data: { restrictions: [], scanQuota: unlocked ? QUOTA('unlimited', true) : QUOTA(0), adRewards: { count: 3 - remaining, forUnlock: 3, remaining } } });
const render = () => { let tree!: ReactTestRenderer; act(() => { tree = renderer.create(<QueryClientProvider client={qc}><Scan /></QueryClientProvider>); }); return tree; };

async function watchOnce(tree: ReactTestRenderer, response: { rewardCount: number; remainingForUnlock: number; scanUnlocked: boolean }) {
  mockPost.mockResolvedValueOnce(response);
  act(() => mockAds.update('rewarded', { status: 'loaded', earnedReward: false }));
  await act(async () => { adBtn(tree).props.onPress(); });
  act(() => mockAds.update('rewarded', { status: 'showing', earnedReward: true }));
  await flush();
  act(() => mockAds.update('rewarded', { status: 'closed', earnedReward: false }));
  await flush();
}

it('재현: 프로필 소진(quotaLockRef 경로) → 광고 3회 → 3번째 scanUnlocked=true → 티켓 발급 → 카메라 복귀', async () => {
  mockIssue.mockRejectedValue(new ApiError('quota', 403, 'SCAN-004'));
  mockUseMe.mockReturnValue(me(3));
  const tree = render();
  await flush();
  expect(quotaShown(tree)).toBe(true);
  expect(adBtn(tree)).toBeDefined();
  await watchOnce(tree, { rewardCount: 1, remainingForUnlock: 2, scanUnlocked: false });
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(quotaShown(tree)).toBe(true);
  await watchOnce(tree, { rewardCount: 2, remainingForUnlock: 1, scanUnlocked: false });
  expect(quotaShown(tree)).toBe(true);
  mockIssue.mockReset(); mockIssue.mockResolvedValue('t-unlocked'); // 서버 해제 뒤 티켓 OK
  await watchOnce(tree, { rewardCount: 3, remainingForUnlock: 0, scanUnlocked: true });
  expect(mockPost).toHaveBeenCalledTimes(3);
  expect(mockIssue).toHaveBeenCalled(); // onUnlocked → preflight
  expect(quotaShown(tree)).toBe(false); // 카메라 복귀
});

it('방어 2: 해제 응답 뒤 티켓 재발급 실패(네트워크·비-004) = 삼키지 않음 — 제목 "해제됨" + 다시 시도 → 재시도 티켓 OK → 카메라', async () => {
  mockIssue.mockRejectedValue(new ApiError('quota', 403, 'SCAN-004'));
  mockUseMe.mockReturnValue(me(1));
  const tree = render();
  await flush();
  expect(quotaShown(tree)).toBe(true);
  mockIssue.mockReset(); mockIssue.mockRejectedValueOnce(new Error('network')); // 해제 뒤 첫 티켓 = 실패
  await watchOnce(tree, { rewardCount: 3, remainingForUnlock: 0, scanUnlocked: true });
  expect(mockIssue).toHaveBeenCalledTimes(1);
  const json = () => JSON.stringify(tree.toJSON());
  expect(json()).toContain('scan.unlockedTitle');
  expect(json()).toContain('scan.unlockedRetry');
  expect(tree.root.findAll((n) => n.props?.testID === 'scan-quota-review').length).toBe(0); // 리뷰/광고 CTA 대신
  const retry = tree.root.findAll((n) => n.props?.testID === 'scan-unlock-retry' && typeof n.props?.onPress === 'function' && typeof n.type !== 'string')[0];
  expect(retry).toBeDefined();
  mockIssue.mockResolvedValue('t-unlocked');
  await act(async () => { retry.props.onPress(); await flush(); });
  expect(mockIssue).toHaveBeenCalledTimes(2);
  expect(json()).not.toContain('scan.unlockedTitle');
  expect(tree.root.findAll((n) => n.props?.testID === 'scan-unlock-retry').length).toBe(0);
  expect(tree.root.findAll((n) => n.props?.testID === 'scan-quota-later').length).toBe(0); // 에러 화면 자체가 사라짐 = 카메라
});

it('#252 /review 1: 해제 응답 뒤 티켓이 아직 SCAN-004 = "해제됨/다시 시도"로 묶지 않고 기존 제한 화면(리뷰·광고 CTA) 복원 + 반증 되돌림', async () => {
  mockIssue.mockRejectedValue(new ApiError('quota', 403, 'SCAN-004'));
  mockUseMe.mockReturnValue(me(1));
  const tree = render();
  await flush();
  await watchOnce(tree, { rewardCount: 3, remainingForUnlock: 0, scanUnlocked: true }); // 티켓은 계속 004
  const json = JSON.stringify(tree.toJSON());
  expect(json).not.toContain('scan.unlockedTitle');
  expect(json).toContain('scan.quotaTitle');
  expect(tree.root.findAll((n) => n.props?.testID === 'scan-unlock-retry')).toHaveLength(0);
  expect(quotaShown(tree)).toBe(true); // 리뷰 CTA 복원
});

it('#252 /review 3: 다시 시도 = 공용 제출 가드 — 응답 전 연타 = 티켓 요청 1회 · 요청 중 Btn busy', async () => {
  mockIssue.mockRejectedValue(new ApiError('quota', 403, 'SCAN-004'));
  mockUseMe.mockReturnValue(me(1));
  const tree = render();
  await flush();
  mockIssue.mockReset(); mockIssue.mockRejectedValueOnce(new Error('network'));
  await watchOnce(tree, { rewardCount: 3, remainingForUnlock: 0, scanUnlocked: true });
  const retry = () => tree.root.findAll((n) => n.props?.testID === 'scan-unlock-retry' && typeof n.props?.onPress === 'function' && typeof n.type !== 'string')[0];
  let release!: (v: string) => void;
  mockIssue.mockImplementation(() => new Promise<string>((r) => { release = r; }));
  await act(async () => { retry().props.onPress(); retry().props.onPress(); retry().props.onPress(); });
  expect(mockIssue).toHaveBeenCalledTimes(2); // 해제 직후 1 + 재시도 1(연타 2회는 가드에 막힘)
  expect(retry().props.busy).toBe(true); // 요청 중 = Btn busy(스피너·비활성)
  await act(async () => { release('t-unlocked'); await flush(); });
  expect(tree.root.findAll((n) => n.props?.testID === 'scan-quota-later')).toHaveLength(0); // 카메라
});

it('#252 /review 4: 제한 화면 본문 — 광고 버튼이 있으면 quotaBodyUnlock, 구서버(adRewards null)면 기존 quotaBody', async () => {
  mockIssue.mockRejectedValue(new ApiError('quota', 403, 'SCAN-004'));
  mockUseMe.mockReturnValue(me(3));
  const tree = render();
  await flush();
  expect(JSON.stringify(tree.toJSON())).toContain('scan.quotaBodyUnlock');
  mockUseMe.mockReturnValue({ data: { restrictions: [], scanQuota: QUOTA(0), adRewards: null } });
  act(() => { tree.update(<QueryClientProvider client={qc}><Scan /></QueryClientProvider>); });
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('"scan.quotaBody"');
  expect(json).not.toContain('scan.quotaBodyUnlock');
});

it('방어 1·반증: 프로필 재조회가 늦어 preflight가 옛 소진 스냅샷을 쥐어도 해제 응답 → 카메라, 그 뒤 재렌더(옛 프로필 그대로)에도 재잠금 0', async () => {
  mockIssue.mockRejectedValue(new ApiError('quota', 403, 'SCAN-004'));
  mockUseMe.mockReturnValue(me(1)); // 끝까지 소진 상태(재조회 미도착)
  const tree = render();
  await flush();
  expect(quotaShown(tree)).toBe(true);
  mockIssue.mockReset(); mockIssue.mockResolvedValue('t-unlocked');
  await watchOnce(tree, { rewardCount: 3, remainingForUnlock: 0, scanUnlocked: true });
  expect(quotaShown(tree)).toBe(false);
  act(() => { tree.update(<QueryClientProvider client={qc}><Scan /></QueryClientProvider>); });
  await flush();
  expect(quotaShown(tree)).toBe(false); // lockFromProfile이 반증된 스냅샷으로 다시 잠그지 않는다
});

it('재현 변형: 스캔 시도 403으로 온 제한 화면(fail 경로, quotaLockRef=false) + 재조회(unlocked)가 먼저 도착 → 해제 응답 → 카메라 복귀', async () => {
  // 제한 화면을 fail('quota') 경로로 세운다: 티켓은 OK였고(카메라), 스캔 POST가 SCAN-004 — 여기선 프로필이 잔여 있음 → 티켓 OK → 카메라 → 쿼터 재조회로 소진 도착(Codex #159 P2 경로: lockFromProfile → quotaLockRef true)이 아니라
  // 실제 fail 경로는 useScan 목이 성공 고정이라 못 만든다 → 대신 "재조회가 preflight보다 먼저 도착" 순서만 재현: 해제 응답 직후 프로필을 unlocked로 바꿔 렌더한 뒤 티켓 응답.
  mockIssue.mockRejectedValue(new ApiError('quota', 403, 'SCAN-004'));
  mockUseMe.mockReturnValue(me(1));
  const tree = render();
  await flush();
  expect(quotaShown(tree)).toBe(true);
  const d = { resolve: (_: string) => {} };
  mockIssue.mockReset(); mockIssue.mockImplementation(() => new Promise<string>((r) => { d.resolve = r; }));
  mockPost.mockResolvedValueOnce({ rewardCount: 3, remainingForUnlock: 0, scanUnlocked: true });
  act(() => mockAds.update('rewarded', { status: 'loaded', earnedReward: false }));
  await act(async () => { adBtn(tree).props.onPress(); });
  act(() => mockAds.update('rewarded', { status: 'showing', earnedReward: true }));
  await flush(); // 신고 응답 → onUnlocked → preflight(티켓 대기 중)
  expect(mockIssue).toHaveBeenCalledTimes(1);
  mockUseMe.mockReturnValue(me(0, true)); // 재조회 도착: adRewards.remaining 0 + scanQuota unlocked → 광고 버튼 언마운트
  act(() => { tree.update(<QueryClientProvider client={qc}><Scan /></QueryClientProvider>); });
  expect(adBtn(tree)).toBeUndefined();
  await act(async () => { d.resolve('t-unlocked'); await flush(); });
  expect(quotaShown(tree)).toBe(false);
});

// Real Scan + RewardedUnlock + mutation + global owner + Modal: CTA gates the actual ticket issuer.
it('KB760: server transition waits for celebration CTA and native dismissal before issuing a ticket', async () => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  observeUnlock('7', false, currentGen());
  mockIssue.mockRejectedValue(new ApiError('quota', 403, 'SCAN-004'));
  mockUseMe.mockReturnValue(me(1));
  const tree = render(); await flush();
  mockIssue.mockReset(); mockIssue.mockResolvedValue('celebration-ticket');
  await watchOnce(tree, { rewardCount: 3, remainingForUnlock: 0, scanUnlocked: true });
  expect(mockIssue).not.toHaveBeenCalled();
  const action = tree.root.findAll((n) => n.props.testID === 'unlock-celebration-action' && typeof n.props.onPress === 'function')[0];
  expect(action).toBeDefined();
  await act(async () => { action.props.onPress(); action.props.onPress(); });
  if (Platform.OS === 'ios') {
    expect(mockIssue).not.toHaveBeenCalled();
    const celebration = tree.root.findAllByType(Modal).find((n) => n.props.presentationStyle === 'fullScreen')!;
    await act(async () => celebration.props.onDismiss());
  } else {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  }
  await flush(); expect(mockIssue).toHaveBeenCalledTimes(1); expect(quotaShown(tree)).toBe(false);
  act(() => tree.unmount());
});
