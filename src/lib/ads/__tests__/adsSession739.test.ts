/**
 * KB-739 — 동의·초기화 순서: gatherConsent(비prod = EEA 디버그 지오) → canRequestAds → iOS ATT(결과 → Meta 추적 플래그) →
 * setRequestConfiguration(PG) → initialize → ready. 동의 불가·실패 = unavailable(초기화 0·광고 요청 0) · 두 번째 호출 no-op ·
 * 플래그 off = SDK require 0 · 개인정보 옵션 REQUIRED 노출 · ad_consent_result 계측.
 */
jest.mock('react-native-google-mobile-ads'); // 루트 __mocks__ 수동 목 — 명시 선언해야 SDK 소비자와 테스트가 같은 인스턴스를 본다(requireMock은 별도 인스턴스였다)
jest.mock('expo-tracking-transparency');
let mockProd = false;
// FLAGS.ads는 실제 객체를 직접 바꾼다(getter 목은 import 단계에서 호출돼 테스트 변수보다 먼저 평가됨 — 실측)
jest.mock('@/lib/flags', () => ({ ...jest.requireActual<typeof import('@/lib/flags')>('@/lib/flags'), isProdChannel: () => mockProd }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
const mockMetaTracking = jest.fn();
jest.mock('@/lib/metaSdk', () => ({ setMetaTrackingEnabled: (v: boolean) => mockMetaTracking(v) }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { Platform } from 'react-native';
import * as adsModule from 'react-native-google-mobile-ads';
import * as attModule from 'expo-tracking-transparency';
import { _resetAdsSessionForTest, getAdsState, initAds, isAdsReady, isPrivacyOptionsRequired, showPrivacyOptions } from '@/lib/ads/adsSession';
import { _resetAdsSdkForTest, getAdsSdk } from '@/lib/ads/sdk';
import { FLAGS } from '@/lib/flags';
/* eslint-enable import/first */
const { mockAds, AdsConsent: AdsConsentMock } = adsModule as unknown as typeof import('../../../../__mocks__/react-native-google-mobile-ads');
const { mockAtt } = attModule as unknown as typeof import('../../../../__mocks__/expo-tracking-transparency');
const adsFlags = FLAGS.ads as { enabled: boolean };

beforeEach(() => {
  jest.clearAllMocks();
  mockAds.reset();
  mockAtt.granted = false; mockAtt.calls = 0;
  mockProd = false; adsFlags.enabled = true;
  _resetAdsSessionForTest();
  _resetAdsSdkForTest();
});

it('정상: EEA 디버그 지오(비prod) → 동의 OK → iOS ATT 1회(결과 false → Meta false) → PG 설정 → initialize → ready · ad_consent_result obtained', async () => {
  const prev = Platform.OS; Platform.OS = 'ios';
  try {
    expect(getAdsState()).toBe('idle');
    await initAds();
    expect(mockAds.gatherConsent).toHaveBeenCalledWith({ debugGeography: 1 }); // EEA
    expect(mockAtt.calls).toBe(1);
    expect(mockMetaTracking).toHaveBeenCalledWith(false);
    expect(mockAds.setRequestConfiguration).toHaveBeenCalledWith(expect.objectContaining({ maxAdContentRating: 'PG', tagForChildDirectedTreatment: false }));
    expect(mockAds.initialize).toHaveBeenCalledTimes(1);
    expect(isAdsReady()).toBe(true);
    expect(mockTrack).toHaveBeenCalledWith('ad_consent_result', { status: 'obtained' });
    // 순서: 동의 → ATT → 초기화
    const order = [mockAds.gatherConsent.mock.invocationCallOrder[0], mockAds.initialize.mock.invocationCallOrder[0]];
    expect(order[0]).toBeLessThan(order[1]);
  } finally { Platform.OS = prev; }
});

it('production = 디버그 지오 없음 · ATT 허용 → Meta true', async () => {
  const prev = Platform.OS; Platform.OS = 'ios';
  try {
    mockProd = true; mockAtt.granted = true;
    await initAds();
    expect(mockAds.gatherConsent).toHaveBeenCalledWith(undefined);
    expect(mockMetaTracking).toHaveBeenCalledWith(true);
    expect(isAdsReady()).toBe(true);
  } finally { Platform.OS = prev; }
});

it('Android = ATT 호출 0', async () => {
  const prev = Platform.OS; Platform.OS = 'android';
  try {
    await initAds();
    expect(mockAtt.calls).toBe(0);
    expect(mockMetaTracking).not.toHaveBeenCalled();
    expect(isAdsReady()).toBe(true);
  } finally { Platform.OS = prev; }
});

it('canRequestAds=false(동의 거부·미수집) = unavailable — initialize 0·ATT 0 · 계측은 상태 그대로(required)', async () => {
  const prev = Platform.OS; Platform.OS = 'ios';
  try {
    mockAds.consentInfo = { ...mockAds.consentInfo, status: 'REQUIRED', canRequestAds: false };
    await initAds();
    expect(getAdsState()).toBe('unavailable');
    expect(mockAds.initialize).not.toHaveBeenCalled();
    expect(mockAtt.calls).toBe(0);
    expect(mockTrack).toHaveBeenCalledWith('ad_consent_result', { status: 'required' });
  } finally { Platform.OS = prev; }
});

it('/review 8: 동의 갱신 실패(오프라인)여도 지난 세션 동의가 캐시돼 canRequestAds=true면 초기화 진행 → ready', async () => {
  mockAds.gatherConsent.mockRejectedValueOnce(new Error('network'));
  await expect(initAds()).resolves.toBeUndefined();
  expect(getAdsState()).toBe('ready');
  expect(mockAds.initialize).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('ad_consent_result', { status: 'obtained' });
});

it('동의 갱신 실패 + 캐시도 없음(canRequestAds=false) = unavailable · getConsentInfo까지 실패 = unavailable + ad_consent_result error — 앱 흐름은 계속(throw 0)', async () => {
  mockAds.gatherConsent.mockRejectedValueOnce(new Error('network'));
  mockAds.consentInfo = { ...mockAds.consentInfo, status: 'UNKNOWN', canRequestAds: false };
  await expect(initAds()).resolves.toBeUndefined();
  expect(getAdsState()).toBe('unavailable');
  expect(mockAds.initialize).not.toHaveBeenCalled();
  _resetAdsSessionForTest();
  mockAds.gatherConsent.mockRejectedValueOnce(new Error('network'));
  const orig = AdsConsentMock.getConsentInfo;
  AdsConsentMock.getConsentInfo = async () => { throw new Error('native'); };
  try {
    await expect(initAds()).resolves.toBeUndefined();
    expect(getAdsState()).toBe('unavailable');
    expect(mockTrack).toHaveBeenCalledWith('ad_consent_result', { status: 'error' });
  } finally { AdsConsentMock.getConsentInfo = orig; }
});

it('두 번째 initAds는 no-op(동의·초기화 1회)', async () => {
  await initAds();
  await initAds();
  expect(mockAds.gatherConsent).toHaveBeenCalledTimes(1);
  expect(mockAds.initialize).toHaveBeenCalledTimes(1);
});

it('FLAGS.ads.enabled=false = SDK require 0 → unavailable, 동의·초기화·계측 전부 0', async () => {
  adsFlags.enabled = false;
  expect(getAdsSdk()).toBeNull();
  await initAds();
  expect(getAdsState()).toBe('unavailable');
  expect(mockAds.gatherConsent).not.toHaveBeenCalled();
  expect(mockAds.initialize).not.toHaveBeenCalled();
  expect(mockTrack).not.toHaveBeenCalled();
});

it('개인정보 옵션: REQUIRED면 노출 · showPrivacyOptions 뒤 상태 재반영', async () => {
  mockAds.consentInfo = { ...mockAds.consentInfo, privacyOptionsRequirementStatus: 'REQUIRED' };
  await initAds();
  expect(isPrivacyOptionsRequired()).toBe(true);
  mockAds.showPrivacyOptionsForm.mockResolvedValueOnce({ ...mockAds.consentInfo, privacyOptionsRequirementStatus: 'NOT_REQUIRED' });
  await showPrivacyOptions();
  expect(mockAds.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
  expect(isPrivacyOptionsRequired()).toBe(false);
});
