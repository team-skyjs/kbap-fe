/**
 * ads/units (KB-739) — 자리(placement) → 광고 단위 ID. **production 채널만 실 단위**(admob-ids-2026-10-12.md), 그 외(teamtest·
 * dev·preview·웹·유닛)는 Google 데모 단위 고정 — 실 단위 클릭은 무효 트래픽으로 계정 정지 사유라 채널 판별을 negate가 아니라
 * `isProdChannel()` 양성으로만 연다. SDK를 import하지 않는 순수 모듈(채널별 유닛이 네이티브 없이 돈다).
 */
import { Platform } from 'react-native';
import { isProdChannel } from '@/lib/flags';

export type AdPlacement = 'search_banner' | 'feed_banner' | 'feed_native' | 'order_done_interstitial' | 'scan_unlock_rewarded';
export type AdFormat = 'banner' | 'native' | 'interstitial' | 'rewarded';

export const AD_FORMAT: Record<AdPlacement, AdFormat> = {
  search_banner: 'banner',
  feed_banner: 'banner',
  feed_native: 'native',
  order_done_interstitial: 'interstitial',
  scan_unlock_rewarded: 'rewarded',
};

type PerPlatform = { android: string; ios: string };

/** 실 단위 — AdMob 콘솔(게시자 pub-7408893286425419). 비밀 값 아님 */
export const PROD_UNITS: Record<AdPlacement, PerPlatform> = {
  search_banner: { android: 'ca-app-pub-7408893286425419/2247057171', ios: 'ca-app-pub-7408893286425419/2522389349' },
  feed_banner: { android: 'ca-app-pub-7408893286425419/6844777730', ios: 'ca-app-pub-7408893286425419/8591394660' },
  order_done_interstitial: { android: 'ca-app-pub-7408893286425419/5994730497', ios: 'ca-app-pub-7408893286425419/5965231329' },
  scan_unlock_rewarded: { android: 'ca-app-pub-7408893286425419/4681648821', ios: 'ca-app-pub-7408893286425419/9167688747' },
  feed_native: { android: 'ca-app-pub-7408893286425419/7116240474', ios: 'ca-app-pub-7408893286425419/1289198722' },
};

/** Google 데모 단위(developers.google.com/admob/{android,ios}/test-ads) — 발주 (2) 고정값 */
export const DEMO_UNITS: Record<AdFormat, PerPlatform> = {
  banner: { android: 'ca-app-pub-3940256099942544/6300978111', ios: 'ca-app-pub-3940256099942544/2934735716' },
  interstitial: { android: 'ca-app-pub-3940256099942544/1033173712', ios: 'ca-app-pub-3940256099942544/4411468910' },
  rewarded: { android: 'ca-app-pub-3940256099942544/5224354917', ios: 'ca-app-pub-3940256099942544/1712485313' },
  native: { android: 'ca-app-pub-3940256099942544/2247696110', ios: 'ca-app-pub-3940256099942544/3986624511' },
};

const platformKey = (os: string = Platform.OS): keyof PerPlatform => (os === 'android' ? 'android' : 'ios');

/** 순수 판정 — 테스트 잠금용 분리 */
export function unitFor(placement: AdPlacement, prod: boolean, os: string = Platform.OS): string {
  const key = platformKey(os);
  return prod ? PROD_UNITS[placement][key] : DEMO_UNITS[AD_FORMAT[placement]][key];
}

export function adUnitId(placement: AdPlacement): string {
  return unitFor(placement, isProdChannel());
}
