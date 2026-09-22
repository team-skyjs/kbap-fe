/**
 * deviceInfo (P-394/KB-586) — 문의에 함께 보낼 기기 정보. **유저 입력 0**(자동 수집).
 *
 * 계약(feedback-contract §2): 9키 전부 선택이고 **못 얻는 키는 생략**한다(빈 문자열 금지 —
 * 어드민 화면에서 "빈 값"과 "미수집"이 구분돼야 한다).
 * 지연 require 관례(P-192): 네이티브 모듈 부재·구 런타임에서도 import 시점에 죽지 않는다.
 */
import { Platform } from 'react-native';
import i18n from '@/lib/i18n';

export interface DeviceInfo {
  os?: string;
  osVersion?: string;
  appVersion?: string;
  buildNumber?: string;
  runtimeVersion?: string;
  deviceModel?: string;
  locale?: string;
  lang?: string;
  timezone?: string;
}

/** 값이 있을 때만 키를 넣는다(계약: 키 누락 허용). */
const put = (o: DeviceInfo, k: keyof DeviceInfo, v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
  if (s) o[k] = s;
};

export function collectDeviceInfo(): DeviceInfo {
  const out: DeviceInfo = {};
  put(out, 'os', Platform.OS);
  // 안드로이드 `Platform.Version`은 **API 레벨**(35)이라 유저가 아는 릴리스(15)와 다르다 —
  // client.ts의 deviceHeaders가 이미 같은 구분을 한다(Codex #170). iOS는 Version이 곧 릴리스.
  const androidRelease = (Platform.constants as { Release?: string } | undefined)?.Release;
  put(out, 'osVersion', Platform.OS === 'android' ? (androidRelease ?? Platform.Version) : Platform.Version);
  // 버전·빌드 번호는 **설치된 바이너리**에서 읽는다. app.json에는 ios.buildNumber도
  // android.versionCode도 없고(eas.json appVersionSource=remote + autoIncrement),
  // 그래서 expoConfig 경유로는 buildNumber가 항상 비어 나갔다(Codex #170).
  // expo-application은 expo-notifications가 이미 끌고 와 네이티브 빌드에 들어 있다 —
  // 직접 의존으로 추가하는 게 아니라서 **지문이 회전하지 않는다**(expo-device와 다른 점).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const App = require('expo-application') as typeof import('expo-application');
    put(out, 'appVersion', App.nativeApplicationVersion);
    put(out, 'buildNumber', App.nativeBuildVersion);
  } catch {
    /* 미설치·구 런타임 — 아래 expoConfig 폴백 */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = (require('expo-constants') as { default: typeof import('expo-constants').default }).default;
    if (!out.appVersion) put(out, 'appVersion', Constants.expoConfig?.version);
  } catch {
    /* 값 없이 진행 — 문의 전송 자체를 막지 않는다 */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as typeof import('expo-updates');
    put(out, 'runtimeVersion', Updates.runtimeVersion);
  } catch {
    /* dev 클라이언트 등 — 생략 */
  }
  // deviceModel: **새 네이티브 의존성 없이** 얻을 수 있는 것만 넣는다.
  // `expo-device`는 미설치이고, 추가하면 네이티브 모듈이라 지문이 회전해 재빌드가 필요하다
  // (계약상 이 키는 선택이라 생략이 허용된다 — 커맨드 센터 보고).
  // Android는 RN이 Platform.constants.Model을 준다. iOS는 대응 값이 없어 생략.
  put(out, 'deviceModel', (Platform.constants as { Model?: string } | undefined)?.Model);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Localization = require('expo-localization') as typeof import('expo-localization');
    put(out, 'locale', Localization.getLocales()[0]?.languageTag);
    put(out, 'timezone', Localization.getCalendars()[0]?.timeZone);
  } catch {
    /* 생략 */
  }
  put(out, 'lang', i18n.language); // 표시 언어 = 답변 언어 판단 근거
  return out;
}

export default collectDeviceInfo;
