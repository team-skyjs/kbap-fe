/**
 * storeReview.ts — 기본 평점 창(iOS StoreKit / Android in-app review) 요청. 뜨는지는 OS가 정한다(보장 없음).
 * expo-store-review는 네이티브 모듈 — KB-730 도입으로 runtime fingerprint가 바뀌어 **네이티브 재빌드 전 OTA로 받은 구 빌드엔 모듈이 없다**.
 *
 * 구 빌드에서 `require('expo-store-review')`를 하면 모듈 초기화의 `requireNativeModule('ExpoStoreReview')`가 던지는데,
 * 이벤트 핸들러 안의 지연 require는 Metro `guardedLoadModule`(inGuard=false)이 그 예외를 삼키고
 * `ErrorUtils.reportFatalError`로 보고한다 — 호출측 try/catch로는 못 잡고 릴리스면 치명 예외(QA 10/9 실측, 구 빌드 bbc9c4dc).
 * 그래서 **require 전에** expo-modules-core의 `requireOptionalNativeModule`로 네이티브 모듈 존재를 판정하고, 없으면
 * require 없이 "미지원"(false)으로 끝낸다 — 시트의 "좋아요"는 이미 눌렸고 종료 표시는 호출측이 한다.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

/** 네이티브 모듈이 이 빌드에 링크돼 있는가(구 빌드 = false). Metro 모듈 로드를 일으키지 않는다. */
export function isStoreReviewModuleInstalled(): boolean {
  try {
    return requireOptionalNativeModule('ExpoStoreReview') != null;
  } catch {
    return false;
  }
}

export async function requestStoreReview(): Promise<boolean> {
  if (!isStoreReviewModuleInstalled()) return false; // 구 빌드 — require 자체를 하지 않는다(위 주석)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 모듈이 있을 때만 지연 로드(정적 import면 구 빌드 부팅에서 치명)
    const SR = require('expo-store-review') as typeof import('expo-store-review');
    if (!(await SR.isAvailableAsync())) return false;
    await SR.requestReview();
    return true;
  } catch {
    return false; // OS 거절·호출 실패 — 조용히
  }
}
