/**
 * reviewPrompt.ts — 앱 스토어 리뷰 유도 규칙(KB-730, 기획안 §2). iOS 기본 평점 창은 Apple이 연 3회 제한·강제 불가라
 * 우리 규칙으로 반복되는 **자체 시트** + 긍정 답에만 기본 창(requestReview).
 * 상태는 기기 UX 상태(AsyncStorage — server-truth 예외, 기획안 명시·재설치 초기화 허용): 마지막 노출 시각·누적 노출·종료·스캔 성공 카운트.
 * 판정은 여기 한 곳(canShow) — 트리거(스캔 2회째·리뷰 등록·주문 완료)는 호출측이 알려 주고 규칙은 모른다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const REVIEW_PROMPT_KEY = 'kbap.reviewPrompt.v1';
/** 노출 간격 7일 · 누적 최대 3회 · 스캔 성공 2회째 */
export const PROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const PROMPT_MAX_SHOWS = 3;
export const SCAN_TRIGGER_AT = 2;

export type PromptTrigger = 'scan' | 'review' | 'order';
export type PromptAnswer = 'positive' | 'negative' | 'later';

export interface PromptState {
  lastShownAt: number | null;
  shows: number;
  done: boolean;
  scanSuccess: number;
  /** 스캔 경로로 이미 띄웠나 — 스캔 트리거는 성공 2회 이상 + 아직 안 띄움(막혀서 못 띄운 회차는 소모 0) */
  scanPrompted: boolean;
}
export const EMPTY_PROMPT_STATE: PromptState = { lastShownAt: null, shows: 0, done: false, scanSuccess: 0, scanPrompted: false };

/** 뜰 수 있나 — 종료 아님 · 누적 3회 미만 · 마지막 노출로부터 7일 이상(첫 노출은 즉시) */
export function canShow(s: PromptState, now: number): boolean {
  if (s.done || s.shows >= PROMPT_MAX_SHOWS) return false;
  return s.lastShownAt == null || now - s.lastShownAt >= PROMPT_INTERVAL_MS;
}
/** 실제로 보인 뒤(onShow) 소모 — 스캔 경로면 scanPrompted도 */
export const markShown = (s: PromptState, now: number, trigger?: PromptTrigger): PromptState => ({ ...s, shows: s.shows + 1, lastShownAt: now, scanPrompted: s.scanPrompted || trigger === 'scan' });
export const markDone = (s: PromptState): PromptState => ({ ...s, done: true });
/** 스캔 트리거 = 성공 2회 이상이고 스캔 경로로 아직 안 띄움(2회째가 막혔으면 3회째에) */
export const scanTriggerDue = (s: PromptState): boolean => s.scanSuccess >= SCAN_TRIGGER_AT && !s.scanPrompted;
/** 시계 되돌림(lastShownAt이 미래) — 간격 기준점을 지금으로 재설정 */
export const fixClockRewind = (s: PromptState, now: number): PromptState => (s.lastShownAt != null && now - s.lastShownAt < 0 ? { ...s, lastShownAt: now } : s);

export async function loadPromptState(): Promise<PromptState> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_PROMPT_KEY);
    if (!raw) return EMPTY_PROMPT_STATE;
    const v = JSON.parse(raw) as Partial<PromptState>;
    return {
      lastShownAt: typeof v.lastShownAt === 'number' ? v.lastShownAt : null,
      shows: typeof v.shows === 'number' ? v.shows : 0,
      done: v.done === true,
      scanSuccess: typeof v.scanSuccess === 'number' ? v.scanSuccess : 0,
      scanPrompted: v.scanPrompted === true,
    };
  } catch {
    return EMPTY_PROMPT_STATE; // 깨진 값·스토리지 불능 = 처음처럼(유도 시트는 안전 기능이 아님)
  }
}
export async function savePromptState(s: PromptState): Promise<void> {
  await AsyncStorage.setItem(REVIEW_PROMPT_KEY, JSON.stringify(s)).catch(() => {});
}
/** 스캔 성공 1회 기록 → 누적 성공 수 */
export async function recordScanSuccess(): Promise<number> {
  const s = await loadPromptState();
  const next = { ...s, scanSuccess: s.scanSuccess + 1 };
  await savePromptState(next);
  return next.scanSuccess;
}
/** dev 전용 — QA 반복 확인용 초기화(/states). 운영은 호출 경로 0 */
export async function resetPromptStateForDev(): Promise<void> {
  await AsyncStorage.removeItem(REVIEW_PROMPT_KEY).catch(() => {});
}
