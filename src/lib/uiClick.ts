/**
 * uiClick (KB-784) — 화면 조회(screen_view)·버튼 클릭(ui_click) 공용 규칙. 계측 호출은 두 곳뿐:
 *  - app/_layout의 useScreenTracking(라우트 세그먼트 → screen, 바뀔 때 1회 · 포그라운드 복귀 재발화 없음)
 *  - components/Pressable(앱의 모든 누르는 요소가 지나가는 곳) → trackUiClick(testID 또는 uiTarget)
 *
 * PII: screen = 라우트 **패턴**(food/[id] — 실제 id 없음). target = testID를 토큰으로 나눠 **소문자 영단어만** 남기고
 * 나머지(숫자·대문자 코드·비ASCII·공백 섞인 값 = id·재료 코드·국가 코드·이름)는 `:v`로 바꾼다 — 예 `avoid-EGG` → `avoid-:v`,
 * `home-food-123` → `home-food-:v`, `nat-US` → `nat-:v`. 자유 텍스트를 testID에 넣는 것은 잠금 유닛이 막는다(uiClickCoverage784).
 */
import { EVENTS, track } from '@/lib/analytics';

let currentScreen = 'root';

/** expo-router useSegments → 라우트 패턴. (tabs) 그룹 루트 = 홈 → `(tabs)/index`. 빈 배열 = root */
export function screenFromSegments(segments: readonly string[]): string {
  if (!segments.length) return 'root';
  const s = segments.join('/');
  return segments[segments.length - 1] === '(tabs)' ? `${s}/index` : s;
}

export function setCurrentScreen(screen: string): void {
  currentScreen = screen;
}

export function getCurrentScreen(): string {
  return currentScreen;
}

const WORD = /^[a-z]+$/;
const SEP = /^[-_./]$/;
/** testID → 계측 target. 구분자(- _ . /)로 나눈 토큰 중 소문자 영단어만 원문, 그 외 `:v`. 이어지는 `:v`는 하나로. */
export function normalizeTarget(raw: string): string {
  const mapped = raw
    .trim()
    .split(/([-_./])/)
    .map((p) => (p === '' || SEP.test(p) ? p : WORD.test(p) ? p : ':v'))
    .join('');
  return mapped.replace(/(?::v[-_./])+:v/g, ':v').replace(/^[-_./]+|[-_./]+$/g, '') || ':v';
}

/** 누르는 요소 1회 탭 = ui_click 1건. target 없으면(잠금이 막지만 런타임 방어) 'unlabeled' — 원문을 짐작해 붙이지 않는다 */
export function trackUiClick(target: string | undefined): void {
  try {
    track(EVENTS.ui_click, { screen: currentScreen, target: target ? normalizeTarget(target) : 'unlabeled' });
  } catch {
    /* 계측이 탭을 막으면 안 된다 */
  }
}
