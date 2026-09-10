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
