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

/** KB-699: 세션에서 마지막으로 확인된 동작 줄이기 값 — 새 마운트의 초깃값(useState 초기화 함수에서만 읽음).
 *  Codex #229: 구독자가 없는 동안 바뀐 설정을 낡은 값으로 믿으면 안 된다(낡은 false = 동작 줄이기 사용자에게 움직임,
 *  낡은 true = 축하 유실) → **이번 포그라운드 구간에서 확인된 값만** 초깃값으로 쓴다(fresh). 앱이 뒤로 가면(설정 앱 등) 낡음 표시,
 *  돌아오면 한 번 다시 조회해 떠 있는 컴포넌트까지 갱신. 앱 수명 리스너(아래)라 마운트 0이어도 바뀐 설정을 받는다. */
let lastKnownReduceMotion: boolean | null = null;
let reduceMotionFresh = false;
const reduceMotionListeners = new Set<(v: boolean) => void>();
function confirmReduceMotion(v: boolean) {
  lastKnownReduceMotion = v;
  reduceMotionFresh = true;
  reduceMotionListeners.forEach((l) => l(v));
}
// ponytail: import 시 1회 등록 · 해제 없음(앱 수명) — 컴포넌트 리스너보다 먼저 붙어 테스트의 "마지막 등록 핸들러" 캡처와도 안 엮인다
AccessibilityInfo?.addEventListener?.('reduceMotionChanged', (v) => confirmReduceMotion(!!v));
AppState?.addEventListener?.('change', (s) => {
  if (!isForeground(s)) {
    reduceMotionFresh = false; // 떠 있는 컴포넌트의 값은 그대로(돌아오면 아래 조회가 갱신) — 새 마운트만 미확인으로 시작
    return;
  }
  if (!reduceMotionFresh) {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => confirmReduceMotion(!!v))
      .catch(() => {});
  }
});
/** 유닛용 리셋 */
export function _resetMotionMemoryForTest() {
  lastKnownReduceMotion = null;
  reduceMotionFresh = false;
}

/** 모션 판정 한 벌 — visible(포커스·포그라운드) · reduceMotion(null = 미확인) · paused(둘의 합: 반복 정지)를 같은 출처에서.
 *  KB-680: 뱃지의 팝·폭죽도 이 값. "보이는가"와 "동작 줄이기"를 따로 내주는 이유 = 조회가 끝내 실패(null 고착)해도
 *  보이는 순간 "움직이지 않고 끝내기"를 고를 수 있게(대기 고착 방지). */
export function useMotionState(): { paused: boolean; visible: boolean; reduceMotion: boolean | null } {
  const [focused, setFocused] = React.useState(true);
  const [active, setActive] = React.useState(isForeground(AppState.currentState));
  // Codex P2(8R): 동작 줄이기 설정은 **확인되기 전까지 켜진 것으로 본다**(null = 미확인 → 정지).
  // 조회가 늦거나 실패해도 그 설정을 켠 사용자에게 애니메이션이 먼저 나가면 안 된다.
  // (AppState와 반대로 두는 이유: 이건 접근성 선호라 불확실하면 움직이지 않는 쪽이 안전하다.)
  // KB-699: 새로 마운트되는 컴포넌트도 이번 포그라운드 구간에서 확인된 값으로 시작(미확인 null로 시작하면 "보이는데 미확인 = 즉시 종료"로
  // 막 마운트된 축하가 폭죽 없이 끝났다). 확인 전·낡은 값(뒤로 갔다 옴)은 그대로 null(보수 — Codex #229).
  const [reduceMotion, setReduceMotion] = React.useState<boolean | null>(() => (reduceMotionFresh ? lastKnownReduceMotion : null));

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
    reduceMotionListeners.add(setReduceMotion); // 확인값(조회·설정 변경·포그라운드 재조회)은 떠 있는 모두에게
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => confirmReduceMotion(!!v))
      .catch(() => {}); // 실패 = 미확인 유지(null) → 정지. 설정 변경 이벤트가 오면 그때 반영
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => confirmReduceMotion(!!v));
    return () => {
      reduceMotionListeners.delete(setReduceMotion);
      sub.remove();
    };
  }, []);

  const visible = focused && active;
  return { paused: !visible || reduceMotion !== false, visible, reduceMotion };
}

export function useMotionPaused(): boolean {
  return useMotionState().paused;
}
