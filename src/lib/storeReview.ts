/**
 * storeReview.ts — 기본 평점 창(iOS StoreKit / Android in-app review) 요청. 뜨는지는 OS가 정한다(보장 없음).
 * expo-store-review는 네이티브 모듈 — KB-730 도입으로 runtime fingerprint가 바뀌어 **네이티브 재빌드 전 OTA로 받은 구 빌드엔 모듈이 없다**.
 * 그 경우 require·호출이 던지므로 전부 삼킨다(시트의 "좋아요"는 이미 눌렸고 종료 표시는 호출측이 한다).
 */
export async function requestStoreReview(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SR = require('expo-store-review') as typeof import('expo-store-review');
    if (!(await SR.isAvailableAsync())) return false;
    await SR.requestReview();
    return true;
  } catch {
    return false; // 모듈 없음(구 빌드)·OS 거절 — 조용히
  }
}
