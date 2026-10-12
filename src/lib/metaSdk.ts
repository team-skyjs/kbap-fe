/**
 * metaSdk (P-397/KB-600) — Meta SDK는 **설치 어트리뷰션(SKAdNetwork)만** 쓴다.
 *
 * 로그인·공유·커스텀 이벤트 등 SDK API는 하나도 쓰지 않는다. 앱 이벤트(설치·실행)는
 * 네이티브가 자동으로 보낸다(`autoLogAppEventsEnabled`·`isAutoInitEnabled` — app.json).
 * 그래서 JS에서 할 일은 **광고 추적 비활성 선언 한 줄**뿐이다.
 *
 * KB-739(10/12 예진, AdMob): ATT 프롬프트를 **띄운다**(9/21 D2 뒤집음 — Apple 5.1.2: 광고 SDK엔 ATT 필수). 기동 시엔 false로
 * 시작하고, lib/ads/adsSession이 ATT 결과를 `setMetaTrackingEnabled(granted)`로 넘긴다 — 사용자 선택과 Meta 추적 플래그가 한 쌍.
 * App Store 개인정보 라벨은 "추적에 사용"으로(KB-741 예진). 문구는 app.json 플러그인(ads·expo-tracking-transparency) + locales/*.json.
 * Android 광고 ID는 **허용**(9/22 예진 — `advertiserIDCollectionEnabled:true`, 권한 차단 없음). JS에서
 * `setAdvertiserIDCollectionEnabled`를 부르지 않는다 — 부르면 app.json 선언을 런타임에 뒤집는다.
 *
 * 네이티브 모듈 부재(웹·유닛·구 런타임)에서 죽지 않게 지연 require + try/catch(P-192 관례).
 */
import { Platform } from 'react-native';

let done = false;

/** 앱 진입 1회. 실패해도 조용히 넘어간다 — 광고 계측이 앱 부팅을 막으면 안 된다. */
export function initMetaSdk(): void {
  if (done || Platform.OS === 'web') return;
  done = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Settings } = require('react-native-fbsdk-next') as typeof import('react-native-fbsdk-next');
    // iOS 전용 API지만 안드에서도 no-op이라 분기하지 않는다(라이브러리 구현).
    Settings.setAdvertiserTrackingEnabled(false);
  } catch {
    /* 네이티브 모듈 없음 — 계측만 빠지고 앱은 그대로 */
  }
}

/** KB-739: ATT 결과 반영 — 허용이면 true(IDFA 기반 어트리뷰션), 거부·미결정이면 false. 안드는 no-op(라이브러리 구현) */
export function setMetaTrackingEnabled(enabled: boolean): void {
  if (Platform.OS !== 'ios') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Settings } = require('react-native-fbsdk-next') as typeof import('react-native-fbsdk-next');
    Settings.setAdvertiserTrackingEnabled(enabled);
  } catch {
    /* 네이티브 모듈 없음 */
  }
}

export default initMetaSdk;
