/**
 * ads/adsSession (KB-739) — 앱 기동 1회 동의·초기화 순서와 "광고 요청 가능" 상태, 전면 세션 상한.
 *
 * 순서(발주 (3)): UMP `gatherConsent`(requestInfoUpdate + 필요 시 EEA 폼) → `getConsentInfo().canRequestAds` → iOS면 ATT
 * (expo-tracking-transparency, 결과를 Meta SDK 추적 플래그에도 반영) → `setRequestConfiguration` → `mobileAds().initialize()` → ready.
 * 초기화 전엔 광고 요청 0(컴포넌트가 `useAdsReady()`로 막는다). 동의 실패·오프라인·네이티브 부재 = `unavailable`(광고 없이 진행,
 * 앱 흐름 차단 금지). 렌더는 useSyncExternalStore 구독(모듈 변수 직접 읽기는 컴파일러가 굳힌다 — KB-694).
 *
 * 비prod 채널은 `debugGeography: EEA`로 동의 폼을 강제한다 — UMP 디버그 설정은 **testDeviceIdentifiers에 등록된 기기에만** 적용되므로(QA 4R 실측:
 * 에뮬레이터도 미등록이면 not_required) 비prod에서만 `EXPO_PUBLIC_UMP_TEST_DEVICES`(쉼표 구분 해시 ID)를 함께 넘긴다. 해시 ID는 첫 실행 시
 * UMP가 logcat/Xcode 콘솔에 "addTestDeviceHashedId(\"…\")"로 찍는다. production 채널엔 디버그 옵션 자체를 넘기지 않는다(유닛 잠금).
 */
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { EVENTS, track } from '@/lib/analytics';
import { isProdChannel } from '@/lib/flags';
import { setMetaTrackingEnabled } from '@/lib/metaSdk';
import { getAdsSdk, type AdsSdk } from './sdk';

export type AdsState = 'idle' | 'running' | 'ready' | 'unavailable';

/** 비prod 전용 UMP 디버그 옵션 — production이면 undefined(실 동의 흐름). 순수 함수: 테스트 잠금용 */
export function consentDebugOptions(prod: boolean, env: string | undefined, eea: number): { debugGeography: number; testDeviceIdentifiers: string[] } | undefined {
  if (prod) return undefined;
  const testDeviceIdentifiers = (env ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return { debugGeography: eea, testDeviceIdentifiers };
}

let state: AdsState = 'idle';
let privacyOptionsRequired = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const setState = (s: AdsState) => { state = s; notify(); };

export const getAdsState = (): AdsState => state;
export const isAdsReady = (): boolean => state === 'ready';
export const isPrivacyOptionsRequired = (): boolean => privacyOptionsRequired;

export function useAdsReady(): boolean {
  return useSyncExternalStore(subscribe, isAdsReady, isAdsReady);
}
export function usePrivacyOptionsRequired(): boolean {
  return useSyncExternalStore(subscribe, isPrivacyOptionsRequired, isPrivacyOptionsRequired);
}
/** ready일 때만 SDK — 컴포넌트는 이 훅 하나로 "요청 가능 + 모듈"을 받는다(렌더 중 getAdsSdk() 직접 호출은 컴파일러 굳는 자리 후보 — sweep) */
const getReadySdk = (): AdsSdk | null => (state === 'ready' ? getAdsSdk() : null);
export function useAdsSdk(): AdsSdk | null {
  return useSyncExternalStore(subscribe, getReadySdk, getReadySdk);
}

/** iOS ATT 1회 — 결과는 Meta SDK 추적 플래그와 한 쌍(둘 다 사용자 선택을 따른다). 모듈 부재·안드는 no-op */
async function requestTracking(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const att = require('expo-tracking-transparency') as typeof import('expo-tracking-transparency');
    const { granted } = await att.requestTrackingPermissionsAsync();
    setMetaTrackingEnabled(granted);
  } catch {
    /* 모듈 없음·거부 — 광고는 비개인화로 계속 */
  }
}

/** 앱 기동 1회(탭 진입·스플래시 뒤). 두 번째 호출부터 no-op */
export async function initAds(): Promise<void> {
  if (state !== 'idle') return;
  setState('running');
  const sdk = getAdsSdk();
  if (!sdk) { setState('unavailable'); return; }
  try {
    const { AdsConsent, AdsConsentDebugGeography, AdsConsentPrivacyOptionsRequirementStatus, MaxAdContentRating } = sdk;
    // 동의 갱신 실패(오프라인 등)는 치명 아님 — 지난 세션의 동의가 캐시돼 있으면(getConsentInfo.canRequestAds) 그대로 진행(/review 8)
    const debug = consentDebugOptions(isProdChannel(), process.env.EXPO_PUBLIC_UMP_TEST_DEVICES, AdsConsentDebugGeography.EEA);
    if (debug) {
      // 비prod 진단 경로(QA 5R): reset()으로 이전 NOT_REQUIRED 캐시 무력화 → 넘긴 옵션·반환을 Metro 로그에 → 필요 시 폼
      try {
        AdsConsent.reset();
        console.log('[ads] consent requestInfoUpdate options', JSON.stringify(debug));
        const updated = await AdsConsent.requestInfoUpdate(debug);
        console.log('[ads] consent requestInfoUpdate result', JSON.stringify(updated));
        const shown = await AdsConsent.loadAndShowConsentFormIfRequired();
        console.log('[ads] consent form result', JSON.stringify(shown));
      } catch (e) {
        console.warn('[ads] consent gather failed (debug)', String(e));
      }
    } else {
      await AdsConsent.gatherConsent().catch(() => undefined);
    }
    const info = await AdsConsent.getConsentInfo();
    if (debug) console.log('[ads] consent info', JSON.stringify(info));
    privacyOptionsRequired = info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
    track(EVENTS.ad_consent_result, { status: String(info.status).toLowerCase() }); // unknown|required|not_required|obtained
    if (!info.canRequestAds) { setState('unavailable'); return; }
    await requestTracking();
    const ads = sdk.default();
    await ads.setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG, tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false });
    await ads.initialize();
    setState('ready');
  } catch {
    track(EVENTS.ad_consent_result, { status: 'error' });
    setState('unavailable');
  }
}

/** 설정 "개인정보 옵션" — REQUIRED일 때만 행이 보인다(usePrivacyOptionsRequired) */
export async function showPrivacyOptions(): Promise<void> {
  const sdk = getAdsSdk();
  if (!sdk) return;
  try {
    const info = await sdk.AdsConsent.showPrivacyOptionsForm();
    privacyOptionsRequired = info.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
    notify();
  } catch {
    /* 폼 없음·취소 */
  }
}

/* ---- 전면 세션 상한(발주 ④-①: 세션당 1회) — 앱 실행 동안만, 영구 저장 없음 ---- */
let interstitialShown = false;
export const canShowInterstitial = (): boolean => !interstitialShown;
export function markInterstitialShown(): void { interstitialShown = true; }

export function _resetAdsSessionForTest(): void {
  state = 'idle';
  privacyOptionsRequired = false;
  interstitialShown = false;
  notify();
}
