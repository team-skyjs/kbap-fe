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
import { INTERSTITIAL_SHOW_TIMEOUT, OrderDoneInterstitial, type InterstitialController } from '../OrderDoneInterstitial';
import { RewardedTile, UnlockActions } from '../RewardedUnlock';
import { FeedAd } from '../FeedAd';
import { _resetAdsSessionForTest, canShowInterstitial, initAds, markInterstitialShown } from '@/lib/ads/adsSession';
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
    expect(props.size).toBe('ANCHORED_ADAPTIVE_BANNER'); // QA 4R: LARGE_*는 112dp 컨테이너 레터박스
    act(() => { (props.onAdLoaded as (d: { width: number; height: number }) => void)({ width: 320, height: 50 }); });
    expect(slot().props.style[1].height).toBe(50);
    act(() => { (props.onSizeChange as (d: { width: number; height: number }) => void)({ width: 360, height: 98 }); }); // QA 5R: 컨테이너 크기는 무시 — 수신 50 유지
    expect(slot().props.style[1].height).toBe(50);
    act(() => { (props.onAdLoaded as (d: { width: number; height: number }) => void)({ width: 468, height: 60 }); }); // 다음 수신 60 = 슬롯 60
    expect(slot().props.style[1].height).toBe(60);
    act(() => { (props.onAdLoaded as (d: { width: number; height: number }) => void)({ width: 320, height: 100 }); });
    expect(slot().props.style[1].height).toBe(100);
    act(() => { (props.onAdImpression as () => void)(); (props.onAdClicked as () => void)(); });
    expect(mockTrack).toHaveBeenCalledWith('ad_impression', { format: 'banner', placement: 'search_banner' });
    expect(mockTrack).toHaveBeenCalledWith('ad_click', { format: 'banner', placement: 'search_banner' });
    act(() => { (props.onAdFailedToLoad as (e: Error) => void)(new Error('no-fill')); });
    expect(slot().props.style[1].height).toBe(0);
  });

  it('/review 6·7: visible=false = 높이 0·인셋 0으로 숨기되 BannerAd 마운트 유지(재요청 0) · 인셋은 광고가 떠 있을 때만', async () => {
    await act(async () => { await initAds(); });
    const el = (visible: boolean) => <AdBanner placement="search_banner" visible={visible} bottomInset={34} />;
    const t = render(el(true));
    const slot = () => t.root.findAll((x) => x.props?.testID === 'ad-banner-search_banner' && typeof x.type === 'string')[0];
    expect(slot().props.style[1]).toEqual({ height: 0, paddingBottom: 0 }); // 로드 전 = 빈 띠 0
    const props = mockAds.banners.at(-1)!;
    act(() => { (props.onAdLoaded as (d: { width: number; height: number }) => void)({ width: 320, height: 50 }); });
    expect(slot().props.style[1]).toEqual({ height: 50, paddingBottom: 34 });
    const mounted = mockAds.banners.length;
    rerender(t, el(false)); // 키보드 떠 있음
    expect(slot().props.style[1]).toEqual({ height: 0, paddingBottom: 0 });
    expect(mockAds.banners.length).toBe(mounted); // 언마운트/재마운트 0
    rerender(t, el(true));
    expect(slot().props.style[1]).toEqual({ height: 50, paddingBottom: 34 });
    expect(mockAds.banners.length).toBe(mounted);
  });

  it('KB-774: 클립 상자 = 수신 크리에이티브 폭·높이(네이티브 뷰 남는 자리 검은 띠 차단) · 실패 = 크기 해제', async () => {
    await act(async () => { await initAds(); });
    const t = render(<AdBanner placement="search_banner" bottomInset={34} />);
    const clip = () => t.root.findAll((x) => x.props?.testID === 'ad-banner-search_banner-clip' && typeof x.type === 'string')[0];
    const flat = () => Object.assign({}, ...(clip().props.style as object[]).filter(Boolean)) as Record<string, unknown>;
    expect(flat().width).toBeUndefined();
    const props = mockAds.banners.at(-1)!;
    act(() => { (props.onAdLoaded as (d: { width: number; height: number }) => void)({ width: 320, height: 100 }); });
    expect(flat()).toMatchObject({ width: 320, height: 100, overflow: 'hidden' });
    act(() => { (props.onSizeChange as (d: { width: number; height: number }) => void)({ width: 402, height: 120 }); }); // 컨테이너 크기는 무시
    expect(flat()).toMatchObject({ width: 320, height: 100 });
    act(() => { (props.onAdFailedToLoad as (e: Error) => void)(new Error('no-fill')); });
    expect(flat().width).toBeUndefined();
  });

  it('플래그 banner=false / enabled=false = 렌더 0', async () => {
    await act(async () => { await initAds(); });
    adsFlags.banner = false;
    const t = render(<AdBanner placement="feed_banner" inline />);
    expect(mockAds.banners).toHaveLength(0);
    expect(t.toJSON()).toBeNull();
  });
});

describe('피드 네이티브', () => {
  const FRAME_KEYS = /^(padding|border|margin)/;
  const flat = (x: { props: { style?: unknown } }) => Object.assign({}, ...[x.props.style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
  const loaded = (aspectRatio: number | null) => mockAds.update('native', {
    status: 'loaded',
    nativeAd: { responseId: 'r', headline: 'H', body: 'B', callToAction: 'INSTALL', advertiser: 'Adv', icon: { url: 'https://x/i.png' }, mediaContent: aspectRatio == null ? null : { aspectRatio, hasVideoContent: false, duration: 0 }, addAdEventListener: () => ({ remove: () => {} }) },
  });
  it('QA 6R: NativeAdView엔 padding·border·margin 0(자식이 GADNativeAdView content frame에 꽂혀 두 번 밀림) — 여백·구분선은 바깥 View · KB-799 미디어 원비율 유지 · 미지 이미지 contain', async () => {
    await act(async () => { await initAds(); });
    loaded(1.5);
    const t = render(<FeedAd testID="ad-feed-1" />);
    await flush();
    act(() => t.root.findAll((x) => x.props?.testID === 'ad-feed-1-frame' && typeof x.type === 'string')[0].props.onLayout({ nativeEvent: { layout: { width: 375 } } }));
    const adView = t.root.findAll((x) => x.props?.testID === 'ad-feed-1' && typeof x.type === 'string')[0];
    expect(Object.keys(flat(adView)).filter((k) => FRAME_KEYS.test(k))).toEqual([]);
    let host = adView.parent; while (host && typeof host.type !== 'string') host = host.parent; // 목 컴포지트 건너뛰고 바깥 host View
    expect(flat(host as typeof adView)).toMatchObject({ paddingVertical: 22, paddingHorizontal: 20, borderBottomWidth: 1 });
    const media = () => flat(t.root.findAll((x) => x.props?.resizeMode === 'contain' && typeof x.type === 'string')[0]);
    expect(media()).toMatchObject({ width: 256, height: 256 / 1.5 });
    expect(adView.props.onPress).toBeUndefined();
    loaded(null); await flush();
    expect(media()).toMatchObject({ width: 256, height: 144 });
    loaded(0.5); await flush();
    expect(media()).toMatchObject({ width: 128, height: 256 });
    // 자산 전부 NativeAdView 안
    const leaves = adView.findAll((x) => typeof x.props?.children === 'string').map((x) => x.props.children as string);
    expect(leaves).toEqual(expect.arrayContaining(['H', 'B', 'INSTALL', 'Adv']));
    for (const text of ['H', 'B', 'INSTALL', 'Adv']) {
      const asset = adView.findAll((x) => typeof x.type === 'string' && x.props.children === text)[0];
      expect(asset.props.numberOfLines).toBeUndefined();
    }
    act(() => mockAds.update('native', { nativeAd: { ...(mockAds.native.nativeAd as object), mediaContent: { aspectRatio: 16 / 9, hasVideoContent: true } } }));
    act(() => t.root.findAll((x) => x.props?.testID === 'ad-feed-1-frame' && typeof x.type === 'string')[0].props.onLayout({ nativeEvent: { layout: { width: 200 } } }));
    expect(mockAds.banners.at(-1)).toMatchObject({ size: 'INLINE_ADAPTIVE_BANNER', maxHeight: 250 });
    expect(t.root.findAll((x) => x.props?.resizeMode === 'contain')).toHaveLength(0);
    const banner = mockAds.banners.at(-1)!;
    act(() => { (banner.onAdFailedToLoad as () => void)(); });
    const fallback = t.root.findAll((x) => x.props?.testID === 'ad-feed-1' && typeof x.type === 'string')[0];
    expect(flat(fallback).height).toBe(0);

  });
});

describe('전면(주문 완료)', () => {
  const host = (ref: React.MutableRefObject<InterstitialController | null>) => <OrderDoneInterstitial controllerRef={ref} />;
  it('초기화 전·플래그 off = 호스트 없음(ref null) → 부모는 스텝 건너뜀', async () => {
    const ref = { current: null as InterstitialController | null };
    render(host(ref));
    expect(ref.current).toBeNull();
  });
  it('준비 안 됨 = present false · 준비됨 = show 1회 → 실제 노출(showing)에서만 세션 상한 소모(/review 4) → 닫힘에 done 1회 · 두 번째 스텝 = false', async () => {
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
    expect(canShowInterstitial()).toBe(true); // 아직 안 떴다 — 상한 미소모
    act(() => mockAds.update('interstitial', { status: 'showing' }));
    rerender(t, host(ref));
    expect(canShowInterstitial()).toBe(false); // 떴다
    act(() => mockAds.update('interstitial', { status: 'closed' }));
    rerender(t, host(ref));
    expect(done).toHaveBeenCalledTimes(1);
    act(() => mockAds.update('interstitial', { status: 'loaded' }));
    rerender(t, host(ref));
    expect(ref.current!.step().present(jest.fn(), new AbortController().signal)).toBe(false); // 세션 1회 상한
  });
  it('/review 3: show()가 조용히 실패해 status가 안 움직이면 타임아웃 뒤 done 1회(큐 블록 0) · 상한 미소모', async () => {
    INTERSTITIAL_SHOW_TIMEOUT.ms = 30;
    await act(async () => { await initAds(); });
    const ref = { current: null as InterstitialController | null };
    const t = render(host(ref));
    act(() => mockAds.update('interstitial', { status: 'loaded' }));
    rerender(t, host(ref));
    const done = jest.fn();
    expect(ref.current!.step().present(done, new AbortController().signal)).toBe(true);
    expect(done).not.toHaveBeenCalled();
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(done).toHaveBeenCalledTimes(1);
    expect(canShowInterstitial()).toBe(true); // 안 떴으니 상한 그대로
    act(() => mockAds.update('interstitial', { status: 'closed' })); // 늦게 닫힘 이벤트가 와도 done 재호출 0
    rerender(t, host(ref));
    expect(done).toHaveBeenCalledTimes(1);
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

  it('KB-765: RewardedTile(홈 다이얼로그) = 같은 상태 기계 — 로드 → press = show → 보상 → POST 1회 · watched 1/3 · 계측에 surface: dialog(스캔 화면 버튼은 미지정)', async () => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    mockPost.mockResolvedValue({ rewardCount: 1, remainingForUnlock: 2, scanUnlocked: false });
    await act(async () => { await initAds(); });
    const seen: { watched: number; total: number; pressable: boolean; press: () => void }[] = [];
    const tile = () => (
      <RewardedTile
        sdk={adsModule as never}
        initial={{ count: 0, forUnlock: 3, remaining: 3 }}
        onUnlocked={jest.fn()}
        onClose={jest.fn()}
        render={(r) => { seen.push(r); return <View testID="tile-probe" />; }}
      />
    );
    const t = render(tile());
    act(() => mockAds.update('rewarded', { status: 'loaded', impression: true }));
    rerender(t, tile());
    expect(mockTrack).toHaveBeenCalledWith('ad_impression', { format: 'rewarded', placement: 'scan_unlock_rewarded', surface: 'dialog' });
    expect(seen.at(-1)!.pressable).toBe(true);
    await act(async () => { seen.at(-1)!.press(); });
    expect(mockAds.rewarded.show).toHaveBeenCalledTimes(1);
    act(() => mockAds.update('rewarded', { status: 'showing', earnedReward: true }));
    rerender(t, tile());
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('ad_reward_earned', { placement: 'scan_unlock_rewarded', remaining: 2, surface: 'dialog' });
    rerender(t, tile());
    expect(seen.at(-1)!).toMatchObject({ watched: 1, total: 3 });
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

  it('/review 1(=공부): 네트워크 실패 = 보상 소실 0 — 같은 rewardKey 보관, 닫혀도 새 광고 로드 0, 버튼 = 다시 시도 → 같은 키로 재신고 → 성공 뒤에만 새 키·재로드', async () => {
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce({ rewardCount: 1, remainingForUnlock: 2, scanUnlocked: false });
    await act(async () => { await initAds(); });
    const t2 = render(actions());
    act(() => mockAds.update('rewarded', { status: 'loaded', earnedReward: false }));
    rerender(t2, actions());
    act(() => mockAds.update('rewarded', { status: 'showing', earnedReward: true }));
    rerender(t2, actions());
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(1);
    const firstKey = (mockPost.mock.calls[0][1] as { rewardKey: string }).rewardKey;
    expect(has(t2, 'quota-ad-error')).toBe(1);
    act(() => mockAds.update('rewarded', { status: 'closed', earnedReward: false }));
    rerender(t2, actions());
    expect(mockAds.rewarded.load).not.toHaveBeenCalled(); // 미신고 보상이 있는 동안 새 광고 0
    expect(btn(t2, 'quota-watch-ad').props.variant).toBe('secondary');
    expect(hasText(t2, 'common.tryAgain')).toBe(true);
    await act(async () => { btn(t2, 'quota-watch-ad').props.onPress(); });
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect((mockPost.mock.calls[1][1] as { rewardKey: string }).rewardKey).toBe(firstKey); // 같은 키 = 멱등 재신고
    expect(has(t2, 'quota-ad-error')).toBe(0);
    expect(hasText(t2, 'ads.watchToUnlock:{"n":1,"total":3}')).toBe(true);
    expect(mockAds.rewarded.show).not.toHaveBeenCalled(); // 광고를 다시 보지 않았다
    act(() => mockAds.update('rewarded', { status: 'loaded' }));
    rerender(t2, actions());
    act(() => mockAds.update('rewarded', { status: 'showing', earnedReward: true }));
    rerender(t2, actions());
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(3);
    expect((mockPost.mock.calls[2][1] as { rewardKey: string }).rewardKey).not.toBe(firstKey); // 성공 뒤 새 키
  });
});
