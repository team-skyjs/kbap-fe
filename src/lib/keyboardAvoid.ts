/**
 * keyboardAvoid (KB-768) — 키보드 회피 단일 규칙.
 *
 * **전제 변경**: Expo 57 Android 템플릿 = `edgeToEdgeEnabled=true` + targetSdk 36 → RN이 `window.enableEdgeToEdge()`
 * (decorFitsSystemWindows false)를 건다. 이 모드에선 매니페스트 `adjustResize`가 **창을 줄이지 않는다** — 예전 주석의
 * "안드는 adjustResize라 회피 불필요"가 깨져 리뷰 작성 본문·Post review·신고 사유·장소 검색 시트가 키보드에 가렸다(QA B2-1).
 * RN Modal의 다이얼로그 창도 edge-to-edge 강제(navigationBarTranslucent getter)라 같은 처지.
 *
 * 규칙
 * - 화면: `<KeyboardAvoidingView behavior={KAV_BEHAVIOR}>` — 두 플랫폼 모두 'padding'(iOS는 종전과 동일).
 * - 키보드 높이를 직접 쓰는 곳(시트 리프트·안드 내리기 바): `useKeyboardLift()` — 창 아래 끝에서 키보드 위 끝까지의 거리.
 *   RN 안드 keyboardDidShow의 height는 IME − 시스템 바(내비 바 제외)라 edge-to-edge 창 기준으론 내비 바 인셋을 더한다.
 */
import * as React from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const KAV_BEHAVIOR = 'padding' as const;

/** 안드 키보드 내리기 바(KeyboardDismissBar AndroidBar) 높이 — 바 스타일이 이 값으로 고정된다. 바를 띄우는 Modal 시트는 리프트에 이만큼 더한다
 *  (KB-768 QA: 신고 Submit 아래 ~20px가 바에 잘림). iOS는 액세서리 바가 키보드 프레임 안이라 더하지 않는다. */
export const DISMISS_BAR_H = 40;

/** 창 아래 끝 → 키보드 위 끝(px). 키보드 없으면 0. `dismissBar` = 그 위에 안드 내리기 바가 뜨는 자리(Modal 시트) — 바 높이까지 비운다. */
export function useKeyboardLift({ dismissBar = false }: { dismissBar?: boolean } = {}): number {
  const insets = useSafeAreaInsets();
  const [h, setH] = React.useState(0);
  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const kb = e?.endCoordinates?.height ?? 0;
      if (__DEV__) console.log('[kbd] show', Platform.OS, kb); // KB-768: 네이티브 Modal 안에서도 이벤트가 오는지 QA 확인용(개발 번들만)
      setH(kb);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (h <= 0) return 0;
  return Platform.OS === 'android' ? h + insets.bottom + (dismissBar ? DISMISS_BAR_H : 0) : h;
}
