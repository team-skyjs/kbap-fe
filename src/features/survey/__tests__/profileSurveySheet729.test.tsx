/**
 * KB-729 설문 시트 — 닫기 불가(뒤로 가기 no-op) · 노출 계측 · 페이지 진행(미응답 = 다음 비활성) · 분기 전환 시 답 비움 ·
 * 제출 body = 계약 코드값 · 성공 = me 캐시 surveyCompleted=true + user property(분기 제외) + survey_submit ·
 * 400 = Sentry + 시트 유지 · 네트워크 실패 = 재시도 + Sentry 0 · 연타 = 1회(useSubmitGuard).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0 },
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
import { ProfileSurveySheet } from '../ProfileSurveySheet';
import { ApiError } from '@/lib/api/client';
import { _resetSurveyHiddenForTest, isSurveyHiddenThisRun, isSurveyPresented } from '@/lib/survey/surveySession';
/* eslint-enable import/first */

let qc: QueryClient;
const trees: ReactTestRenderer[] = [];
const render = (open = true, memberId = '1') => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<QueryClientProvider client={qc}><ProfileSurveySheet open={open} memberId={memberId} /></QueryClientProvider>); });
  trees.push(t);
  return t;
};
const update = (t: ReactTestRenderer, open: boolean, memberId = '1') => act(() => { t.update(<QueryClientProvider client={qc}><ProfileSurveySheet open={open} memberId={memberId} /></QueryClientProvider>); });
const modalOf = (t: ReactTestRenderer) => t.root.findAll((x) => typeof x.props?.onRequestClose === 'function')[0];
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => {
  jest.clearAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(['me', 'en'], { id: '1', surveyCompleted: false, restrictions: [] });
  qc.setQueryData(['me', 'ja'], { id: '1', surveyCompleted: false, restrictions: [] }); // 다른 언어 키 — 제출 뒤 언어 전환 시 옛 false로 시트 재노출 방지(공부 3)
  qc.setQueryData(['me', 'reviews'], [{ id: 'r1' }]);
  _resetSurveyHiddenForTest();
});
const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
const press = async (t: ReactTestRenderer, id: string) => {
  const n = t.root.findAll((x) => x.props?.testID === id && typeof x.props?.onPress === 'function')[0];
  if (!n) throw new Error(`no pressable ${id}`);
  await act(async () => { n.props.onPress(); });
  await flush();
};
const has = (t: ReactTestRenderer, id: string) => t.root.findAll((x) => x.props?.testID === id && typeof x.type === 'string').length;
const btn = (t: ReactTestRenderer, id: string) => t.root.findAll((x) => x.props?.testID === id && typeof x.props?.onPress === 'function' && typeof x.type !== 'string')[0];
const fillPage0 = async (t: ReactTestRenderer) => { await press(t, 'survey-opt-ageBand-TWENTIES'); await press(t, 'survey-opt-gender-FEMALE'); await press(t, 'survey-opt-acquisition-SNS_AD'); };
const toPage2 = async (t: ReactTestRenderer, situation = 'TRAVELING_NOW') => {
  await fillPage0(t); await press(t, 'survey-next');
  await press(t, `survey-opt-situation-${situation}`);
  if (situation === 'TRIP_PLANNED') await press(t, 'survey-opt-tripTiming-THIS_YEAR');
  if (situation === 'TRIP_PLANNED' || situation === 'TRAVELING_NOW') await press(t, 'survey-opt-tripDuration-ONE_WEEK');
  await press(t, 'survey-next');
  await press(t, 'survey-opt-purpose-MENU_READING'); await press(t, 'survey-opt-foodAffinity-4');
};

it('열림 = survey_view 1회 · 뒤로 가기(onRequestClose)·배경은 닫지 않는다(닫기 불가) · open=false면 계측 0', () => {
  const t = render();
  expect(mockTrack).toHaveBeenCalledWith('survey_view');
  expect(mockTrack).toHaveBeenCalledTimes(1);
  const modal = modalOf(t);
  act(() => { modal.props.onRequestClose(); });
  expect(modal.props.visible).toBe(true);
  expect(t.root.findAll((x) => x.props?.testID === 'sheet-shell-backdrop' && typeof x.type === 'string')[0].props.onPress).toBeUndefined(); // SheetShell dismissable=false
  mockTrack.mockClear();
  render(false);
  expect(mockTrack).not.toHaveBeenCalled();
});

it('페이지 0: 3문항 전부 답해야 다음 활성 · 다음 = 점 이동 + 이전 버튼', async () => {
  const t = render();
  expect(has(t, 'survey-dot-0-on')).toBe(1);
  expect(btn(t, 'survey-next').props.variant).toBe('off');
  await press(t, 'survey-opt-ageBand-TWENTIES'); await press(t, 'survey-opt-gender-FEMALE');
  expect(btn(t, 'survey-next').props.variant).toBe('off');
  await press(t, 'survey-opt-acquisition-SNS_AD');
  expect(btn(t, 'survey-next').props.variant).toBe('primary');
  expect(has(t, 'survey-back')).toBe(0);
  await press(t, 'survey-next');
  expect(has(t, 'survey-dot-1-on')).toBe(1);
  expect(has(t, 'survey-q-situation')).toBe(1);
  expect(has(t, 'survey-q-tripTiming')).toBe(0); // 상황 미응답 = 분기 숨김
  await press(t, 'survey-back');
  expect(has(t, 'survey-dot-0-on')).toBe(1);
  expect(btn(t, 'survey-next').props.variant).toBe('primary'); // 답 유지
});

it('페이지 1 분기: TRIP_PLANNED = 시기+기간 · 상황 전환 = 분기 답 비움(돌아와도 미응답) · TRAVELING_NOW = 기간만', async () => {
  const t = render();
  await fillPage0(t); await press(t, 'survey-next');
  await press(t, 'survey-opt-situation-TRIP_PLANNED');
  expect(has(t, 'survey-q-tripTiming')).toBe(1); expect(has(t, 'survey-q-tripDuration')).toBe(1);
  expect(btn(t, 'survey-next').props.variant).toBe('off');
  await press(t, 'survey-opt-tripTiming-THIS_YEAR'); await press(t, 'survey-opt-tripDuration-ONE_WEEK');
  expect(btn(t, 'survey-next').props.variant).toBe('primary');
  await press(t, 'survey-opt-situation-LIVING_IN_KOREA');
  expect(has(t, 'survey-q-tripTiming')).toBe(0); expect(has(t, 'survey-q-tripDuration')).toBe(0);
  expect(btn(t, 'survey-next').props.variant).toBe('primary');
  await press(t, 'survey-opt-situation-TRIP_PLANNED');
  expect(btn(t, 'survey-next').props.variant).toBe('off'); // 비워졌다 — 다시 답해야
  expect(t.root.findAll((x) => x.props?.testID === 'survey-opt-tripTiming-THIS_YEAR' && x.props?.accessibilityState?.selected === true)).toHaveLength(0);
  await press(t, 'survey-opt-situation-TRAVELING_NOW');
  expect(has(t, 'survey-q-tripTiming')).toBe(0); expect(has(t, 'survey-q-tripDuration')).toBe(1);
});

it('제출 = PUT /members/me/survey body 계약 그대로(대문자·정수·미해당 분기 null) → me 캐시 surveyCompleted=true + user property 7키(시기 제외) + survey_submit', async () => {
  mockPut.mockImplementation(async (_p: string, body: Record<string, unknown>) => ({ ...body, surveyVersion: 1, answeredAt: '2026-10-08T22:08:45.123456' }));
  const t = render();
  await fillPage0(t); await press(t, 'survey-next');
  await press(t, 'survey-opt-situation-TRAVELING_NOW'); await press(t, 'survey-opt-tripDuration-ONE_WEEK'); await press(t, 'survey-next');
  expect(btn(t, 'survey-submit').props.variant).toBe('off'); // 미응답 = 회색(off) — 활성과 같은 주황 금지(QA 10/9)
  await press(t, 'survey-opt-purpose-MENU_READING'); await press(t, 'survey-opt-foodAffinity-4');
  expect(btn(t, 'survey-submit').props.variant).toBe('primary');
  expect(has(t, 'survey-dot-2-on')).toBe(1);
  await press(t, 'survey-submit');
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
  await toPage2(t, 'TRIP_PLANNED');
  await press(t, 'survey-submit');
  expect(Object.keys(mockSetUserProps.mock.calls[0][0] as object)).toHaveLength(8);
  expect(mockSetUserProps.mock.calls[0][0]).toMatchObject({ survey_trip_timing: 'THIS_YEAR', survey_trip_duration: 'ONE_WEEK' });
});

it('400(검증 코드) = 코드 결함 → Sentry(status·code) + 시트 유지·재시도 라벨 · 캐시·user property·submit 계측 무변', async () => {
  mockPut.mockRejectedValue(new ApiError('bad', 400, 'COMMON-001'));
  const t = render();
  await toPage2(t);
  await press(t, 'survey-submit');
  expect(mockReport).toHaveBeenCalledWith(400, 'COMMON-001');
  expect(has(t, 'survey-error')).toBe(1);
  expect(modalOf(t).props.visible).toBe(true);
  expect(qc.getQueryData<{ surveyCompleted: boolean }>(['me', 'en'])?.surveyCompleted).toBe(false);
  expect(mockSetUserProps).not.toHaveBeenCalled();
  expect(mockTrack).not.toHaveBeenCalledWith('survey_submit');
  expect(JSON.stringify(t.toJSON())).toContain('survey.retry');
  // 공부 #244 1: 4xx = "나중에" 노출 → 이번 실행만 숨김(메모리) — 영구 저장 0, 재시작(모듈 리셋)이면 다시 뜬다(surveySession729)
  expect(has(t, 'survey-later')).toBe(1);
  expect(isSurveyHiddenThisRun()).toBe(false);
  await press(t, 'survey-later');
  expect(isSurveyHiddenThisRun()).toBe(true);
});

it('네트워크 1회 실패 = 재시도만("나중에" 0) · 2회 연속 = "나중에" 노출', async () => {
  mockPut.mockRejectedValue(new TypeError('Network request failed'));
  const t = render();
  await toPage2(t);
  await press(t, 'survey-submit');
  expect(has(t, 'survey-error')).toBe(1);
  expect(has(t, 'survey-later')).toBe(0);
  await press(t, 'survey-submit');
  expect(has(t, 'survey-later')).toBe(1);
  expect(mockReport).not.toHaveBeenCalled();
});

it('시트가 떠 있는 동안 = presented(딥링크 보류) · 닫히면(open=false) 해제', () => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<QueryClientProvider client={qc}><ProfileSurveySheet open /></QueryClientProvider>); });
  trees.push(t);
  expect(isSurveyPresented()).toBe(true);
  act(() => { t.update(<QueryClientProvider client={qc}><ProfileSurveySheet open={false} /></QueryClientProvider>); });
  expect(isSurveyPresented()).toBe(false);
});

it('네트워크 실패 = 재시도 + 시트 유지, Sentry 0 · 재시도 성공 = 닫힘 조건(캐시 true) · 제출 연타 = PUT 1회', async () => {
  let resolve!: (v: unknown) => void;
  mockPut.mockRejectedValueOnce(new TypeError('Network request failed')).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  const t = render();
  await toPage2(t);
  await press(t, 'survey-submit');
  expect(has(t, 'survey-error')).toBe(1);
  expect(mockReport).not.toHaveBeenCalled();
  expect(mockPut).toHaveBeenCalledTimes(1);
  const retry = btn(t, 'survey-submit');
  await act(async () => { retry.props.onPress(); retry.props.onPress(); }); // 응답 전 연타
  expect(mockPut).toHaveBeenCalledTimes(2);
  expect(btn(t, 'survey-submit').props.busy).toBe(true);
  await act(async () => { resolve({ ageBand: 'TWENTIES', gender: 'FEMALE', acquisition: 'SNS_AD', situation: 'TRAVELING_NOW', tripTiming: null, tripDuration: 'ONE_WEEK', purpose: 'MENU_READING', foodAffinity: 4 }); });
  await flush();
  expect(qc.getQueryData<{ surveyCompleted: boolean }>(['me', 'en'])?.surveyCompleted).toBe(true);
  expect(has(t, 'survey-error')).toBe(0);
});

it('400 MEMBER-003(좀비 세션) = 계약 결함 아님 — Sentry 0 · 재시도·나중에 0(세션 만료 경로가 닫는다)', async () => {
  mockPut.mockRejectedValue(new ApiError('gone', 400, 'MEMBER-003'));
  const t = render();
  await toPage2(t);
  await press(t, 'survey-submit');
  expect(mockReport).not.toHaveBeenCalled();
  expect(has(t, 'survey-error')).toBe(0);
  expect(has(t, 'survey-later')).toBe(0);
  expect(JSON.stringify(t.toJSON())).not.toContain('survey.retry');
});

it('라디오 원을 직접 탭해도 선택 · accessibilityRole=radio + accessibilityState.checked', async () => {
  const t = render();
  await press(t, 'survey-radio-ageBand-THIRTIES'); // 행이 아니라 원(Radio Pressable)
  const row = t.root.findAll((x) => x.props?.testID === 'survey-opt-ageBand-THIRTIES' && typeof x.props?.onPress === 'function')[0];
  expect(row.props.accessibilityRole).toBe('radio');
  expect(row.props.accessibilityState).toEqual({ checked: true });
  expect(t.root.findAll((x) => x.props?.testID === 'survey-opt-ageBand-TEENS' && typeof x.props?.onPress === 'function')[0].props.accessibilityState).toEqual({ checked: false });
});

it('생애주기: 시트 열린 채 세션 경계(open=false) → 다시 열리면 빈 폼 · 계정 전환(A→B, open 유지)도 빈 폼 — A의 답을 B로 제출 0', async () => {
  const t = render(true, 'A');
  await fillPage0(t);
  expect(btn(t, 'survey-next').props.variant).toBe('primary');
  update(t, false, 'A'); // 세션 경계 = me 캐시 비움 → open=false
  update(t, true, 'B');
  expect(has(t, 'survey-dot-0-on')).toBe(1);
  expect(btn(t, 'survey-next').props.variant).toBe('off'); // 비어 있다
  await fillPage0(t);
  update(t, true, 'C'); // open 유지한 채 회원 번호만 바뀜(계정 전환)
  expect(btn(t, 'survey-next').props.variant).toBe('off');
  expect(mockTrack.mock.calls.filter(([e]) => e === 'survey_view')).toHaveLength(3); // 폼 마운트마다 1회
});

it('성공 뒤 확인 재조회는 현재 언어 키 exact — 접두 매치로 [me, reviews]까지 재조회하지 않는다', async () => {
  mockPut.mockImplementation(async (_p: string, body: Record<string, unknown>) => body);
  const spy = jest.spyOn(qc, 'invalidateQueries');
  const t = render();
  await toPage2(t);
  await press(t, 'survey-submit');
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith({ queryKey: ['me', 'en'], exact: true });
});
