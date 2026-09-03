/**
 * onboarding/submit.ts — the ONE-SHOT batch submit at the end of setup
 * (KB-110 구조 · KB-75 실연결 2026-07-13).
 *
 *   POST /members/me/onboarding { nickname, avoidanceSubstanceCodes,
 *                                 countryCode, spicinessPreference,
 *                                 profileImageUrl }   (전 필드 required — 7/20 승격)
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
import { isProdChannel } from '@/lib/flags';
import { generateNickname, pickDefaultAvatarPath } from './autoProfile';
import { PROFILE_IMAGE_DEFAULT_PATH } from '@/lib/api/memberAdapter';
import { hasBeSession } from '@/lib/auth/beAuth';
import { toBeCode } from '@/lib/mocks/ingredients';
import type { SpiceChoice } from '@/lib/spice';
import { parseStoredSpice, spiceChoiceToWire } from '@/lib/api/spiceAdapter';

export const UNSET = 'UNSET' as const;
export type Unset = typeof UNSET;

export interface OnboardingProfilePayload {
  /** P-209: dev(1.1) = 서버 자동 지정이라 미사용 — prod(구 1.0 계약) 폴백만 소비. 생략 시 내부 생성. */
  nickname?: string;
  nationality: string; // ISO 3166-1 alpha-2
  language: string; // reader language (BCP-47, one of the 9)
  avoidIngredients: string[] | Unset; // 81종 codes, or skipped
  spiceTolerance: SpiceChoice; // P-081: enum — 'SKIP' = 온보딩 스킵(구 UNSET 승계)
  /** 업로드된 프로필 사진 path(objectKey) (KB-149/P-006). null/생략 = 미선택 → 필드 생략. */
  profileImageUrl?: string | null;
  /** P-243(BE #179): 프리셋 스텝 선택 식이 카테고리 — dev(1.1)만 전송(prod 구계약 미전송 무해). */
  dietCategories?: string[];
}

/** 맵기 로컬 fallback 키 — useMe·clearMemberLocal과 공유 (중복 정의 금지). */
export const SPICE_KEY = 'kbap.profile.spice.v1';

export async function submitOnboardingProfile(payload: OnboardingProfilePayload): Promise<void> {
  // 맵기 로컬 보관 — enum 문자열 (구서버 대비 fallback, adaptSpice 참조. 스킵은 미저장)
  if (payload.spiceTolerance !== 'SKIP') {
    await AsyncStorage.setItem(SPICE_KEY, payload.spiceTolerance).catch(() => {});
  }

  // P-209(KB-51): 온보딩 1.1 — 닉네임·아바타 = **서버 자동 지정**(한식명_4자리 풀
  // 30종·기본 아바타). dev 계열 = 1.1(nickname·profileImageUrl 미전송), prod 채널 =
  // 구 1.0 계약(전 필드 required — 서버 1.1 배포·분기 해제 발주까지 폴백 유지).
  const legacy = isProdChannel();
  const body = {
    ...(legacy ? { nickname: payload.nickname ?? generateNickname() } : {}),
    // KB-195(P-019): required 승격 — 스킵도 'SKIP' 명시 전송(생략 시 검증 400).
    // KB-389 2차: 전 채널 enum 문자열(prod 구정수 분기 소멸) — 변환은 spiceAdapter 격리.
    spicinessPreference: spiceChoiceToWire(payload.spiceTolerance),
    // KB-149 최종(P-016): 1.0에서만 — 1.1은 서버 지정(전송 자체 정리)
    ...(legacy ? { profileImageUrl: payload.profileImageUrl ?? pickDefaultAvatarPath() ?? PROFILE_IMAGE_DEFAULT_PATH } : {}),
    // P-243(BE #179): 식이 카테고리 — dev(1.1)만(prod 구계약은 필드 미인지·미전송 무해)
    ...(!legacy && payload.dietCategories?.length ? { dietCategories: payload.dietCategories } : {}),
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
  };

  if (!(await hasBeSession())) {
    // 웹/미로그인 개발 경로 — 실호출 없이 통과 (실기기 플로우는 로그인 선행)
    console.log('[onboarding] no BE session — submit skipped (dev)', body);
    return;
  }

  try {
    // P-209: dev = 1.1 헤더 오버라이드(스캔 v2 날짜판과 같은 엔드포인트 한정 문법)
    await api.post('/members/me/onboarding', body, legacy ? undefined : { headers: { 'X-API-Version': '1.1' } });
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

/** 로컬 보관된 맵기 (P-081: enum 문자열 — 구 숫자 문자열은 파서가 마이그레이션). */
export async function loadLocalSpice(): Promise<SpiceChoice | null> {
  try {
    return parseStoredSpice(await AsyncStorage.getItem(SPICE_KEY));
  } catch {
    return null;
  }
}
