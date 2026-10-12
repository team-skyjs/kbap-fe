/**
 * jest 수동 목(KB-739) — node_modules 옆 __mocks__는 jest가 자동 적용. 네이티브 TurboModule을 요구하는 SDK index를 대신한다.
 * 테스트는 `mockAds`(훅 상태·호출 기록)를 조작한다: 전부 "광고 없음" 기본 — 네트워크·네이티브 호출 0.
 */
import * as React from 'react';
import { View } from 'react-native';

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const notify = () => listeners.forEach((l) => l());

export const mockAds = {
  /** 훅 상태 갱신 + 구독 컴포넌트 재렌더(컴파일된 컴포넌트는 props가 같으면 재렌더를 건너뛴다 — 실제 훅처럼 상태 변화로 깨운다) */
  update<K extends 'interstitial' | 'rewarded' | 'native'>(key: K, patch: Partial<(typeof mockAds)[K]>) {
    (this as Record<K, unknown>)[key] = { ...(this[key] as object), ...patch };
    notify();
  },
  gatherConsent: jest.fn(async () => ({})),
  consentInfo: { status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED', isConsentFormAvailable: false },
  showPrivacyOptionsForm: jest.fn(async () => mockAds.consentInfo),
  initialize: jest.fn(async () => []),
  setRequestConfiguration: jest.fn(async () => {}),
  /** 훅 반환값 — 테스트가 상태를 바꾼다 */
  interstitial: { status: 'idle' as string, show: jest.fn(), load: jest.fn(), impression: false, clicked: false },
  rewarded: { status: 'idle' as string, show: jest.fn(), load: jest.fn(), impression: false, clicked: false, earnedReward: false, reward: null },
  native: { status: 'idle' as string, nativeAd: null as unknown, error: null, retry: jest.fn(), destroy: jest.fn() },
  banners: [] as Record<string, unknown>[],
  reset() {
    this.gatherConsent.mockClear(); this.showPrivacyOptionsForm.mockClear(); this.initialize.mockClear(); this.setRequestConfiguration.mockClear();
    this.consentInfo = { status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED', isConsentFormAvailable: false };
    this.interstitial = { status: 'idle', show: jest.fn(), load: jest.fn(), impression: false, clicked: false };
    this.rewarded = { status: 'idle', show: jest.fn(), load: jest.fn(), impression: false, clicked: false, earnedReward: false, reward: null };
    this.native = { status: 'idle', nativeAd: null, error: null, retry: jest.fn(), destroy: jest.fn() };
    this.banners = [];
  },
};

export const AdsConsent = {
  gatherConsent: (o?: unknown) => mockAds.gatherConsent(o),
  requestInfoUpdate: async () => mockAds.consentInfo,
  getConsentInfo: async () => mockAds.consentInfo,
  showPrivacyOptionsForm: () => mockAds.showPrivacyOptionsForm(),
  loadAndShowConsentFormIfRequired: async () => mockAds.consentInfo,
  reset: async () => {},
};
export const AdsConsentDebugGeography = { DISABLED: 0, EEA: 1, NOT_EEA: 2 };
export const AdsConsentStatus = { UNKNOWN: 'UNKNOWN', REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED', OBTAINED: 'OBTAINED' };
export const AdsConsentPrivacyOptionsRequirementStatus = { UNKNOWN: 'UNKNOWN', REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED' };
export const MaxAdContentRating = { G: 'G', PG: 'PG', T: 'T', MA: 'MA' };
export const BannerAdSize = { BANNER: 'BANNER', ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER', LARGE_ANCHORED_ADAPTIVE_BANNER: 'LARGE_ANCHORED_ADAPTIVE_BANNER', INLINE_ADAPTIVE_BANNER: 'INLINE_ADAPTIVE_BANNER' };
export const NativeAssetType = { ADVERTISER: 'advertiser', BODY: 'body', CALL_TO_ACTION: 'callToAction', HEADLINE: 'headline', ICON: 'icon', IMAGE: 'image' };
export const NativeAdEventType = { IMPRESSION: 'impression', CLICKED: 'clicked', OPENED: 'opened', CLOSED: 'closed', PAID: 'paid' };
export const NativeAdChoicesPlacement = { TOP_LEFT: 0, TOP_RIGHT: 1, BOTTOM_RIGHT: 2, BOTTOM_LEFT: 3 };
export const TestIds = { BANNER: 'test-banner', ADAPTIVE_BANNER: 'test-adaptive', INTERSTITIAL: 'test-interstitial', REWARDED: 'test-rewarded', NATIVE: 'test-native' };

export function BannerAd(props: Record<string, unknown>) {
  mockAds.banners.push(props);
  return React.createElement(View, { testID: 'mock-banner-ad' });
}
export const NativeAdView = ({ children, ...p }: { children?: React.ReactNode } & Record<string, unknown>) => React.createElement(View, p, children);
export const NativeAsset = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
export const NativeMediaView = (p: Record<string, unknown>) => React.createElement(View, p);
export const useInterstitialAd = () => React.useSyncExternalStore(subscribe, () => mockAds.interstitial);
export const useRewardedAd = () => React.useSyncExternalStore(subscribe, () => mockAds.rewarded);
export const useNativeAd = () => React.useSyncExternalStore(subscribe, () => mockAds.native);

const mobileAds = () => ({ initialize: () => mockAds.initialize(), setRequestConfiguration: (c: unknown) => mockAds.setRequestConfiguration(c) });
export default mobileAds;
