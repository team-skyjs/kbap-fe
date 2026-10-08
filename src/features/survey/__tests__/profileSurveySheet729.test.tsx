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
/* eslint-enable import/first */

let qc: QueryClient;
const trees: ReactTestRenderer[] = [];
const render = (open = true) => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<QueryClientProvider client={qc}><ProfileSurveySheet open={open} /></QueryClientProvider>); });
  trees.push(t);
  return t;
};
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => {
  jest.clearAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(['me', 'en'], { id: '1', surveyCompleted: false, restrictions: [] });
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
  const modal = t.root.findAll((x) => x.props?.testID === 'survey-modal')[0];
  act(() => { modal.props.onRequestClose(); });
  expect(modal.props.visible).toBe(true);
  expect(t.root.findAll((x) => x.props?.testID === 'survey-backdrop' && typeof x.props?.onPress === 'function')).toHaveLength(0);
  mockTrack.mockClear();
  render(false);
  expect(mockTrack).not.toHaveBeenCalled();
});

it('페이지 0: 3문항 전부 답해야 다음 활성 · 다음 = 점 이동 + 이전 버튼', async () => {
  const t = render();
  expect(has(t, 'survey-dot-0-on')).toBe(1);
  expect(btn(t, 'survey-next').props.disabled).toBe(true);
  await press(t, 'survey-opt-ageBand-TWENTIES'); await press(t, 'survey-opt-gender-FEMALE');
  expect(btn(t, 'survey-next').props.disabled).toBe(true);
  await press(t, 'survey-opt-acquisition-SNS_AD');
  expect(btn(t, 'survey-next').props.disabled).toBe(false);
  expect(has(t, 'survey-back')).toBe(0);
  await press(t, 'survey-next');
  expect(has(t, 'survey-dot-1-on')).toBe(1);
  expect(has(t, 'survey-q-situation')).toBe(1);
  expect(has(t, 'survey-q-tripTiming')).toBe(0); // 상황 미응답 = 분기 숨김
  await press(t, 'survey-back');
  expect(has(t, 'survey-dot-0-on')).toBe(1);
  expect(btn(t, 'survey-next').props.disabled).toBe(false); // 답 유지
});

it('페이지 1 분기: TRIP_PLANNED = 시기+기간 · 상황 전환 = 분기 답 비움(돌아와도 미응답) · TRAVELING_NOW = 기간만', async () => {
  const t = render();
  await fillPage0(t); await press(t, 'survey-next');
  await press(t, 'survey-opt-situation-TRIP_PLANNED');
  expect(has(t, 'survey-q-tripTiming')).toBe(1); expect(has(t, 'survey-q-tripDuration')).toBe(1);
  expect(btn(t, 'survey-next').props.disabled).toBe(true);
  await press(t, 'survey-opt-tripTiming-THIS_YEAR'); await press(t, 'survey-opt-tripDuration-ONE_WEEK');
  expect(btn(t, 'survey-next').props.disabled).toBe(false);
  await press(t, 'survey-opt-situation-LIVING_IN_KOREA');
  expect(has(t, 'survey-q-tripTiming')).toBe(0); expect(has(t, 'survey-q-tripDuration')).toBe(0);
  expect(btn(t, 'survey-next').props.disabled).toBe(false);
  await press(t, 'survey-opt-situation-TRIP_PLANNED');
  expect(btn(t, 'survey-next').props.disabled).toBe(true); // 비워졌다 — 다시 답해야
  expect(t.root.findAll((x) => x.props?.testID === 'survey-opt-tripTiming-THIS_YEAR' && x.props?.accessibilityState?.selected === true)).toHaveLength(0);
  await press(t, 'survey-opt-situation-TRAVELING_NOW');
  expect(has(t, 'survey-q-tripTiming')).toBe(0); expect(has(t, 'survey-q-tripDuration')).toBe(1);
});

it('제출 = PUT /members/me/survey body 계약 그대로(대문자·정수·미해당 분기 null) → me 캐시 surveyCompleted=true + user property 7키(시기 제외) + survey_submit', async () => {
  mockPut.mockImplementation(async (_p: string, body: Record<string, unknown>) => ({ ...body, surveyVersion: 1, answeredAt: '2026-10-08T22:08:45.123456' }));
  const t = render();
  await toPage2(t, 'TRAVELING_NOW');
  expect(has(t, 'survey-dot-2-on')).toBe(1);
  await press(t, 'survey-submit');
  expect(mockPut).toHaveBeenCalledTimes(1);
  expect(mockPut).toHaveBeenCalledWith('/members/me/survey', { ageBand: 'TWENTIES', gender: 'FEMALE', acquisition: 'SNS_AD', situation: 'TRAVELING_NOW', tripTiming: null, tripDuration: 'ONE_WEEK', purpose: 'MENU_READING', foodAffinity: 4 });
  expect(qc.getQueryData<{ surveyCompleted: boolean }>(['me', 'en'])?.surveyCompleted).toBe(true);
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

it('400 = 코드 결함 → Sentry(status·code) + 시트 유지·재시도 라벨 · 캐시·user property·submit 계측 무변', async () => {
  mockPut.mockRejectedValue(new ApiError('bad', 400, 'MEMBER-003'));
  const t = render();
  await toPage2(t);
  await press(t, 'survey-submit');
  expect(mockReport).toHaveBeenCalledWith(400, 'MEMBER-003');
  expect(has(t, 'survey-error')).toBe(1);
  expect(t.root.findAll((x) => x.props?.testID === 'survey-modal')[0].props.visible).toBe(true);
  expect(qc.getQueryData<{ surveyCompleted: boolean }>(['me', 'en'])?.surveyCompleted).toBe(false);
  expect(mockSetUserProps).not.toHaveBeenCalled();
  expect(mockTrack).not.toHaveBeenCalledWith('survey_submit');
  expect(JSON.stringify(t.toJSON())).toContain('survey.retry');
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
