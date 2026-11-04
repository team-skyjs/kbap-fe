/**
 * feedbackPrompt (KB-986) — 재방문 피드백 시트 판정. 상태는 기기 UX 상태(AsyncStorage — reviewPrompt.ts 관례, 재설치 초기화 허용).
 * - 대상: 두 번째 이상 실행(콜드 스타트 수) + 홈 화면(홈 큐 마지막 스텝).
 * - 빈도: 보낼 때까지 매 실행. 보내기 성공·"다시 보지 않기" = 영구 종료 · 닫기 = 다음 실행에 다시.
 * - 한 실행에 일회성 시트 하나 — 그 실행에 다른 시트가 이미 떴으면(promptSlot) 다음 실행으로.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitUntil } from '@/lib/oneShotQueue';
import { isAdsSettled, subscribeAds } from '@/lib/ads/adsSession';
import { isOccluded, subscribeOcclusion } from '@/lib/engagement/occlusion';
import { markPromptShown, promptShownThisRun } from '@/lib/engagement/promptSlot';

export const FEEDBACK_PROMPT_KEY = 'kbap.feedbackPrompt.v1';
/** 이 실행 번호 이상부터 노출(첫 실행 = 0) */
export const FEEDBACK_PROMPT_FROM_LAUNCH = 2;

type State = { launches: number; done: boolean };

async function load(): Promise<State> {
  try {
    const raw = await AsyncStorage.getItem(FEEDBACK_PROMPT_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<State>) : {};
    return { launches: typeof v.launches === 'number' ? v.launches : 0, done: v.done === true };
  } catch {
    return { launches: 0, done: false }; // 깨진 값·스토리지 불능 = 처음처럼(안전 기능 아님)
  }
}
const save = (s: State) => AsyncStorage.setItem(FEEDBACK_PROMPT_KEY, JSON.stringify(s)).catch(() => {});

let launch: Promise<number> | null = null;
/** 이 실행을 한 번 센다(런타임당 1회 — 루트와 홈 스텝이 같은 약속을 공유) → 누적 실행 수 */
export function recordLaunch(): Promise<number> {
  launch ??= load().then(async (s) => {
    const next = { ...s, launches: s.launches + 1 };
    await save(next);
    return next.launches;
  });
  return launch;
}

/** 보내기 성공·다시 보지 않기 = 영구 종료 */
export async function markFeedbackPromptDone(): Promise<void> {
  await save({ ...(await load()), done: true });
}

let active = false;
/** 떠 있는 동안 true — 스캔 종료 넛지·리뷰 유도가 비켜 준다 */
export const isFeedbackPromptActive = (): boolean => active;
export function setFeedbackPromptActive(v: boolean): void {
  active = v;
}

/** 홈 큐 스텝 — 띄우면 true(닫힌 뒤 done). 조건 미달·블러 = false(소모 0) */
export async function presentHomeFeedbackPrompt(show: (done: () => void) => void, done: () => void, signal: AbortSignal): Promise<boolean> {
  if (promptShownThisRun()) return false;
  const launches = await recordLaunch();
  if (launches < FEEDBACK_PROMPT_FROM_LAUNCH) return false;
  if ((await load()).done) return false;
  // 첫 실행 UMP·ATT 위 Modal은 iOS가 버린다 — 광고 기동 끝 + 덮개 없음까지(코치마크·동의 시트와 같은 대기)
  if (!(await waitUntil(isAdsSettled, subscribeAds, signal))) return false;
  if (!(await waitUntil(() => !isOccluded(), subscribeOcclusion, signal))) return false;
  if (promptShownThisRun()) return false; // 대기 사이 다른 시트가 떴다
  markPromptShown();
  show(done);
  return true;
}

/** 테스트 전용 — 새 실행 흉내(저장 상태는 유지) */
export function _resetFeedbackPromptForTest(): void {
  launch = null;
  active = false;
}
