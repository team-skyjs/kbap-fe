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
jest.mock('expo-router', () => ({
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
const { mockAds } = adsModule as unknown as typeof import('../../../__mocks__/react-native-google-mobile-ads');

const QUOTA = (remaining: number | 'unlimited', unlocked = false) => ({ count: 3, limit: 3, unlocked, remaining });
const quotaShown = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props?.testID === 'scan-quota-review').length > 0;
const adBtn = (t: ReactTestRenderer) => t.root.findAll((x) => x.props?.testID === 'quota-watch-ad' && typeof x.props?.onPress === 'function' && typeof x.type !== 'string')[0];
const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };

beforeAll(preloadReactNative, PRELOAD_TIMEOUT_MS);
let qc: QueryClient;
beforeEach(async () => {
  jest.clearAllMocks();
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
