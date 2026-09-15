/**
 * openWebPage (P-377/KB-541) — 정보성 https 링크는 **인앱 브라우저**로 연다.
 *
 * Sentry REACT-NATIVE-9(iOS 1.0.2+32, env prod): 약관·개인정보 링크에서
 * `Unable to open URL` 5건. 페이지는 정상(HTTP 200)이고, iOS `Linking.openURL`은
 * `UIApplication.open`이 false를 주면 이 예외를 던진다 — 기본 브라우저로 지정한
 * 앱이 삭제됐거나 스크린 타임 웹 콘텐츠 제한이 걸린 기기에서 발생한다.
 * 즉 **외부 브라우저 위임 의존이 원인**이라, 앱이 자체 브라우저를 띄우면 사라진다.
 *
 * 대상 = 우리가 보여주려는 웹페이지(약관·개인정보·안전 고지·외부 검색).
 * 스토어·지도 같은 **네이티브 앱 딥링크는 여기 쓰지 말 것** — 그건 앱으로 열려야
 * 하므로 Linking 직접 호출을 유지한다(VersionGate·placeMap).
 *
 * P-381(KB-541 후속): `openAppSettings`도 같은 이유로 여기 있다. 9/15 Sentry
 * REACT-NATIVE-A — iOS 심사 기기에서 안전 고지 링크와 **2초 간격**으로 설정 열기가
 * 터졌다. `void Linking.openSettings()`의 `void`는 거부를 **잡지 않아서**
 * unhandled rejection으로 흘렀고, 사용자는 눌러도 아무 일이 없었다.
 * → **`void Linking.*` 직접 호출 금지**(글롭 순회 잠금). 실패는 반드시 보이게 한다.
 */
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { showTopToast } from '@/components/topToastStore';
import i18n from '@/lib/i18n';

/** 인앱 브라우저 → (실패 시) 외부 브라우저 → (그래도 실패) 토스트. 열렸으면 true. */
export async function openWebPage(url: string): Promise<boolean> {
  try {
    await WebBrowser.openBrowserAsync(url);
    return true;
  } catch {
    try {
      await Linking.openURL(url); // 인앱 브라우저를 못 쓰는 환경(웹 등) 폴백
      return true;
    } catch {
      showTopToast(i18n.t('states.linkFailed'), { error: true });
      return false;
    }
  }
}

/**
 * OS 설정 앱 열기. 실패하면 **설정 전용 문구**로 토스트(열렸으면 true).
 * `states.linkFailed`("링크를 열 수 없어요")를 재사용하지 않는다 — "설정 열기"를
 * 눌렀는데 링크 이야기가 뜨면 어긋난다.
 */
export async function openAppSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    showTopToast(i18n.t('states.settingsFailed'), { error: true });
    return false;
  }
}

/**
 * 스토어 딥링크 열기 — **인앱 브라우저로 대체하지 않는다**(스토어 앱으로 열려야
 * 업데이트가 된다). 실패하면 토스트: 여기서 조용히 넘기면 사용자가 업데이트를 못 한다.
 *
 * `silent`는 **토스트가 보이지 않는 자리** 전용이다(P-381 2R). 하드 게이트 커버는
 * elevation 1000이라 안드로이드에서 토스트(8)가 뒤에 깔린다 — 그런 호출부는 실패를
 * 자기 화면 안에 인라인으로 띄우고, 보이지도 않을 토스트는 띄우지 않는다(핸드오프로
 * 엉뚱한 화면에 뒤늦게 뜨는 것도 막는다). 반환값으로 실패를 받는다.
 */
export async function openStoreLink(url: string, opts?: { silent?: boolean }): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    if (!opts?.silent) showTopToast(i18n.t('states.linkFailed'), { error: true });
    return false;
  }
}
