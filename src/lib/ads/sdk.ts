/**
 * ads/sdk (KB-739) — react-native-google-mobile-ads 지연 require 한 곳.
 * 정적 import면 모듈 로드 시 TurboModule을 요구해 네이티브가 없는 런타임(웹·유닛·구 dev client + 새 Metro)에서 Metro fatal로
 * 죽는다(P-192·KB-730 교훈: try/catch는 로드 시점엔 무력). 그래서 **부르는 쪽에서만** 로드하고, 없으면 null — 광고 코드 전체가 자리 0으로 접힌다.
 * 결과는 모듈 캐시(런타임 안에서 네이티브 존재 여부는 안 바뀐다).
 */
import { Platform } from 'react-native';
import { FLAGS } from '@/lib/flags';

export type AdsSdk = typeof import('react-native-google-mobile-ads');

let cached: AdsSdk | null | undefined;

export function getAdsSdk(): AdsSdk | null {
  if (cached !== undefined) return cached;
  if (!FLAGS.ads.enabled || Platform.OS === 'web') {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-google-mobile-ads') as AdsSdk;
  } catch {
    cached = null; // 네이티브 모듈 없음(구 빌드·유닛) — 광고만 빠지고 앱은 그대로
  }
  return cached;
}

export function _resetAdsSdkForTest(): void {
  cached = undefined;
}
