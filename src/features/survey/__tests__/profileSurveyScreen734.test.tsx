/**
 * KB-734 설문 전체 화면(구 KB-729 시트) — 한 화면 한 문항 · 선택 → SURVEY_ADVANCE.ms 뒤 자동 진행(동작 줄이기 = 즉시) · 재선택은 마지막 답만 ·
 * 전환 직후 SURVEY_SETTLE.ms 안 탭 = 무시(공부 #246 1) · 마지막 문항도 지연 뒤 제출(지연 안 재선택 = 교체, 1회) ·
 * 뒤로(상단·Android 뒤로 가기) = 이전 문항 답 유지, 첫 문항은 무시(닫기 불가) · 분기 끼어듦/상황 전환 시 분기 답 비움 ·
 * 마지막 문항 탭 = 바로 제출(완료 버튼 없음) · 제출 중 선택지 비활성 · 제출 body = 계약 코드값 · 성공 = me 캐시 surveyCompleted=true +
 * user property(분기 제외) + survey_submit · 400 = Sentry + 화면 유지 · 네트워크 실패 = 재시도 + Sentry 0 · 연타 = 1회(useSubmitGuard) ·
 * 큐 done 계약(iOS onDismiss / Android 언마운트).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let mockReduced = false;
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => mockReduced,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
    FadeIn: { duration: () => ({}) },
  };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/lib/i18n/useAppLanguage', () => ({ useAppLanguage: () => 'en' }));
const mockTrack = jest.fn();
const mockSetUserProps = jest.fn();
jest.mock('@/lib/analytics', () => ({
  ...jest.requireActual('@/lib/analytics'),
  track: (...a: unknown[]) => mockTrack(...a),
  setUserProps: (...a: unknown[]) => mockSetUserProps(...a),
}));
const mockReport = jest.fn();
jest.mock('@/lib/sentry', () => ({ reportSurveyContractError: (...a: unknown[]) => mockReport(...a), reportProfileContractDrift: jest.fn() }));
const mockPut = jest.fn();
jest.mock('@/lib/api/client', () => ({
  ...jest.requireActual('@/lib/api/client'),
  api: { put: (...a: unknown[]) => mockPut(...a) },
}));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ProfileSurveyScreen, SURVEY_ADVANCE, SURVEY_SETTLE } from '../ProfileSurveyScreen';
import { ApiError } from '@/lib/api/client';
import { _resetSurveyHiddenForTest, isSurveyHiddenThisRun, isSurveyPresented } from '@/lib/survey/surveySession';
/* eslint-enable import/first */

let qc: QueryClient;
const trees: ReactTestRenderer[] = [];
const render = (open = true, memberId = '1') => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<QueryClientProvider client={qc}><ProfileSurveyScreen open={open} memberId={memberId} /></QueryClientProvider>); });
  trees.push(t);
  return t;
};
const update = (t: ReactTestRenderer, open: boolean, memberId = '1') => act(() => { t.update(<QueryClientProvider client={qc}><ProfileSurveyScreen open={open} memberId={memberId} /></QueryClientProvider>); });
const modalOf = (t: ReactTestRenderer) => t.root.findAll((x) => typeof x.props?.onRequestClose === 'function')[0];
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeAll(() => { SURVEY_ADVANCE.ms = 80; SURVEY_SETTLE.ms = 100; }); // 실제 타이머로 "지연 뒤 전환"을 본다(TanStack 알림도 setTimeout(0) — 가짜 타이머 금지). flush(마이크로태스크 8회)보다 넉넉히
beforeEach(() => {
  jest.clearAllMocks();
  mockReduced = false;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(['me', 'en'], { id: '1', surveyCompleted: false, restrictions: [] });
  qc.setQueryData(['me', 'ja'], { id: '1', surveyCompleted: false, restrictions: [] }); // 다른 언어 키 — 제출 뒤 언어 전환 시 옛 false로 재노출 방지(공부 3)
  qc.setQueryData(['me', 'reviews'], [{ id: 'r1' }]);
  _resetSurveyHiddenForTest();
});
const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** 선택지 탭(전환 대기 없음) */
const tap = async (t: ReactTestRenderer, id: string) => {
  const n = t.root.findAll((x) => x.props?.testID === id && typeof x.props?.onPress === 'function')[0];
  if (!n) throw new Error(`no pressable ${id}`);
  await act(async () => { n.props.onPress(); });
  await flush();
};
/** 선택지 탭 + 자동 진행 완료까지 */
const settle = () => wait(SURVEY_ADVANCE.ms + SURVEY_SETTLE.ms + 40); // 전환 + 전환 직후 무시 창까지
const goBack = async (t: ReactTestRenderer) => { await tap(t, 'header-back'); await wait(SURVEY_SETTLE.ms + 20); }; // 뒤로도 문항 전환 = 무시 창
const pick = async (t: ReactTestRenderer, id: string) => { await tap(t, id); await settle(); };
const has = (t: ReactTestRenderer, id: string) => t.root.findAll((x) => x.props?.testID === id && typeof x.type === 'string').length;
const btn = (t: ReactTestRenderer, id: string) => t.root.findAll((x) => x.props?.testID === id && typeof x.props?.onPress === 'function' && typeof x.type !== 'string')[0];
const question = (t: ReactTestRenderer) => t.root.findAll((x) => typeof x.type === 'string' && /^survey-q-/.test(String(x.props?.testID))).map((x) => String(x.props.testID).slice('survey-q-'.length));
const checked = (t: ReactTestRenderer, id: string) => t.root.findAll((x) => x.props?.testID === id && x.props?.accessibilityState?.checked === true).length > 0;
const fillFirst3 = async (t: ReactTestRenderer) => { await pick(t, 'survey-opt-ageBand-TWENTIES'); await pick(t, 'survey-opt-gender-FEMALE'); await pick(t, 'survey-opt-acquisition-SNS_AD'); };
/** 마지막 문항(foodAffinity) 직전까지 */
const toLast = async (t: ReactTestRenderer, situation = 'TRAVELING_NOW') => {
  await fillFirst3(t);
  await pick(t, `survey-opt-situation-${situation}`);
  if (situation === 'TRIP_PLANNED') await pick(t, 'survey-opt-tripTiming-THIS_YEAR');
  if (situation === 'TRIP_PLANNED' || situation === 'TRAVELING_NOW') await pick(t, 'survey-opt-tripDuration-ONE_WEEK');
  await pick(t, 'survey-opt-purpose-MENU_READING');
  expect(question(t)).toEqual(['foodAffinity']);
};

it('전체 화면 Modal(fullScreen·불투명) · 열림 = survey_view 1회 · 첫 문항: 뒤로 버튼 없음 + Android 뒤로 가기 무시(닫기 불가) · open=false면 계측 0', () => {
  const t = render();
  expect(mockTrack).toHaveBeenCalledWith('survey_view');
  expect(mockTrack).toHaveBeenCalledTimes(1);
  const modal = modalOf(t);
  expect(modal.props.presentationStyle).toBe('fullScreen');
  expect(modal.props.transparent).toBeFalsy();
  expect(question(t)).toEqual(['ageBand']);
  expect(has(t, 'header-back')).toBe(0); // 공용 SubHeader hideBack — 같은 폭 자리표시자
  expect(has(t, 'header-back-slot')).toBe(1);
  expect(t.root.findAll((x) => typeof x.type !== 'string' && x.props?.titleFit === true && x.props?.title === 'survey.title')).toHaveLength(1); // 긴 제목 1줄 축소(/review 6)
  act(() => { modal.props.onRequestClose(); });
  expect(modal.props.visible).toBe(true);
  expect(question(t)).toEqual(['ageBand']);
  expect(has(t, 'survey-next')).toBe(0); expect(has(t, 'survey-submit')).toBe(0); // 다음/완료 버튼 없음
  mockTrack.mockClear();
  render(false);
  expect(mockTrack).not.toHaveBeenCalled();
});

it('자동 진행: 탭 즉시 = 선택 표시만(아직 같은 문항) → SURVEY_ADVANCE.ms 뒤 다음 문항 + 점 이동 · 둘째 문항부터 뒤로 버튼 · 뒤로 = 답 유지', async () => {
  const t = render();
  expect(has(t, 'survey-dot-0-on')).toBe(1);
  await tap(t, 'survey-opt-ageBand-TWENTIES');
  expect(checked(t, 'survey-opt-ageBand-TWENTIES')).toBe(true);
  expect(question(t)).toEqual(['ageBand']); // 지연 전
  await settle();
  expect(question(t)).toEqual(['gender']);
  expect(has(t, 'survey-dot-1-on')).toBe(1);
  expect(has(t, 'survey-dots')).toBe(1);
  expect(has(t, 'header-back')).toBe(1);
  await goBack(t);
  expect(question(t)).toEqual(['ageBand']);
  expect(checked(t, 'survey-opt-ageBand-TWENTIES')).toBe(true); // 답 유지
  expect(has(t, 'survey-dot-0-on')).toBe(1);
});

it('동작 줄이기 = 지연 없이 즉시 다음 문항', async () => {
  mockReduced = true;
  const t = render();
  await tap(t, 'survey-opt-ageBand-THIRTIES');
  expect(question(t)).toEqual(['gender']);
});

it('지연 안에 재선택 = 마지막 답만·전환 1회 · 지연 안에 뒤로 = 대기 중 전환 취소(되돌린 문항이 다시 넘어가지 않는다)', async () => {
  const t = render();
  await tap(t, 'survey-opt-ageBand-TEENS');
  await tap(t, 'survey-opt-ageBand-FORTIES');
  await settle();
  expect(question(t)).toEqual(['gender']); // 두 번 넘어가 acquisition이 되면 안 된다
  await goBack(t);
  expect(checked(t, 'survey-opt-ageBand-FORTIES')).toBe(true);
  expect(checked(t, 'survey-opt-ageBand-TEENS')).toBe(false);
  await pick(t, 'survey-opt-ageBand-FORTIES');
  await tap(t, 'survey-opt-gender-MALE'); // gender 선택 → 지연 중
  await goBack(t); // 지연 안에 뒤로
  await settle();
  expect(question(t)).toEqual(['ageBand']); // 타이머가 살아 있었다면 gender로 되밀렸다
  expect(has(t, 'survey-dot-0-on')).toBe(1);
});

it('Android 뒤로 가기(onRequestClose) = 이전 문항(답 유지) — 닫히지 않는다', async () => {
  const t = render();
  await pick(t, 'survey-opt-ageBand-TWENTIES');
  expect(question(t)).toEqual(['gender']);
  act(() => { modalOf(t).props.onRequestClose(); });
  expect(modalOf(t).props.visible).toBe(true);
  expect(question(t)).toEqual(['ageBand']);
  expect(checked(t, 'survey-opt-ageBand-TWENTIES')).toBe(true);
});

it('분기: TRIP_PLANNED = 상황 뒤 시기→기간(총 8) · 돌아가 상황 전환 = 분기 답 비움 + 다음은 목적(총 6) · 다시 TRIP_PLANNED면 시기 미응답 · TRAVELING_NOW = 기간만(7)', async () => {
  const t = render();
  await fillFirst3(t);
  expect(question(t)).toEqual(['situation']);
  expect(has(t, 'survey-dot-5-on')).toBe(0); expect(has(t, 'survey-dot-3-on')).toBe(1);
  expect(t.root.findAll((x) => typeof x.type === 'string' && /^survey-dot-\d+-(on|off)$/.test(String(x.props?.testID)))).toHaveLength(6);
  await pick(t, 'survey-opt-situation-TRIP_PLANNED');
  expect(question(t)).toEqual(['tripTiming']);
  expect(t.root.findAll((x) => typeof x.type === 'string' && /^survey-dot-\d+-(on|off)$/.test(String(x.props?.testID)))).toHaveLength(8);
  await pick(t, 'survey-opt-tripTiming-THIS_YEAR');
  expect(question(t)).toEqual(['tripDuration']);
  await pick(t, 'survey-opt-tripDuration-ONE_WEEK');
  expect(question(t)).toEqual(['purpose']);
  await goBack(t); await goBack(t); await goBack(t);
  expect(question(t)).toEqual(['situation']);
  await pick(t, 'survey-opt-situation-LIVING_IN_KOREA');
  expect(question(t)).toEqual(['purpose']); // 분기 문항 없음
  expect(t.root.findAll((x) => typeof x.type === 'string' && /^survey-dot-\d+-(on|off)$/.test(String(x.props?.testID)))).toHaveLength(6);
  await goBack(t);
  await pick(t, 'survey-opt-situation-TRIP_PLANNED');
  expect(question(t)).toEqual(['tripTiming']);
  expect(checked(t, 'survey-opt-tripTiming-THIS_YEAR')).toBe(false); // 비워졌다 — 다시 답해야
  await goBack(t);
  await pick(t, 'survey-opt-situation-TRAVELING_NOW');
  expect(question(t)).toEqual(['tripDuration']);
  expect(checked(t, 'survey-opt-tripDuration-ONE_WEEK')).toBe(false);
});

it('마지막 문항(한식 선호) 탭 = 지연 뒤 제출(완료 버튼 없음): PUT /members/me/survey body 계약 그대로(대문자·정수·미해당 분기 null) → me 캐시 surveyCompleted=true + user property 7키(시기 제외) + survey_submit', async () => {
  mockPut.mockImplementation(async (_p: string, body: Record<string, unknown>) => ({ ...body, surveyVersion: 1, answeredAt: '2026-10-08T22:08:45.123456' }));
  const t = render();
  await toLast(t);
  expect(has(t, 'survey-dot-6-on')).toBe(1);
  expect(mockPut).not.toHaveBeenCalled();
  await tap(t, 'survey-opt-foodAffinity-4');
  expect(checked(t, 'survey-opt-foodAffinity-4')).toBe(true);
  expect(mockPut).not.toHaveBeenCalled(); // 지연 전 — 실수 탭 교체 창
  await settle();
  expect(mockPut).toHaveBeenCalledTimes(1);
  expect(mockPut).toHaveBeenCalledWith('/members/me/survey', { ageBand: 'TWENTIES', gender: 'FEMALE', acquisition: 'SNS_AD', situation: 'TRAVELING_NOW', tripTiming: null, tripDuration: 'ONE_WEEK', purpose: 'MENU_READING', foodAffinity: 4 });
  expect(qc.getQueryData<{ surveyCompleted: boolean }>(['me', 'en'])?.surveyCompleted).toBe(true);
  expect(qc.getQueryData<{ surveyCompleted: boolean }>(['me', 'ja'])?.surveyCompleted).toBe(true); // 전 언어 키
  expect(qc.getQueryData(['me', 'reviews'])).toEqual([{ id: 'r1' }]); // 배열 캐시는 무변
  expect(mockSetUserProps).toHaveBeenCalledTimes(1);
  expect(mockSetUserProps).toHaveBeenCalledWith({ survey_age_band: 'TWENTIES', survey_gender: 'FEMALE', survey_acquisition: 'SNS_AD', survey_situation: 'TRAVELING_NOW', survey_trip_duration: 'ONE_WEEK', survey_purpose: 'MENU_READING', survey_food_affinity: 4 });
  expect(mockTrack).toHaveBeenCalledWith('survey_submit');
  expect(mockReport).not.toHaveBeenCalled();
  expect(has(t, 'survey-error')).toBe(0);
});

it('TRIP_PLANNED 제출 = user property 8키(시기·기간 포함) — 서버 응답(정규화된 값) 기준', async () => {
  mockPut.mockImplementation(async (_p: string, body: Record<string, unknown>) => body);
  const t = render();
  await toLast(t, 'TRIP_PLANNED');
  await pick(t, 'survey-opt-foodAffinity-5');
  expect(Object.keys(mockSetUserProps.mock.calls[0][0] as object)).toHaveLength(8);
  expect(mockSetUserProps.mock.calls[0][0]).toMatchObject({ survey_trip_timing: 'THIS_YEAR', survey_trip_duration: 'ONE_WEEK', survey_food_affinity: 5 });
});

it('400(검증 코드) = 코드 결함 → Sentry(status·code) + 화면 유지·재시도 버튼 · 캐시·user property·submit 계측 무변 · "나중에" = 이번 실행만 숨김', async () => {
  mockPut.mockRejectedValue(new ApiError('bad', 400, 'COMMON-001'));
  const t = render();
  await toLast(t);
  await pick(t, 'survey-opt-foodAffinity-4');
  expect(mockReport).toHaveBeenCalledWith(400, 'COMMON-001');
  expect(has(t, 'survey-error')).toBe(1);
  expect(btn(t, 'survey-retry')).toBeTruthy();
  expect(modalOf(t).props.visible).toBe(true);
  expect(question(t)).toEqual(['foodAffinity']); // 선택은 남는다
  expect(checked(t, 'survey-opt-foodAffinity-4')).toBe(true);
  expect(qc.getQueryData<{ surveyCompleted: boolean }>(['me', 'en'])?.surveyCompleted).toBe(false);
  expect(mockSetUserProps).not.toHaveBeenCalled();
  expect(mockTrack).not.toHaveBeenCalledWith('survey_submit');
  // 공부 #244 1: 4xx = "나중에" 노출 → 이번 실행만 숨김(메모리) — 영구 저장 0, 재시작(모듈 리셋)이면 다시 뜬다(surveySession729)
  expect(has(t, 'survey-later')).toBe(1);
  expect(isSurveyHiddenThisRun()).toBe(false);
  await tap(t, 'survey-later');
  expect(isSurveyHiddenThisRun()).toBe(true);
});

it('네트워크 1회 실패 = 재시도만("나중에" 0) · 재시도 버튼 2회째 실패 = "나중에" 노출 · 다른 선택지 탭도 재제출', async () => {
  mockPut.mockRejectedValue(new TypeError('Network request failed'));
  const t = render();
  await toLast(t);
  await pick(t, 'survey-opt-foodAffinity-4');
  expect(has(t, 'survey-error')).toBe(1);
  expect(has(t, 'survey-later')).toBe(0);
  await tap(t, 'survey-retry');
  expect(mockPut).toHaveBeenCalledTimes(2);
  expect(has(t, 'survey-later')).toBe(1);
  expect(mockReport).not.toHaveBeenCalled();
  await pick(t, 'survey-opt-foodAffinity-5'); // 다른 답으로 바꿔 탭 = 지연 뒤 그 답으로 재제출
  expect(mockPut).toHaveBeenCalledTimes(3);
  expect(mockPut.mock.calls[2][1]).toMatchObject({ foodAffinity: 5 });
});

it('화면이 떠 있는 동안 = presented(딥링크 보류) · 닫히면(open=false) 해제', () => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<QueryClientProvider client={qc}><ProfileSurveyScreen open /></QueryClientProvider>); });
  trees.push(t);
  expect(isSurveyPresented()).toBe(true);
  act(() => { t.update(<QueryClientProvider client={qc}><ProfileSurveyScreen open={false} /></QueryClientProvider>); });
  expect(isSurveyPresented()).toBe(false);
});

it('제출 중 = 선택지·뒤로 비활성 + 스피너 · 재시도 연타 = PUT 1회 · 재시도 성공 = 닫힘 조건(캐시 true)', async () => {
  let resolve!: (v: unknown) => void;
  mockPut.mockRejectedValueOnce(new TypeError('Network request failed')).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  const t = render();
  await toLast(t);
  await pick(t, 'survey-opt-foodAffinity-4');
  expect(has(t, 'survey-error')).toBe(1);
  expect(mockReport).not.toHaveBeenCalled();
  expect(mockPut).toHaveBeenCalledTimes(1);
  const retry = btn(t, 'survey-retry');
  await act(async () => { retry.props.onPress(); retry.props.onPress(); }); // 응답 전 연타
  expect(mockPut).toHaveBeenCalledTimes(2);
  expect(btn(t, 'survey-retry').props.busy).toBe(true); // 재시도 중에도 버튼은 자리 유지(안 스피너) — 버튼↔스피너 깜빡임 0
  expect(has(t, 'survey-error')).toBe(0); // 재시도 시작 = 이전 안내 제거
  expect(t.root.findAll((x) => x.props?.testID === 'survey-opt-foodAffinity-3' && typeof x.props?.onPress === 'function')[0].props.disabled).toBe(true);
  expect(t.root.findAll((x) => x.props?.testID === 'header-back' && typeof x.type !== 'string')[0].props.onPress).toBeUndefined(); // 제출 중 뒤로 비활성
  await tap(t, 'survey-opt-foodAffinity-3'); // 비활성 — 재제출 0
  expect(mockPut).toHaveBeenCalledTimes(2);
  await act(async () => { resolve({ ageBand: 'TWENTIES', gender: 'FEMALE', acquisition: 'SNS_AD', situation: 'TRAVELING_NOW', tripTiming: null, tripDuration: 'ONE_WEEK', purpose: 'MENU_READING', foodAffinity: 4 }); });
  await flush();
  expect(qc.getQueryData<{ surveyCompleted: boolean }>(['me', 'en'])?.surveyCompleted).toBe(true);
  expect(has(t, 'survey-error')).toBe(0);
});

it('첫 제출 중(실패 전) = 재시도 버튼 없이 스피너만 · 선택지 비활성', async () => {
  let resolve!: (v: unknown) => void;
  mockPut.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  const t = render();
  await toLast(t);
  await pick(t, 'survey-opt-foodAffinity-2');
  expect(btn(t, 'survey-retry')).toBeUndefined(); // 실패한 적 없음 = 재시도 버튼 없음
  expect(t.root.findAll((x) => x.props?.testID === 'survey-opt-foodAffinity-2' && typeof x.props?.onPress === 'function')[0].props.disabled).toBe(true);
  expect(t.root.findAll((x) => typeof x.type !== 'string' && x.type && (x.type as { name?: string }).name === 'Spinner')).toHaveLength(1);
  await act(async () => { resolve({ ageBand: 'TWENTIES', gender: 'FEMALE', acquisition: 'SNS_AD', situation: 'TRAVELING_NOW', tripTiming: null, tripDuration: 'ONE_WEEK', purpose: 'MENU_READING', foodAffinity: 2 }); });
  await flush();
  expect(qc.getQueryData<{ surveyCompleted: boolean }>(['me', 'en'])?.surveyCompleted).toBe(true);
});

it('400 MEMBER-003(좀비 세션) = 계약 결함 아님 — Sentry 0 · 재시도·나중에 0(세션 만료 경로가 닫는다)', async () => {
  mockPut.mockRejectedValue(new ApiError('gone', 400, 'MEMBER-003'));
  const t = render();
  await toLast(t);
  await pick(t, 'survey-opt-foodAffinity-4');
  expect(mockReport).not.toHaveBeenCalled();
  expect(has(t, 'survey-error')).toBe(0);
  expect(has(t, 'survey-later')).toBe(0);
  expect(has(t, 'survey-retry')).toBe(0);
});

it('라디오 원을 직접 탭해도 선택 · accessibilityRole=radio + accessibilityState.checked · 선호 문항도 라디오 행', async () => {
  const t = render();
  await tap(t, 'survey-radio-ageBand-THIRTIES'); // 행이 아니라 원(Radio Pressable)
  const row = t.root.findAll((x) => x.props?.testID === 'survey-opt-ageBand-THIRTIES' && typeof x.props?.onPress === 'function')[0];
  expect(row.props.accessibilityRole).toBe('radio');
  expect(row.props.accessibilityState).toEqual({ checked: true });
  expect(t.root.findAll((x) => x.props?.testID === 'survey-opt-ageBand-TEENS' && typeof x.props?.onPress === 'function')[0].props.accessibilityState).toEqual({ checked: false });
  await settle();
  expect(question(t)).toEqual(['gender']);
  const t2 = render();
  await toLast(t2);
  expect(has(t2, 'survey-radio-foodAffinity-5')).toBe(1);
});

it('생애주기: 화면 열린 채 세션 경계(open=false) → 다시 열리면 첫 문항·빈 답 · 계정 전환(A→B, open 유지)도 빈 폼 — A의 답을 B로 제출 0', async () => {
  const t = render(true, 'A');
  await pick(t, 'survey-opt-ageBand-TWENTIES');
  expect(question(t)).toEqual(['gender']);
  update(t, false, 'A'); // 세션 경계 = me 캐시 비움 → open=false
  update(t, true, 'B');
  expect(question(t)).toEqual(['ageBand']);
  expect(checked(t, 'survey-opt-ageBand-TWENTIES')).toBe(false); // 비어 있다
  await pick(t, 'survey-opt-ageBand-TWENTIES');
  update(t, true, 'C'); // open 유지한 채 회원 번호만 바뀜(계정 전환)
  expect(question(t)).toEqual(['ageBand']);
  expect(checked(t, 'survey-opt-ageBand-TWENTIES')).toBe(false);
  expect(mockTrack.mock.calls.filter(([e]) => e === 'survey_view')).toHaveLength(3); // 폼 마운트마다 1회
});

it('언마운트 뒤 늦게 오는 자동 진행 타이머 = 무해(상태 갱신 0)', async () => {
  const t = render();
  await tap(t, 'survey-opt-ageBand-TWENTIES');
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    update(t, false);
    await settle();
    expect(errSpy).not.toHaveBeenCalled();
  } finally {
    errSpy.mockRestore();
  }
});

it('성공 뒤 확인 재조회는 현재 언어 키 exact — 접두 매치로 [me, reviews]까지 재조회하지 않는다', async () => {
  mockPut.mockImplementation(async (_p: string, body: Record<string, unknown>) => body);
  const spy = jest.spyOn(qc, 'invalidateQueries');
  const t = render();
  await toLast(t);
  await pick(t, 'survey-opt-foodAffinity-4');
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith({ queryKey: ['me', 'en'], exact: true });
});

it('공부 #246 1: 문항이 바뀐 직후 SURVEY_SETTLE.ms 안의 선택지 탭 = 무시(이전 문항을 향한 재탭·연타가 새 문항을 넘기지 않는다) · 창이 지나면 정상', async () => {
  const t = render();
  await tap(t, 'survey-opt-ageBand-TWENTIES');
  await wait(SURVEY_ADVANCE.ms + 15); // 전환 직후(무시 창 안)
  expect(question(t)).toEqual(['gender']);
  await tap(t, 'survey-opt-gender-FEMALE'); // 같은 줄 연타
  expect(checked(t, 'survey-opt-gender-FEMALE')).toBe(false);
  await settle();
  expect(question(t)).toEqual(['gender']); // 넘어가지 않았다
  await tap(t, 'survey-opt-gender-FEMALE');
  expect(checked(t, 'survey-opt-gender-FEMALE')).toBe(true);
  await settle();
  expect(question(t)).toEqual(['acquisition']);
});

it('공부 #246 1: 뒤로 가기 직후도 같은 무시 창 · 마지막 문항(purpose→foodAffinity) 전환 직후 탭은 제출 0', async () => {
  const t = render();
  await pick(t, 'survey-opt-ageBand-TWENTIES');
  await tap(t, 'header-back');
  await tap(t, 'survey-opt-ageBand-TEENS'); // 뒤로 직후
  expect(checked(t, 'survey-opt-ageBand-TEENS')).toBe(false);
  expect(checked(t, 'survey-opt-ageBand-TWENTIES')).toBe(true);
  await wait(SURVEY_SETTLE.ms + 20);
  await pick(t, 'survey-opt-ageBand-TWENTIES'); await pick(t, 'survey-opt-gender-FEMALE'); await pick(t, 'survey-opt-acquisition-SNS_AD');
  await pick(t, 'survey-opt-situation-LIVING_IN_KOREA');
  await tap(t, 'survey-opt-purpose-MENU_READING');
  await wait(SURVEY_ADVANCE.ms + 15);
  expect(question(t)).toEqual(['foodAffinity']);
  await tap(t, 'survey-opt-foodAffinity-1'); // 전환 직후 같은 줄 — 무시
  await settle();
  expect(mockPut).not.toHaveBeenCalled();
  expect(checked(t, 'survey-opt-foodAffinity-1')).toBe(false);
});

it('마지막 문항: 지연 안에 다시 고르면 교체 — 마지막 답으로 제출 1회 · 지연 안 뒤로 = 제출 취소', async () => {
  mockPut.mockImplementation(async (_p: string, body: Record<string, unknown>) => body);
  const t = render();
  await toLast(t);
  await tap(t, 'survey-opt-foodAffinity-2');
  await tap(t, 'survey-opt-foodAffinity-5');
  await settle();
  expect(mockPut).toHaveBeenCalledTimes(1);
  expect(mockPut.mock.calls[0][1]).toMatchObject({ foodAffinity: 5 });
  mockPut.mockClear();
  qc.setQueryData(['me', 'en'], { id: '1', surveyCompleted: false, restrictions: [] });
  const t2 = render();
  await toLast(t2);
  await tap(t2, 'survey-opt-foodAffinity-3');
  await goBack(t2); // 지연 안 뒤로 = 제출 타이머 취소
  await settle();
  expect(mockPut).not.toHaveBeenCalled();
  expect(question(t2)).toEqual(['purpose']);
});

it('/review 1: 실패 뒤 뒤로 가면 푸터(재시도·안내·나중에) 없음 + 실패 상태 리셋 — 다시 마지막에 오면 깨끗(옛 답 재시도·빈 toWire 재시도 0)', async () => {
  mockPut.mockRejectedValueOnce(new ApiError('bad', 400, 'COMMON-001')).mockImplementation(async (_p: string, body: Record<string, unknown>) => body);
  const t = render();
  await toLast(t);
  await pick(t, 'survey-opt-foodAffinity-4');
  expect(has(t, 'survey-error')).toBe(1); expect(has(t, 'survey-retry')).toBe(1); expect(has(t, 'survey-later')).toBe(1);
  await goBack(t);
  expect(question(t)).toEqual(['purpose']);
  expect(has(t, 'survey-error')).toBe(0); expect(has(t, 'survey-retry')).toBe(0); expect(has(t, 'survey-later')).toBe(0);
  await pick(t, 'survey-opt-purpose-EXPLORE_FOOD');
  expect(question(t)).toEqual(['foodAffinity']);
  expect(has(t, 'survey-retry')).toBe(0); // 리셋 — 한 번 실패했다는 흔적 없음
  expect(has(t, 'survey-later')).toBe(0);
  await pick(t, 'survey-opt-foodAffinity-4');
  expect(mockPut).toHaveBeenCalledTimes(2);
  expect(mockPut.mock.calls[1][1]).toMatchObject({ purpose: 'EXPLORE_FOOD', foodAffinity: 4 });
});

it('/review 2: 하단 슬롯 패딩 = useBottomInset(Android 3버튼 내비 48 바닥) + 16 — 실패 뒤 유일한 출구가 내비바 아래로 못 들어간다', () => {
  const { Platform, StyleSheet } = jest.requireActual<typeof import('react-native')>('react-native');
  const prev = Platform.OS;
  Platform.OS = 'android';
  try {
    const t = render();
    const foot = t.root.findAll((x) => x.props?.testID === 'survey-foot' && typeof x.type === 'string')[0];
    expect(StyleSheet.flatten(foot.props.style).paddingBottom).toBe(48 + 16); // 인셋 0 보고 기기에서도 48
  } finally {
    Platform.OS = prev;
  }
});

it('/review 3: 선택 전후 선택지 라벨 스타일 = 색만 다르다(프레임 불변 — 굵기·크기·줄높이 동일)', async () => {
  const { StyleSheet } = jest.requireActual<typeof import('react-native')>('react-native');
  const t = render();
  await tap(t, 'survey-opt-ageBand-TWENTIES');
  const label = (id: string) => StyleSheet.flatten(t.root.findAll((x) => x.props?.testID === id && typeof x.props?.onPress === 'function')[0].findAllByProps({ numberOfLines: undefined }).filter((n) => typeof n.type !== 'string' && n.props?.style && typeof n.props.children === 'string')[0].props.style) as Record<string, unknown>;
  const on = label('survey-opt-ageBand-TWENTIES');
  const off = label('survey-opt-ageBand-TEENS');
  expect(on.color).not.toBe(off.color);
  const strip = (o: Record<string, unknown>) => { const { color: _c, ...rest } = o; return rest; };
  expect(strip(on)).toEqual(strip(off));
});

it('QA 1: 첫 문항(hideBack) 헤더 = 2문항 헤더와 같은 높이 — 자리표시자가 뒤로 버튼과 같은 38×38 · 제목은 두 문항 모두 렌더', async () => {
  const { StyleSheet } = jest.requireActual<typeof import('react-native')>('react-native');
  const t = render();
  const slot = t.root.findAll((x) => x.props?.testID === 'header-back-slot' && typeof x.type === 'string')[0];
  const slotStyle = StyleSheet.flatten(slot.props.style) as { width: number; height: number };
  expect(JSON.stringify(t.toJSON())).toContain('survey.title');
  await pick(t, 'survey-opt-ageBand-TWENTIES');
  const back = t.root.findAll((x) => x.props?.testID === 'header-back' && typeof x.type === 'string')[0];
  const backStyle = StyleSheet.flatten(back.props.style) as { width: number; height: number };
  expect(backStyle.height).toBeGreaterThan(0);
  expect([slotStyle.width, slotStyle.height]).toEqual([backStyle.width, backStyle.height]); // 행 높이를 주는 자식이 양쪽 다 있다
  expect(JSON.stringify(t.toJSON())).toContain('survey.title');
});

/* ---- KB-733: 큐 스텝 — 완전히 닫힌 뒤 onClosed(iOS = Modal onDismiss · Android = 폼 언마운트) ---- */
const renderClosable = (open: boolean, onClosed: () => void) => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<QueryClientProvider client={qc}><ProfileSurveyScreen open={open} memberId="1" onClosed={onClosed} /></QueryClientProvider>); });
  trees.push(t);
  return t;
};
it('KB-733 iOS: 닫힘 알림은 Modal onDismiss(언마운트 아님) — 열려 있는 동안 0 · onDismiss → 1', () => {
  const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
  const prev = Platform.OS;
  Platform.OS = 'ios';
  try {
    const onClosed = jest.fn();
    const t = renderClosable(true, onClosed);
    expect(onClosed).not.toHaveBeenCalled();
    const modal = modalOf(t);
    expect(typeof modal.props.onDismiss).toBe('function');
    act(() => { t.update(<QueryClientProvider client={qc}><ProfileSurveyScreen open={false} memberId="1" onClosed={onClosed} /></QueryClientProvider>); });
    expect(onClosed).not.toHaveBeenCalled(); // 폼 언마운트로는 안 부른다 — 네이티브 dismiss 완료가 기준(P-267)
    act(() => { modal.props.onDismiss(); });
    expect(onClosed).toHaveBeenCalledTimes(1);
  } finally {
    Platform.OS = prev;
  }
});
it('KB-733 Android: onDismiss 미지원 — open=false로 폼이 언마운트될 때 onClosed 1회 · Modal onDismiss 미배선', () => {
  const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
  const prev = Platform.OS;
  Platform.OS = 'android';
  try {
    const onClosed = jest.fn();
    const t = renderClosable(true, onClosed);
    expect(modalOf(t).props.onDismiss).toBeUndefined();
    expect(onClosed).not.toHaveBeenCalled();
    act(() => { t.update(<QueryClientProvider client={qc}><ProfileSurveyScreen open={false} memberId="1" onClosed={onClosed} /></QueryClientProvider>); });
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(isSurveyPresented()).toBe(false);
  } finally {
    Platform.OS = prev;
  }
});
