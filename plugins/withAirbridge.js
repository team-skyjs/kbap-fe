/**
 * KB-783: 에어브릿지(MMP) Expo 플러그인 래퍼 — **앱 토큰을 config에 넣지 않는다.**
 *
 * 공식 등록(`["airbridge-expo-sdk", { appName, appToken }]`)은 토큰이 플러그인 인자 = expo config에 실린다.
 * expo config는 runtime fingerprint 소스라, 토큰이 있는 셸(EAS 빌드)과 없는 셸(로컬·로봇 export)의 지문이 갈라져
 * OTA 도달 0이 된다(P-195/196 계열). 그래서 config엔 appName만 두고, 토큰은 공식 플러그인 mod가 **실행될 때**
 * (prebuild — Info.plist·values/airbridge.xml 기록 시점) 환경변수 AIRBRIDGE_APP_TOKEN에서 읽는다.
 * 공식 플러그인은 인자 객체를 mod 실행 시점에 읽으므로 getter로 늦게 꽂으면 된다(airbridge-expo-sdk 4.11.0 실측).
 *
 * 토큰 정본 = EAS 환경변수(예진 등록). 레포 평문 0.
 * EAS 빌드(EAS_BUILD=true)에서 비어 있으면 prebuild를 **실패**시킨다 — 토큰 없는 스토어 빌드(계측 0)를 조용히 만들지 않는다.
 * 로컬 prebuild는 경고만(빈 토큰 = SDK 미작동).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const withAirbridgeOfficial = require('airbridge-expo-sdk/app.plugin').default;

const ENV_KEY = 'AIRBRIDGE_APP_TOKEN';

function readToken() {
  return (process.env[ENV_KEY] || '').trim();
}

function assertToken(platform) {
  if (readToken()) return;
  const msg = `[airbridge] ${ENV_KEY} 비어 있음(${platform}) — EAS 환경변수 등록 필요`;
  if (process.env.EAS_BUILD === 'true') throw new Error(msg);
  console.warn(msg + ' (로컬 prebuild — SDK 미작동)');
}

/** @param {import('@expo/config-plugins').ExpoConfig} config @param {{ appName: string }} props */
module.exports = function withAirbridge(config, props) {
  if (!props || !props.appName) throw new Error('[airbridge] appName 필요');
  const options = {
    appName: props.appName,
    // 공식 플러그인의 `=== undefined` 검사는 통과(빈 문자열), 실제 값은 mod 실행 시점에 읽힌다
    get appToken() {
      return readToken();
    },
  };
  for (const platform of ['ios', 'android']) {
    config = withDangerousMod(config, [platform, async (c) => {
      assertToken(platform);
      return c;
    }]);
  }
  return withAirbridgeOfficial(config, options);
};
