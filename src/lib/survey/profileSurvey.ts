/**
 * profileSurvey (KB-729) — 가입 회원 1회 프로필 설문의 **순수 규칙**: 문항·코드값(서버 enum 그대로 — dev Swagger
 * `PUT /api/members/me/survey`, Jackson 대소문자 구분이라 소문자는 400)·분기(tripTiming은 TRIP_PLANNED만,
 * tripDuration은 TRIP_PLANNED·TRAVELING_NOW)·페이지 완료 판정·와이어 변환·Amplitude user property.
 * 트리거는 서버가 정본(`User.surveyCompleted`) — 로컬 플래그로 판별하지 않는다(헌법·P-147).
 */
import type { User } from '@/lib/api/types';

export const AGE_BANDS = ['TEENS', 'TWENTIES', 'THIRTIES', 'FORTIES', 'FIFTIES_PLUS'] as const;
export const GENDERS = ['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'] as const;
export const ACQUISITIONS = ['STORE_SEARCH', 'SNS_AD', 'FRIEND', 'BLOG_VIDEO', 'OTHER'] as const;
export const SITUATIONS = ['TRAVELING_NOW', 'TRIP_PLANNED', 'LIVING_IN_KOREA', 'INTERESTED_NO_PLAN'] as const;
export const TRIP_TIMINGS = ['DATE_FIXED', 'THIS_YEAR', 'SOMEDAY'] as const;
export const TRIP_DURATIONS = ['UP_TO_3_DAYS', 'ONE_WEEK', 'TWO_WEEKS', 'MONTH_PLUS'] as const;
export const PURPOSES = ['MENU_READING', 'ALLERGY_AVOIDANCE', 'EXPLORE_FOOD', 'OTHER'] as const;
export const FOOD_AFFINITIES = [1, 2, 3, 4, 5] as const;

export type AgeBand = (typeof AGE_BANDS)[number];
export type Gender = (typeof GENDERS)[number];
export type Acquisition = (typeof ACQUISITIONS)[number];
export type Situation = (typeof SITUATIONS)[number];
export type TripTiming = (typeof TRIP_TIMINGS)[number];
export type TripDuration = (typeof TRIP_DURATIONS)[number];
export type Purpose = (typeof PURPOSES)[number];
export type FoodAffinity = (typeof FOOD_AFFINITIES)[number];

/** 화면 상태 — 미응답 = null */
export interface SurveyAnswers {
  ageBand: AgeBand | null;
  gender: Gender | null;
  acquisition: Acquisition | null;
  situation: Situation | null;
  tripTiming: TripTiming | null;
  tripDuration: TripDuration | null;
  purpose: Purpose | null;
  foodAffinity: FoodAffinity | null;
}
export const EMPTY_ANSWERS: SurveyAnswers = { ageBand: null, gender: null, acquisition: null, situation: null, tripTiming: null, tripDuration: null, purpose: null, foodAffinity: null };

export type SurveyField = keyof SurveyAnswers;

/** 서버 요청 본문(계약 그대로) — 묻지 않는 분기는 null */
export interface MemberSurveyWire {
  ageBand: AgeBand;
  gender: Gender;
  acquisition: Acquisition;
  situation: Situation;
  tripTiming: TripTiming | null;
  tripDuration: TripDuration | null;
  purpose: Purpose;
  foodAffinity: number;
}
/** 응답 = 저장 본문(서버가 분기를 null로 정규화) + 버전·시각(표시 안 함) */
export interface MemberSurveyResponseWire extends MemberSurveyWire {
  surveyVersion?: number;
  answeredAt?: string;
}

export const needsTripTiming = (situation: Situation | null): boolean => situation === 'TRIP_PLANNED';
export const needsTripDuration = (situation: Situation | null): boolean => situation === 'TRIP_PLANNED' || situation === 'TRAVELING_NOW';

/** 상황이 바뀌면 묻지 않는 분기 답을 비운다 — 서버도 null로 정규화하지만 앱도 같은 값을 보내 응답으로 다시 그릴 때 일관 */
export function normalizeAnswers(a: SurveyAnswers): SurveyAnswers {
  return {
    ...a,
    tripTiming: needsTripTiming(a.situation) ? a.tripTiming : null,
    tripDuration: needsTripDuration(a.situation) ? a.tripDuration : null,
  };
}

/** 페이지 구성 — 시트 안 3페이지, 한 페이지 2~3문항(발주 (2)). 분기 문항은 상황에 따라 2페이지에 붙는다 */
export const PAGES: readonly (readonly SurveyField[])[] = [
  ['ageBand', 'gender', 'acquisition'],
  ['situation', 'tripTiming', 'tripDuration'],
  ['purpose', 'foodAffinity'],
];

/** 이 답 상태에서 실제로 묻는 문항(분기 반영) */
export function visibleFields(page: number, a: SurveyAnswers): SurveyField[] {
  return (PAGES[page] ?? []).filter((f) => {
    if (f === 'tripTiming') return needsTripTiming(a.situation);
    if (f === 'tripDuration') return needsTripDuration(a.situation);
    return true;
  });
}

/** 전부 필수 — 보이는 문항이 모두 답해져야 다음/제출 활성 */
export function isPageComplete(page: number, a: SurveyAnswers): boolean {
  return visibleFields(page, a).every((f) => a[f] != null);
}

export function isComplete(a: SurveyAnswers): boolean {
  return PAGES.every((_, i) => isPageComplete(i, a));
}

/** 완성된 답 → 요청 본문. 미완성이면 null(제출 버튼이 막지만 이중 방어) */
export function toWire(a: SurveyAnswers): MemberSurveyWire | null {
  const n = normalizeAnswers(a);
  if (!isComplete(n)) return null;
  return {
    ageBand: n.ageBand!,
    gender: n.gender!,
    acquisition: n.acquisition!,
    situation: n.situation!,
    tripTiming: n.tripTiming,
    tripDuration: n.tripDuration,
    purpose: n.purpose!,
    foodAffinity: Math.trunc(n.foodAffinity!), // 서버는 정수 1~5만(4.7은 4로 잘림) — 화면은 정수만 주지만 계약 고정
  };
}

/** Amplitude user property — 서버가 돌려준(정규화된) 값 기준. 분기 미해당(null)은 키 자체를 보내지 않는다 */
export function surveyUserProps(w: MemberSurveyWire): Record<string, string | number> {
  const out: Record<string, string | number> = {
    survey_age_band: w.ageBand,
    survey_gender: w.gender,
    survey_acquisition: w.acquisition,
    survey_situation: w.situation,
    survey_purpose: w.purpose,
    survey_food_affinity: w.foodAffinity,
  };
  if (w.tripTiming) out.survey_trip_timing = w.tripTiming;
  if (w.tripDuration) out.survey_trip_duration = w.tripDuration;
  return out;
}

/** 트리거 — 서버가 아는 사실만: 로그인 회원이고 surveyCompleted === false. 게스트(mock: 필드 없음)·구서버(null) = 안 띄움.
 *  온보딩 미완(onboardingCompleted === false)은 재개 배너가 먼저다(탭 레이아웃) — 그 위에 닫기 불가 시트를 겹치지 않는다. */
export function shouldShowSurvey(me: Pick<User, 'surveyCompleted' | 'onboardingCompleted'> | null | undefined): boolean {
  if (!me) return false;
  if (me.surveyCompleted !== false) return false;
  if (me.onboardingCompleted === false) return false;
  return true;
}
