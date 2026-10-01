/**
 * useMotionPaused — 반복 모션(자동 넘김·펄스)을 멈춰야 하는가. 화면 blur · 앱 background · 동작 줄이기(미확인 포함) = 정지.
 * P-383(KB-566) HeroGallery의 로컬 훅을 KB-680 카운트다운 뱃지와 공유하려고 옮겼다(동작 무변).
 */
import * as React from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** 명시적으로 뒤로 간 경우만 멈춘다. 초기값이 null·'unknown'일 수 있어서(RN AppState는 네이티브
 *  상수가 오기 전 null로 시작) === 'active'로 판정하면 자동 넘김이 영영 시작 안 할 수 있다. */
const isForeground = (s: string | null | undefined) => s !== 'background' && s !== 'inactive';

export function useMotionPaused(): boolean {
  const [focused, setFocused] = React.useState(true);
  const [active, setActive] = React.useState(isForeground(AppState.currentState));
  // Codex P2(8R): 동작 줄이기 설정은 **확인되기 전까지 켜진 것으로 본다**(null = 미확인 → 정지).
  // 조회가 늦거나 실패해도 그 설정을 켠 사용자에게 애니메이션이 먼저 나가면 안 된다.
  // (AppState와 반대로 두는 이유: 이건 접근성 선호라 불확실하면 움직이지 않는 쪽이 안전하다.)
  const [reduceMotion, setReduceMotion] = React.useState<boolean | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(isForeground(s)));
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(!!v))
      .catch(() => {}); // 실패 = 미확인 유지(null) → 정지. 설정 변경 이벤트가 오면 그때 반영
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(!!v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return !focused || !active || reduceMotion !== false;
}
