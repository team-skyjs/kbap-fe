/**
 * onboarding/draft.ts — mid-flow persistence (KB-110). The setup steps collect
 * LOCALLY (no per-step API calls); if the user bails mid-flow the draft holds
 * their position + inputs so re-entry can resume from the saved step. Cleared
 * on successful batch submit.
 *
 * Skip semantics: restrictions/spice are skippable (FR-003/004) — a skip is an
 * EXPLICIT `null` (미설정), distinct from "picked nothing" (empty array / a
 * chosen level). The submit payload keeps that distinction.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kbap.onboardingDraft.v1';

/** Steps a draft can resume at (post-consent — consent is the signup moment).
 *  P-080(KB-261): riskdemo·summary 추가 — 구스텝('interests' 등) draft는 사용처의
 *  ORDER 클램프가 흡수한다. */
export type DraftStep = 'profile' | 'riskdemo' | 'restrictions' | 'spice' | 'interests' | 'summary';

export interface OnboardingDraft {
  consented: boolean; // signup-time consent already given
  step: DraftStep; // resume point
  nickname: string;
  nationality: string; // ISO 3166-1 alpha-2
  language: string; // reader language (one of the 9)
  restrictions: string[] | null; // null = skipped (미설정)
  spice: number | null; // null = skipped (미설정)
  /** 업로드된 프로필 사진 path(objectKey) (KB-149/P-006). 옵셔널 — 구버전 draft 호환. */
  profileImageUrl?: string | null;
  updatedAt: string; // ISO — freshness/debug
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingDraft) : null;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(draft: OnboardingDraft): void {
  // fire-and-forget — a lost write only costs a slightly stale resume point.
  void AsyncStorage.setItem(KEY, JSON.stringify(draft)).catch(() => {});
}

export async function clearOnboardingDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
