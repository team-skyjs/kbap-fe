/**
 * onboarding/submit.ts — the ONE-SHOT batch submit at the end of setup
 * (KB-110 구조 · KB-75 실연결 2026-07-13).
 *
 *   POST /members/me/onboarding { nickname, avoidanceSubstanceCodes,
 *                                 countryCode, appLanguage }   (전부 필수)
 *
 * - 스킵 = 빈 배열 (계약 확정): FE 내부의 UNSET 구분은 draft/화면까지만,
 *   와이어에서는 []로 나간다.
 * - ⚠️ 맵기(spice)는 계약에 필드가 없어 서버로 보내지 않는다 — 로컬
 *   (AsyncStorage)에 보관해 상세 화면의 spicyForYou 판정에 계속 쓴다.
 *   BE 질의 대기 (relink-progress.md).
 * - 재제출 거부(이미 완료된 계정): 에러로 죽이지 않고 완료로 간주하고
 *   통과시킨다 — 어느 쪽이든 사용자는 홈으로 가야 한다.
 * - BE 세션이 없으면(웹/미로그인 개발 경로) 로그만 남기고 성공 처리.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from '@/lib/api/client';
import { hasBeSession } from '@/lib/auth/beAuth';

export const UNSET = 'UNSET' as const;
export type Unset = typeof UNSET;

export interface OnboardingProfilePayload {
  nickname: string;
  nationality: string; // ISO 3166-1 alpha-2
  language: string; // reader language (BCP-47, one of the 9)
  avoidIngredients: string[] | Unset; // 81종 codes, or skipped
  spiceTolerance: number | Unset; // 0..10, or skipped — 로컬 보관 전용
}

const SPICE_KEY = 'kbap.profile.spice.v1';

export async function submitOnboardingProfile(payload: OnboardingProfilePayload): Promise<void> {
  // 맵기는 계약 밖 — 로컬 보관 (스킵이면 저장하지 않음)
  if (payload.spiceTolerance !== UNSET) {
    await AsyncStorage.setItem(SPICE_KEY, String(payload.spiceTolerance)).catch(() => {});
  }

  const body = {
    nickname: payload.nickname,
    avoidanceSubstanceCodes: payload.avoidIngredients === UNSET ? [] : payload.avoidIngredients,
    countryCode: payload.nationality,
    appLanguage: payload.language,
  };

  if (!(await hasBeSession())) {
    // 웹/미로그인 개발 경로 — 실호출 없이 통과 (실기기 플로우는 로그인 선행)
    console.log('[onboarding] no BE session — submit skipped (dev)', body);
    return;
  }

  try {
    await api.post('/members/me/onboarding', body);
    console.log('[onboarding] batch submit ok');
  } catch (e) {
    // 재제출 거부(이미 완료) → 완료로 간주. 그 외(네트워크/5xx)는 그대로 표면화.
    if (e instanceof ApiError && e.status != null && e.status >= 400 && e.status < 500) {
      console.log('[onboarding] submit rejected (already completed?) — continuing:', e.message);
      return;
    }
    throw e;
  }
}

/** 로컬 보관된 맵기 허용도 (계약에 필드 생기면 서버로 이관 — KB-75 질의). */
export async function loadLocalSpice(): Promise<number | null> {
  try {
    const v = await AsyncStorage.getItem(SPICE_KEY);
    return v != null ? Number(v) : null;
  } catch {
    return null;
  }
}
