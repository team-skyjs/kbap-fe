/**
 * metaSdk (P-397/KB-600) — Meta SDK는 **설치 어트리뷰션(SKAdNetwork)만** 쓴다.
 *
 * 로그인·공유·커스텀 이벤트 등 SDK API는 하나도 쓰지 않는다. 앱 이벤트(설치·실행)는
 * 네이티브가 자동으로 보낸다(`autoLogAppEventsEnabled`·`isAutoInitEnabled` — app.json).
 * 그래서 JS에서 할 일은 **광고 추적 비활성 선언 한 줄**뿐이다.
 *
 * ⚠️ ATT 프롬프트를 띄우지 않는다(9/21 예진 D2). iOS는 여기 `setAdvertiserTrackingEnabled(false)` +
 * `iosUserTrackingPermission` 부재(app.json)가 한 쌍 — 한쪽만 바꾸면 App Store 개인정보 라벨("추적에
 * 사용되는 데이터")과 실제 동작이 어긋난다. IDFA 없이도 SKAdNetwork 설치 어트리뷰션은 동작한다.
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

export default initMetaSdk;
