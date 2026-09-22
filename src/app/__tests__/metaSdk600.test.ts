/**
 * P-397(KB-600) — Meta SDK 도입(ATT 없음).
 * ① 부트스트랩: 네이티브 모듈이 없어도 죽지 않고, 있으면 광고 추적 비활성 1회만
 * ② app.json 옵션 잠금: iosUserTrackingPermission **부재**(ATT 없음) · Android 광고 ID **허용**(9/22 예진)
 * ③ SDK API 사용 범위: Settings 외 호출 0(로그인·공유·커스텀 이벤트 없음)
 *
 * ⚠️ 네이티브 변경 — 지문이 회전한다. 다음 네이티브 빌드에서 반영된다.
 */
import * as fs from 'fs';

const RAW = fs.readFileSync('app.json', 'utf8');
const APP = JSON.parse(RAW) as {
  expo: {
    plugins: (string | [string, Record<string, unknown>])[];
    android: { permissions: string[]; blockedPermissions: string[] };
  };
};
const fb = (() => {
  const p = APP.expo.plugins.find((x) => (Array.isArray(x) ? x[0] : x) === 'react-native-fbsdk-next');
  return Array.isArray(p) ? p[1] : undefined;
})();

afterEach(() => {
  jest.resetModules();
  jest.dontMock('react-native-fbsdk-next');
});

it('① 네이티브 모듈이 없어도 부팅을 막지 않는다(웹·유닛·구 런타임)', () => {
  jest.doMock('react-native-fbsdk-next', () => {
    throw new Error('native module missing');
  });
  const { initMetaSdk } = require('@/lib/metaSdk') as typeof import('@/lib/metaSdk');
  expect(() => initMetaSdk()).not.toThrow();
});

it('① 모듈이 있으면 광고 추적 비활성을 **false로** 1회만 선언한다', () => {
  const setAdvertiserTrackingEnabled = jest.fn();
  jest.doMock('react-native-fbsdk-next', () => ({ Settings: { setAdvertiserTrackingEnabled } }));
  const { initMetaSdk } = require('@/lib/metaSdk') as typeof import('@/lib/metaSdk');
  initMetaSdk();
  initMetaSdk(); // 재호출해도 한 번만 — 앱 진입 1곳 전제
  expect(setAdvertiserTrackingEnabled).toHaveBeenCalledTimes(1);
  expect(setAdvertiserTrackingEnabled).toHaveBeenCalledWith(false);
});

it('② 플러그인 옵션 — 설치 어트리뷰션 구성 잠금', () => {
  expect(fb).toBeTruthy();
  expect(fb!.appID).toBe('2530115400831168');
  expect(fb!.scheme).toBe('fb2530115400831168');
  expect(fb!.displayName).toBe('K-Bap');
  expect(typeof fb!.clientToken).toBe('string');
  expect(fb!.clientToken).not.toBe('<CLIENT_TOKEN>'); // 자리표시자인 채로 머지 금지
  expect(fb!.autoLogAppEventsEnabled).toBe(true);
  expect(fb!.isAutoInitEnabled).toBe(true);
});

it('② ATT 없음 — iosUserTrackingPermission 부재 · NSUserTracking 문구 0', () => {
  // 이 키가 생기면 ATT 프롬프트가 뜨고 App Store 개인정보 라벨이 "추적"으로 바뀐다(9/21 예진 D2)
  expect('iosUserTrackingPermission' in fb!).toBe(false);
  expect(RAW).not.toContain('NSUserTrackingUsageDescription');
  expect(RAW).not.toContain('expo-tracking-transparency');
});

/* 9/22 예진 결정: Android 광고 ID **허용**. 9/21 초안(차단 4종 + 수집 false)을 되돌렸다 — 선언만 두고
   수집을 끄거나, 수집을 켜고 선언을 막는 반쪽 상태가 되지 않게 둘을 함께 잠근다. */
it('② Android 광고 ID 허용 — 수집 true · 광고 권한 차단 0 · 기존 차단 2종(KB-592) 보존', () => {
  expect(fb!.advertiserIDCollectionEnabled).toBe(true);
  const blocked = APP.expo.android.blockedPermissions;
  for (const p of [
    'com.google.android.gms.permission.AD_ID',
    'android.permission.ACCESS_ADSERVICES_AD_ID',
    'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
    'android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE',
    'android.permission.ACCESS_ADSERVICES_TOPICS',
  ]) expect(blocked).not.toContain(p);
  expect(blocked).toEqual(['android.permission.ACTIVITY_RECOGNITION', 'android.permission.RECORD_AUDIO']);
  expect(APP.expo.android.permissions).toEqual(['android.permission.CAMERA']); // RECORD_AUDIO 없음(KB-592)
});

it('② JS가 광고 ID 수집을 런타임에 뒤집지 않는다(app.json 선언이 정본)', () => {
  expect(fs.readFileSync('src/lib/metaSdk.ts', 'utf8')).not.toMatch(/setAdvertiserIDCollectionEnabled\(/);
});

it('③ SDK API 사용 범위 — Settings 한 곳뿐(로그인·공유·커스텀 이벤트 0)', () => {
  const users = ['src/lib/metaSdk.ts', 'src/app/_layout.tsx'];
  for (const f of users) expect(fs.existsSync(f)).toBe(true);
  // 레포 전체에서 SDK를 import 하는 곳은 metaSdk.ts 하나
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !p.includes('__tests__') && fs.readFileSync(p, 'utf8').includes('react-native-fbsdk-next')) hits.push(p);
    }
  };
  walk('src');
  expect(hits).toEqual(['src/lib/metaSdk.ts']);
  const src = fs.readFileSync('src/lib/metaSdk.ts', 'utf8');
  for (const api of ['LoginManager', 'ShareDialog', 'AppEventsLogger', 'AccessToken', 'logEvent']) {
    expect(src).not.toContain(api);
  }
});
