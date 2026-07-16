/**
 * onboarding/submit.ts — the ONE-SHOT batch submit at the end of setup
 * (KB-110 구조 · KB-75 실연결 2026-07-13).
 *
 *   POST /members/me/onboarding { nickname, avoidanceSubstanceCodes,
 *                                 countryCode, appLanguage,
 *                                 spicinessPreference? }   (spice만 optional)
 *
 * - 스킵 = 빈 배열 (계약 확정): FE 내부의 UNSET 구분은 draft/화면까지만,
 *   와이어에서는 []로 나간다.
 * - 맵기(spice): KB-150 후속으로 서버 전송(2026-07-15 배포). 스킵이면 필드
 *   생략. 로컬(AsyncStorage) 보관은 마이그레이션 fallback으로 유지.
 * - 재제출 거부(이미 완료된 계정): 에러로 죽이지 않고 완료로 간주하고
 *   통과시킨다 — 어느 쪽이든 사용자는 홈으로 가야 한다.
 * - BE 세션이 없으면(웹/미로그인 개발 경로) 로그만 남기고 성공 처리.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from '@/lib/api/client';
import { hasBeSession } from '@/lib/auth/beAuth';
import { toBeCode } from '@/lib/mocks/ingredients';

export const UNSET = 'UNSET' as const;
export type Unset = typeof UNSET;

export interface OnboardingProfilePayload {
  nickname: string;
  nationality: string; // ISO 3166-1 alpha-2
  language: string; // reader language (BCP-47, one of the 9)
  avoidIngredients: string[] | Unset; // 81종 codes, or skipped
  spiceTolerance: number | Unset; // 0..10, or skipped — 로컬 보관 전용
  /** 업로드된 프로필 사진 publicUrl (KB-149). null/생략 = 미선택 → 필드 생략. */
  profileImageUrl?: string | null;
}

const SPICE_KEY = 'kbap.profile.spice.v1';

export async function submitOnboardingProfile(payload: OnboardingProfilePayload): Promise<void> {
  // 맵기는 계약 밖 — 로컬 보관 (스킵이면 저장하지 않음)
  if (payload.spiceTolerance !== UNSET) {
    await AsyncStorage.setItem(SPICE_KEY, String(payload.spiceTolerance)).catch(() => {});
  }

  const body = {
    nickname: payload.nickname,
    // KB-150 확정(7/16): 미설정 = -1 센티널. 온보딩 스킵은 필드 생략 유지 —
    // 계약상 optional이고 BE 정책이 "미설정 유저 = -1 저장"이라 생략 = 미설정으로
    // 수렴한다 (다르게 저장되는 게 실측되면 -1 명시 전송으로 전환). 진행로그 기록.
    // 로컬 보관(위)은 구서버 대비 fallback으로 유지 (adaptSpice 참조).
    ...(payload.spiceTolerance !== UNSET ? { spicinessPreference: payload.spiceTolerance } : {}),
    // KB-149: 사진은 선택 사항 — 미선택은 필드 생략 (optional 확인)
    ...(payload.profileImageUrl ? { profileImageUrl: payload.profileImageUrl } : {}),
    // 와이어 경계: BE 표준 코드로 변환 — 서버가 모르는 코드(레거시 잔재)는
    // 드롭+로그 (400 '지원하지 않는 기피 성분 코드' 방지, KB-75 버그)
    avoidanceSubstanceCodes:
      payload.avoidIngredients === UNSET
        ? []
        : payload.avoidIngredients.flatMap((c) => {
            const be = toBeCode(c);
            if (!be) console.log('[onboarding] dropping unmapped ingredient code:', c);
            return be ? [be] : [];
          }),
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
    // ⚠️ 400은 "입력 검증 실패"와 "이미 온보딩 완료"를 겸용한다(계약 확인,
    // 구분 코드 없음). 4xx를 전부 완료로 간주하면 검증 실패인데 프로필
    // 미저장 상태로 홈에 들어가는 false-safe 경로가 생긴다 → 서버 플래그
    // (onboardingCompleted)로 판별해 true일 때만 완료 간주, 아니면 표면화.
    if (e instanceof ApiError && e.status != null && e.status >= 400 && e.status < 500) {
      const completed = await api
        .get<{ onboardingCompleted?: boolean }>('/members/me/profile')
        .then((p) => p.onboardingCompleted === true)
        .catch(() => false); // 판별 실패 = 완료 확신 불가 → 에러 표면화
      if (completed) {
        console.log('[onboarding] submit rejected but already completed — continuing:', e.message);
        return;
      }
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
