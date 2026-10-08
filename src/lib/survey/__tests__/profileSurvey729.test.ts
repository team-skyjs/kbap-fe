/**
 * KB-729 프로필 설문 — 순수 규칙·어댑터·트리거·10로케일 키.
 * 분기(tripTiming=TRIP_PLANNED만 · tripDuration=TRIP_PLANNED·TRAVELING_NOW) · 전부 필수 · 와이어 = 대문자 enum 그대로 + 정수 ·
 * user property는 분기 미해당 키 제외 · 트리거 4분기(false/true/게스트/구서버) · 온보딩 미완 = 재개 배너 우선.
 */
import {
  EMPTY_ANSWERS, isComplete, isPageComplete, normalizeAnswers, PAGES, shouldShowSurvey, surveyUserProps, toWire, visibleFields,
  AGE_BANDS, GENDERS, ACQUISITIONS, SITUATIONS, TRIP_TIMINGS, TRIP_DURATIONS, PURPOSES, FOOD_AFFINITIES, type SurveyAnswers,
} from '@/lib/survey/profileSurvey';
import { adaptProfile, type MyProfileWire } from '@/lib/api/memberAdapter';
import { sanitizeUserProps } from '@/lib/analytics';

jest.mock('@/lib/sentry', () => ({ reportProfileContractDrift: jest.fn() }));

const full: SurveyAnswers = { ageBand: 'TWENTIES', gender: 'FEMALE', acquisition: 'SNS_AD', situation: 'TRIP_PLANNED', tripTiming: 'THIS_YEAR', tripDuration: 'ONE_WEEK', purpose: 'MENU_READING', foodAffinity: 4 };

describe('분기·필수', () => {
  it('TRIP_PLANNED = 시기+기간 · TRAVELING_NOW = 기간만 · LIVING/INTERESTED = 둘 다 없음', () => {
    expect(visibleFields(1, { ...EMPTY_ANSWERS, situation: 'TRIP_PLANNED' })).toEqual(['situation', 'tripTiming', 'tripDuration']);
    expect(visibleFields(1, { ...EMPTY_ANSWERS, situation: 'TRAVELING_NOW' })).toEqual(['situation', 'tripDuration']);
    expect(visibleFields(1, { ...EMPTY_ANSWERS, situation: 'LIVING_IN_KOREA' })).toEqual(['situation']);
    expect(visibleFields(1, { ...EMPTY_ANSWERS, situation: 'INTERESTED_NO_PLAN' })).toEqual(['situation']);
    expect(visibleFields(1, EMPTY_ANSWERS)).toEqual(['situation']); // 미응답 = 분기 숨김
  });

  it('상황이 바뀌면 묻지 않는 분기 답은 비운다(서버 정규화와 같은 값) · 묻는 분기는 유지', () => {
    expect(normalizeAnswers({ ...full, situation: 'LIVING_IN_KOREA' })).toMatchObject({ tripTiming: null, tripDuration: null });
    expect(normalizeAnswers({ ...full, situation: 'TRAVELING_NOW' })).toMatchObject({ tripTiming: null, tripDuration: 'ONE_WEEK' });
    expect(normalizeAnswers(full)).toEqual(full);
  });

  it('페이지 완료 = 보이는 문항 전부 응답(전부 필수, 건너뛰기 없음)', () => {
    expect(isPageComplete(0, EMPTY_ANSWERS)).toBe(false);
    expect(isPageComplete(0, { ...EMPTY_ANSWERS, ageBand: 'TEENS', gender: 'MALE' })).toBe(false);
    expect(isPageComplete(0, { ...EMPTY_ANSWERS, ageBand: 'TEENS', gender: 'MALE', acquisition: 'FRIEND' })).toBe(true);
    expect(isPageComplete(1, { ...EMPTY_ANSWERS, situation: 'TRIP_PLANNED' })).toBe(false);
    expect(isPageComplete(1, { ...EMPTY_ANSWERS, situation: 'TRIP_PLANNED', tripTiming: 'SOMEDAY' })).toBe(false);
    expect(isPageComplete(1, { ...EMPTY_ANSWERS, situation: 'TRIP_PLANNED', tripTiming: 'SOMEDAY', tripDuration: 'MONTH_PLUS' })).toBe(true);
    expect(isPageComplete(1, { ...EMPTY_ANSWERS, situation: 'INTERESTED_NO_PLAN' })).toBe(true);
    expect(isPageComplete(2, { ...EMPTY_ANSWERS, purpose: 'OTHER' })).toBe(false);
    expect(isPageComplete(2, { ...EMPTY_ANSWERS, purpose: 'OTHER', foodAffinity: 1 })).toBe(true);
    expect(PAGES).toHaveLength(3);
    expect(isComplete(full)).toBe(true);
    expect(isComplete({ ...full, purpose: null })).toBe(false);
  });
});

describe('와이어(계약 코드값)', () => {
  it('요청 body = Swagger enum 대문자 그대로 + 정수 foodAffinity + 묻지 않는 분기 null', () => {
    expect(toWire(full)).toEqual({ ageBand: 'TWENTIES', gender: 'FEMALE', acquisition: 'SNS_AD', situation: 'TRIP_PLANNED', tripTiming: 'THIS_YEAR', tripDuration: 'ONE_WEEK', purpose: 'MENU_READING', foodAffinity: 4 });
    expect(toWire({ ...full, situation: 'TRAVELING_NOW' })).toMatchObject({ tripTiming: null, tripDuration: 'ONE_WEEK' });
    expect(toWire({ ...full, situation: 'LIVING_IN_KOREA' })).toMatchObject({ tripTiming: null, tripDuration: null });
    expect(toWire({ ...full, ageBand: null })).toBeNull(); // 미완성 = 전송 안 함
    expect(toWire({ ...full, foodAffinity: 4.7 as unknown as 4 })!.foodAffinity).toBe(4); // 서버는 정수만
  });

  it('코드 상수 = Swagger enum 전수·대문자(소문자는 400)', () => {
    for (const list of [AGE_BANDS, GENDERS, ACQUISITIONS, SITUATIONS, TRIP_TIMINGS, TRIP_DURATIONS, PURPOSES]) {
      for (const c of list) expect(c).toBe(c.toUpperCase());
    }
    expect(AGE_BANDS).toEqual(['TEENS', 'TWENTIES', 'THIRTIES', 'FORTIES', 'FIFTIES_PLUS']);
    expect(GENDERS).toEqual(['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED']);
    expect(ACQUISITIONS).toEqual(['STORE_SEARCH', 'SNS_AD', 'FRIEND', 'BLOG_VIDEO', 'OTHER']);
    expect(SITUATIONS).toEqual(['TRAVELING_NOW', 'TRIP_PLANNED', 'LIVING_IN_KOREA', 'INTERESTED_NO_PLAN']);
    expect(TRIP_TIMINGS).toEqual(['DATE_FIXED', 'THIS_YEAR', 'SOMEDAY']);
    expect(TRIP_DURATIONS).toEqual(['UP_TO_3_DAYS', 'ONE_WEEK', 'TWO_WEEKS', 'MONTH_PLUS']);
    expect(PURPOSES).toEqual(['MENU_READING', 'ALLERGY_AVOIDANCE', 'EXPLORE_FOOD', 'OTHER']);
    expect(FOOD_AFFINITIES).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Amplitude user property', () => {
  it('8키 전부(TRIP_PLANNED) · 분기 미해당은 키 자체 없음 · sanitize 허용 목록 통과', () => {
    const all = surveyUserProps(toWire(full)!);
    expect(Object.keys(all).sort()).toEqual(['survey_acquisition', 'survey_age_band', 'survey_food_affinity', 'survey_gender', 'survey_purpose', 'survey_situation', 'survey_trip_duration', 'survey_trip_timing']);
    expect(all).toMatchObject({ survey_age_band: 'TWENTIES', survey_food_affinity: 4, survey_trip_timing: 'THIS_YEAR' });
    const living = surveyUserProps(toWire({ ...full, situation: 'LIVING_IN_KOREA' })!);
    expect(living).not.toHaveProperty('survey_trip_timing');
    expect(living).not.toHaveProperty('survey_trip_duration');
    expect(Object.keys(sanitizeUserProps(all as never)).sort()).toEqual(Object.keys(all).sort()); // 허용 목록에 전부 있다
  });
});

describe('트리거(서버 정본) + 어댑터', () => {
  const wire: MyProfileWire = { memberId: 1, nickname: 'Y', avoidanceSubstanceCodes: [], countryCode: 'KR', appLanguage: 'en', spicinessPreference: -1, onboardingCompleted: true, ranking: { tier: 'bronze', level: 1, score: 0 } };

  it('adaptProfile: false/true 그대로 · 필드 부재(구서버) = null', () => {
    expect(adaptProfile({ ...wire, surveyCompleted: false }, null).surveyCompleted).toBe(false);
    expect(adaptProfile({ ...wire, surveyCompleted: true }, null).surveyCompleted).toBe(true);
    expect(adaptProfile(wire, null).surveyCompleted).toBeNull();
  });

  it('shouldShowSurvey: false=띄움 · true=안 띄움 · 게스트(필드 없음)=안 띄움 · 구서버(null)=안 띄움 · 온보딩 미완=안 띄움(재개 배너 우선)', () => {
    expect(shouldShowSurvey({ surveyCompleted: false, onboardingCompleted: true })).toBe(true);
    expect(shouldShowSurvey({ surveyCompleted: false })).toBe(true); // onboardingCompleted 생략(mock 형태)도 띄움 — false만 제외
    expect(shouldShowSurvey({ surveyCompleted: true, onboardingCompleted: true })).toBe(false);
    expect(shouldShowSurvey({})).toBe(false);
    expect(shouldShowSurvey(undefined)).toBe(false);
    expect(shouldShowSurvey({ surveyCompleted: null })).toBe(false);
    expect(shouldShowSurvey({ surveyCompleted: false, onboardingCompleted: false })).toBe(false);
  });
});

it('i18n: survey.* 키 — 10로케일 전부 en과 같은 키 집합(문항 8·옵션 29·선호 5·버튼 4·안내 3)', () => {
  const locales = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
  const flat = (o: Record<string, unknown>, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));
  const en = flat((require('@/lib/i18n/en.json') as { survey: Record<string, unknown> }).survey).sort();
  expect(en).toHaveLength(8 + 29 + 5 + 4 + 3);
  for (const field of ['ageBand', 'gender', 'acquisition', 'situation', 'tripTiming', 'tripDuration', 'purpose']) expect(en).toContain(`q.${field}`);
  for (const c of SITUATIONS) expect(en).toContain(`opt.situation.${c}`);
  for (const n of FOOD_AFFINITIES) expect(en).toContain(`affinity.${n}`);
  for (const l of locales) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keys = flat((require(`@/lib/i18n/${l}.json`) as { survey: Record<string, unknown> }).survey).sort();
    expect({ l, keys }).toEqual({ l, keys: en });
  }
});
