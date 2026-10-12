/**
 * KB-739 자리 컴포넌트 — 플래그 off·초기화 전 = 렌더 0(배너 요청 0) · 배너 = 로드 전 높이 0 → onAdLoaded 실측 높이 → 실패 0 ·
 * 전면 큐 스텝 = 준비 안 됨/세션 상한이면 false(건너뜀), 준비됐으면 show + 닫힘에 done 1회 · 보상형 = EARNED_REWARD → POST 1회(멱등 키) →
 * 200 remaining 표시·scanUnlocked면 onUnlocked / 429 limit 안내 / 400 닫기 · 게스트·구서버(adRewards null) = 광고 버튼 0(리뷰 경로 무변).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-native-google-mobile-ads'); // 루트 __mocks__ — 명시 선언(SDK 소비자와 같은 인스턴스)
jest.mock('expo-tracking-transparency');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: { View, createAnimatedComponent: (c: unknown) => c }, useSharedValue: (v: unknown) => ({ value: v }), useAnimatedStyle: () => ({}), withSpring: (v: unknown) => v, withTiming: (v: unknown) => v, withRepeat: (v: unknown) => v, Easing: { linear: 0 } };
});
jest.mock('@/lib/flags', () => ({ ...jest.requireActual<typeof import('@/lib/flags')>('@/lib/flags'), isProdChannel: () => false }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
jest.mock('@/lib/metaSdk', () => ({ setMetaTrackingEnabled: jest.fn() }));
let mockGuest = false;
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockGuest }));
let mockMe: Record<string, unknown> | undefined;
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: mockMe }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuid}` }));
let mockUuid = 0;
const mockPost = jest.fn();
jest.mock('@/lib/api/client', () => ({ ...jest.requireActual('@/lib/api/client'), api: { post: (...a: unknown[]) => mockPost(...a) } }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ApiError } from '@/lib/api/client';
import { AdBanner } from '../AdBanner';
import { OrderDoneInterstitial, type InterstitialController } from '../OrderDoneInterstitial';
import { UnlockActions } from '../RewardedUnlock';
import { _resetAdsSessionForTest, initAds, markInterstitialShown } from '@/lib/ads/adsSession';
import { _resetAdsSdkForTest } from '@/lib/ads/sdk';
import { FLAGS } from '@/lib/flags';
import * as adsModule from 'react-native-google-mobile-ads';
/* eslint-enable import/first */
const adsFlags = FLAGS.ads as { enabled: boolean; banner: boolean; interstitial: boolean; native: boolean; rewarded: boolean };
const { mockAds } = adsModule as unknown as typeof import('../../../../__mocks__/react-native-google-mobile-ads');

let qc: QueryClient;
const trees: ReactTestRenderer[] = [];
const render = (el: React.ReactElement) => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
  trees.push(t);
  return t;
};
const rerender = (t: ReactTestRenderer, el: React.ReactElement) => act(() => { t.update(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
const hasText = (t: ReactTestRenderer, text: string) => JSON.stringify(t.toJSON()).includes(JSON.stringify(text).slice(1, -1)); // 트리 JSON 안의 이스케이프된 문자열
const has = (t: ReactTestRenderer, id: string) => t.root.findAll((x) => x.props?.testID === id && typeof x.type === 'string').length;
const btn = (t: ReactTestRenderer, id: string) => t.root.findAll((x) => x.props?.testID === id && typeof x.props?.onPress === 'function' && typeof x.type !== 'string')[0];
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(async () => {
  jest.clearAllMocks();
  mockAds.reset();
  Object.assign(adsFlags, { enabled: true, banner: true, interstitial: true, native: true, rewarded: true });
  mockGuest = false;
  mockMe = { id: '1', adRewards: { count: 0, forUnlock: 3, remaining: 3 }, scanQuota: { count: 3, limit: 3, unlocked: false, remaining: 0 } };
  mockUuid = 0;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  _resetAdsSessionForTest();
  _resetAdsSdkForTest();
});

describe('배너', () => {
  it('초기화 전 = 렌더 0(BannerAd 요청 0) · ready 뒤 = 높이 0으로 마운트 → onAdLoaded(320×50) = 높이 50 → 실패 = 0', async () => {
    const t = render(<AdBanner placement="search_banner" />);
    expect(has(t, 'ad-banner-search_banner')).toBe(0);
    expect(mockAds.banners).toHaveLength(0);
    await act(async () => { await initAds(); });
    rerender(t, <AdBanner placement="search_banner" />);
    const slot = () => t.root.findAll((x) => x.props?.testID === 'ad-banner-search_banner' && typeof x.type === 'string')[0];
    expect(slot().props.style[1].height).toBe(0);
    const props = mockAds.banners.at(-1)!;
    expect(props.unitId).toBe('ca-app-pub-3940256099942544/2934735716'); // 비prod = 데모(iOS)
    expect(props.size).toBe('LARGE_ANCHORED_ADAPTIVE_BANNER');
    act(() => { (props.onAdLoaded as (d: { width: number; height: number }) => void)({ width: 320, height: 50 }); });
    expect(slot().props.style[1].height).toBe(50);
    act(() => { (props.onAdImpression as () => void)(); (props.onAdClicked as () => void)(); });
    expect(mockTrack).toHaveBeenCalledWith('ad_impression', { format: 'banner', placement: 'search_banner' });
    expect(mockTrack).toHaveBeenCalledWith('ad_click', { format: 'banner', placement: 'search_banner' });
    act(() => { (props.onAdFailedToLoad as (e: Error) => void)(new Error('no-fill')); });
    expect(slot().props.style[1].height).toBe(0);
  });

  it('플래그 banner=false / enabled=false = 렌더 0', async () => {
    await act(async () => { await initAds(); });
    adsFlags.banner = false;
    const t = render(<AdBanner placement="feed_banner" inline />);
    expect(mockAds.banners).toHaveLength(0);
    expect(t.toJSON()).toBeNull();
  });
});

describe('전면(주문 완료)', () => {
  const host = (ref: React.MutableRefObject<InterstitialController | null>) => <OrderDoneInterstitial controllerRef={ref} />;
  it('초기화 전·플래그 off = 호스트 없음(ref null) → 부모는 스텝 건너뜀', async () => {
    const ref = { current: null as InterstitialController | null };
    render(host(ref));
    expect(ref.current).toBeNull();
  });
  it('준비 안 됨 = present false · 준비됨 = show 1회 + 세션 상한 → 닫힘에 done 1회 · 두 번째 스텝 = false', async () => {
    await act(async () => { await initAds(); });
    const ref = { current: null as InterstitialController | null };
    const t = render(host(ref));
    expect(ref.current).not.toBeNull();
    const done = jest.fn();
    expect(ref.current!.step().present(done, new AbortController().signal)).toBe(false); // idle
    act(() => mockAds.update('interstitial', { status: 'loaded' }));
    rerender(t, host(ref));
    expect(ref.current!.step().present(done, new AbortController().signal)).toBe(true);
    expect(mockAds.interstitial.show).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
    act(() => mockAds.update('interstitial', { status: 'closed' }));
    rerender(t, host(ref));
    expect(done).toHaveBeenCalledTimes(1);
    act(() => mockAds.update('interstitial', { status: 'loaded' }));
    rerender(t, host(ref));
    expect(ref.current!.step().present(jest.fn(), new AbortController().signal)).toBe(false); // 세션 1회 상한
  });
  it('세션 상한이 이미 찼으면(다른 곳에서 표시) 준비됐어도 false', async () => {
    await act(async () => { await initAds(); });
    markInterstitialShown();
    const ref = { current: null as InterstitialController | null };
    act(() => mockAds.update('interstitial', { status: 'loaded' }));
    render(host(ref));
    expect(ref.current!.step().present(jest.fn(), new AbortController().signal)).toBe(false);
    expect(mockAds.interstitial.show).not.toHaveBeenCalled();
  });
});

describe('보상형(스캔 해제)', () => {
  const actions = (p: Partial<React.ComponentProps<typeof UnlockActions>> = {}) => <UnlockActions onWriteReview={p.onWriteReview ?? jest.fn()} onUnlocked={p.onUnlocked ?? jest.fn()} onClose={p.onClose ?? jest.fn()} />;
  it('초기화 전 = 리뷰 버튼만 · ready + 회원 + adRewards = 광고 버튼(0/3, 로드 전 off) · 게스트/구서버 null/remaining 0 = 광고 버튼 0', async () => {
    const t = render(actions());
    expect(has(t, 'quota-sheet-review')).toBe(1);
    expect(btn(t, 'quota-watch-ad')).toBeUndefined();
    await act(async () => { await initAds(); });
    rerender(t, actions());
    expect(btn(t, 'quota-watch-ad').props.variant).toBe('off');
    expect(hasText(t, 'ads.watchToUnlock:{"n":0,"total":3}')).toBe(true);
    mockGuest = true; rerender(t, actions()); expect(btn(t, 'quota-watch-ad')).toBeUndefined(); mockGuest = false;
    mockMe = { id: '1', adRewards: null }; rerender(t, actions()); expect(btn(t, 'quota-watch-ad')).toBeUndefined();
    mockMe = { id: '1', adRewards: { count: 3, forUnlock: 3, remaining: 0 } }; rerender(t, actions()); expect(btn(t, 'quota-watch-ad')).toBeUndefined();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('로드 → 탭 = show · EARNED_REWARD → POST {rewardKey(로드 시 UUID), adUnitId(데모 보상형)} 1회 · 200 remaining 2 = 1/3 표시 + 캐시 invalidate · 같은 보상 재렌더 = POST 재발화 0', async () => {
    mockPost.mockResolvedValue({ rewardCount: 1, remainingForUnlock: 2, scanUnlocked: false });
    const spy = jest.spyOn(qc, 'invalidateQueries');
    await act(async () => { await initAds(); });
    const onUnlocked = jest.fn();
    const t = render(actions({ onUnlocked }));
    act(() => mockAds.update('rewarded', { status: 'loaded' }));
    rerender(t, actions({ onUnlocked }));
    expect(btn(t, 'quota-watch-ad').props.variant).toBe('secondary');
    await act(async () => { btn(t, 'quota-watch-ad').props.onPress(); });
    expect(mockAds.rewarded.show).toHaveBeenCalledTimes(1);
    act(() => mockAds.update('rewarded', { status: 'showing', earnedReward: true }));
    rerender(t, actions({ onUnlocked }));
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/api/members/me/ad-rewards', { rewardKey: 'uuid-1', adUnitId: 'ca-app-pub-3940256099942544/1712485313' });
    expect(hasText(t, 'ads.watchToUnlock:{"n":1,"total":3}')).toBe(true);
    expect(mockTrack).toHaveBeenCalledWith('ad_reward_earned', { placement: 'scan_unlock_rewarded', remaining: 2 });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['me'] });
    expect(onUnlocked).not.toHaveBeenCalled();
    rerender(t, actions({ onUnlocked }));
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(1); // 멱등 — 같은 키 재신고 0
    // 닫힘 → 다음 광고 미리 로드
    act(() => mockAds.update('rewarded', { status: 'closed', earnedReward: false }));
    rerender(t, actions({ onUnlocked }));
    expect(mockAds.rewarded.load).toHaveBeenCalledTimes(1);
  });

  it('200 scanUnlocked=true = onUnlocked(시트 닫고 스캔 허용) — 카운트는 서버 응답만(remaining 0)', async () => {
    mockPost.mockResolvedValue({ rewardCount: 3, remainingForUnlock: 0, scanUnlocked: true });
    await act(async () => { await initAds(); });
    const onUnlocked = jest.fn();
    const t = render(actions({ onUnlocked }));
    act(() => mockAds.update('rewarded', { status: 'loaded' }));
    rerender(t, actions({ onUnlocked }));
    act(() => mockAds.update('rewarded', { status: 'showing', earnedReward: true }));
    rerender(t, actions({ onUnlocked }));
    await flush();
    expect(onUnlocked).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('ad_reward_earned', { placement: 'scan_unlock_rewarded', remaining: 0 });
  });

  it('429 MEMBER-014 = "오늘은 여기까지" 안내 + 버튼 off(재로드 0) · onClose 0', async () => {
    mockPost.mockRejectedValue(new ApiError('limit', 429, 'MEMBER-014'));
    await act(async () => { await initAds(); });
    const onClose = jest.fn();
    const t = render(actions({ onClose }));
    act(() => mockAds.update('rewarded', { status: 'loaded' }));
    rerender(t, actions({ onClose }));
    act(() => mockAds.update('rewarded', { status: 'showing', earnedReward: true }));
    rerender(t, actions({ onClose }));
    await flush();
    expect(has(t, 'quota-ad-limit')).toBe(1);
    expect(onClose).not.toHaveBeenCalled();
    act(() => mockAds.update('rewarded', { status: 'closed', earnedReward: false }));
    rerender(t, actions({ onClose }));
    expect(mockAds.rewarded.load).not.toHaveBeenCalled();
    expect(btn(t, 'quota-watch-ad').props.variant).toBe('off');
  });

  it('400 COMMON-002(남의 키·허용 밖 단위) = 재시도 없이 onClose', async () => {
    mockPost.mockRejectedValueOnce(new ApiError('bad', 400, 'COMMON-002'));
    await act(async () => { await initAds(); });
    const onClose = jest.fn();
    const t = render(actions({ onClose }));
    act(() => mockAds.update('rewarded', { status: 'loaded' }));
    rerender(t, actions({ onClose }));
    act(() => mockAds.update('rewarded', { status: 'showing', earnedReward: true }));
    rerender(t, actions({ onClose }));
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(has(t, 'quota-ad-limit')).toBe(0);
  });

  it('네트워크 실패 = 안내 + 닫힘 뒤 재로드(재시도 가능)', async () => {
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed'));
    await act(async () => { await initAds(); });
    const t2 = render(actions());
    act(() => mockAds.update('rewarded', { status: 'loaded', earnedReward: false }));
    rerender(t2, actions());
    act(() => mockAds.update('rewarded', { status: 'showing', earnedReward: true }));
    rerender(t2, actions());
    await flush();
    expect(has(t2, 'quota-ad-error')).toBe(1);
    act(() => mockAds.update('rewarded', { status: 'closed', earnedReward: false }));
    rerender(t2, actions());
    expect(mockAds.rewarded.load).toHaveBeenCalled();
  });
});
