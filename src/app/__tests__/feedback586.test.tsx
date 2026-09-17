/**
 * P-394(KB-586) — 프로필 문의하기 + 내 문의.
 * ① 게스트 진입: 프로필 게스트 분기에도 진입 행이 있고, 화면 자체에 로그인 게이트가 없다
 * ② 제출: 사진 0장이면 imagePaths 미전송 / 사진은 purpose=FEEDBACK으로 올린 path만 전송
 * ③ 완료는 **응답 성공 후에만**(P-387) — 실패면 본문·사진 유지 + back 안 함
 * ④ 429(FEEDBACK-003)는 전용 안내
 * ⑤ deviceInfo: 계약 9키 화이트리스트, 못 얻는 키는 **생략**(빈 문자열 금지)
 * ⑥ 목록·상세 렌더(상태 칩·답변 스레드·답변자 "K-Bap team" 고정)
 * ⑦ 계측 화이트리스트 — has_photos·photo_count만(본문·기기정보 전송 금지)
 */
import * as React from 'react';
import { TextInput } from 'react-native';
import * as fs from 'fs';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView, FlatList, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('react-native-svg', () => {
  const R = require('react') as typeof import('react');
  const mk = (name: string) => (props: Record<string, unknown>) => R.createElement(name, props, props.children as never);
  return new Proxy({ __esModule: true, default: mk('Svg') } as Record<string, unknown>, {
    get: (t, k) => (k in t ? t[k as string] : mk(String(k))),
  });
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${k}:${o.count}` : k), i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockRouteId = '12';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockRouteId }),
  useSegments: () => [],
  usePathname: () => '/',
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));
const mockToast = jest.fn();
jest.mock('@/components/topToastStore', () => ({ showTopToast: (...a: unknown[]) => mockToast(...a), subscribeTopToast: () => () => {} }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ EVENTS: { profile_feedback_submit: 'profile_feedback_submit' }, track: (...a: unknown[]) => mockTrack(...a) }));

const mockSubmit = jest.fn().mockResolvedValue({ id: '12' });
let mockListState: Record<string, unknown> = {};
jest.mock('@/lib/data/useFeedback', () => {
  const actual = jest.requireActual('@/lib/data/useFeedback') as Record<string, unknown>;
  return {
    ...actual,
    useSubmitFeedback: () => ({ mutateAsync: mockSubmit, isPending: false }),
    useMyFeedbacks: () => mockListState,
  };
});

import FeedbackComposeScreen from '@/app/profile/feedback/new';
import MyFeedbackScreen from '@/app/profile/feedback/index';
import FeedbackDetailScreen from '@/app/profile/feedback/[id]';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const LANGS = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'ru', 'th', 'es', 'id'];

const ITEM = {
  id: '12',
  content: '스캔 버튼이 두 번 눌려요',
  imageUrls: ['https://cdn.example.com/a.webp'],
  status: 'ANSWERED' as const,
  createdAt: '2026-09-18T02:10:00Z',
  replies: [{ id: '3', content: '확인했어요.', createdAt: '2026-09-18T05:00:00Z' }],
};

const idleList = (flat: unknown[]) => ({
  data: { flat },
  isLoading: false,
  isError: false,
  error: null,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: jest.fn(),
  refetch: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteId = '12';
  mockListState = idleList([ITEM]);
  mockSubmit.mockResolvedValue({ id: '12' });
});

const byId = (r: ReactTestRenderer, id: string) => r.root.findAllByProps({ testID: id })[0];

async function typeAndSend(r: ReactTestRenderer, text = 'hello') {
  const input = r.root.findAllByType(TextInput).find((n) => n.props.testID === 'feedback-body')!;
  await act(async () => { input.props.onChangeText(text); });
  await act(async () => { await byId(r, 'feedback-send').props.onPress(); });
}

/* ---- ① 게스트 진입 ---- */

it('① 게스트도 진입 — 프로필 게스트 분기에 행이 있고, 문의 화면에 로그인 게이트가 없다', () => {
  const profile = read('src/app/(tabs)/profile.tsx');
  // 게스트 분기 / 회원 분기 양쪽에 같은 행 — 한쪽만 있으면 게스트가 못 들어간다
  expect(profile.match(/t\('feedback\.title'\)/g)?.length).toBe(2);
  const compose = read('src/app/profile/feedback/new.tsx');
  expect(compose).not.toMatch(/AuthGate|useIsGuest|requireLogin/);
});

/* ---- ② 제출 페이로드 ---- */

it('② 사진 0장 → imagePaths 키 자체를 안 보낸다(계약상 선택 필드)', async () => {
  const { submitFeedback } = jest.requireActual('@/lib/data/useFeedback') as typeof import('@/lib/data/useFeedback');
  const post = jest.fn().mockResolvedValue({ id: 9 });
  jest.spyOn(require('@/lib/api/client').api, 'post').mockImplementation(post);
  await submitFeedback({ content: 'hi', photoUris: [] });
  const body = post.mock.calls[0][1] as Record<string, unknown>;
  expect(post.mock.calls[0][0]).toBe('/api/feedbacks');
  expect('imagePaths' in body).toBe(false);
  expect(body.content).toBe('hi');
});

it('② 사진은 purpose=FEEDBACK으로 올린 path만 전송(최대 3장)', async () => {
  const { submitFeedback, FEEDBACK_IMAGE_PURPOSE } = jest.requireActual('@/lib/data/useFeedback') as typeof import('@/lib/data/useFeedback');
  const post = jest.fn().mockResolvedValue({ id: 9 });
  jest.spyOn(require('@/lib/api/client').api, 'post').mockImplementation(post);
  const upload = jest
    .spyOn(require('@/lib/api/scanImage'), 'uploadImage')
    .mockImplementation(async (_f: unknown, _p: unknown) => ({ path: `images/feedback/${(_f as { uri: string }).uri}.webp` }) as never);
  await submitFeedback({ content: 'hi', photoUris: ['a', 'b', 'c', 'd'] });
  expect(upload).toHaveBeenCalledTimes(3); // 4번째는 잘린다
  expect(upload.mock.calls[0][1]).toBe(FEEDBACK_IMAGE_PURPOSE);
  expect((post.mock.calls[0][1] as { imagePaths: string[] }).imagePaths).toEqual([
    'images/feedback/a.webp',
    'images/feedback/b.webp',
    'images/feedback/c.webp',
  ]);
});

/* ---- ③④ 완료 시점 ---- */

it('③ 성공 후에만 완료 — 토스트 + back, 계측 1회', async () => {
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<FeedbackComposeScreen />); });
  await typeAndSend(r);
  expect(mockSubmit).toHaveBeenCalledWith({ content: 'hello', photoUris: [] });
  expect(mockToast).toHaveBeenCalledWith('feedback.sent');
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith('profile_feedback_submit', { has_photos: false, photo_count: 0 });
});

it('③ 실패 → back 안 함 · 본문 유지 · 실패 안내(계측도 안 나간다)', async () => {
  mockSubmit.mockRejectedValueOnce(new Error('boom'));
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<FeedbackComposeScreen />); });
  await typeAndSend(r, 'keep me');
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockTrack).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith('feedback.sendFailed', { error: true });
  const input = r.root.findAllByType(TextInput).find((n) => n.props.testID === 'feedback-body')!;
  expect(input.props.value).toBe('keep me'); // 재시도할 수 있게 본문 보존
});

it('④ 429(FEEDBACK-003) → 일반 실패와 다른 전용 안내', async () => {
  mockSubmit.mockRejectedValueOnce(Object.assign(new Error('rate'), { code: 'FEEDBACK-003' }));
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<FeedbackComposeScreen />); });
  await typeAndSend(r);
  expect(mockToast).toHaveBeenCalledWith('feedback.rateLimited', { error: true });
});

/* ---- ⑤ deviceInfo ---- */

it('⑤ deviceInfo — 계약 9키 밖 키 0 · 값 없는 키는 생략(빈 문자열 금지)', () => {
  const { collectDeviceInfo } = jest.requireActual('@/lib/deviceInfo') as typeof import('@/lib/deviceInfo');
  const info = collectDeviceInfo() as Record<string, unknown>;
  const CONTRACT = ['os', 'osVersion', 'appVersion', 'buildNumber', 'runtimeVersion', 'deviceModel', 'locale', 'lang', 'timezone'];
  expect(CONTRACT).toHaveLength(9);
  expect(Object.keys(info).every((k) => CONTRACT.includes(k))).toBe(true);
  expect(Object.values(info).every((v) => typeof v === 'string' && v !== '')).toBe(true);
  expect(info.os).toBe('ios'); // jest RN preset
});

/* ---- ⑥ 목록·상세 렌더 ---- */

it('⑥ 목록 — 상태 칩·답변 수, 빈 상태는 CTA 동반', async () => {
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<MyFeedbackScreen />); });
  expect(byId(r, 'feedback-row-12')).toBeTruthy();
  const texts = r.root.findAllByType('Text' as never).flatMap((n) => (typeof n.props.children === 'string' ? [n.props.children] : []));
  expect(texts).toContain('feedback.statusAnswered');
  expect(texts).toContain('feedback.replyCount:1');

  mockListState = idleList([]);
  await act(async () => { r = renderer.create(<MyFeedbackScreen />); });
  expect(byId(r, 'feedback-empty-cta')).toBeTruthy();
});

it('⑥ 상세 — 본문·답변 스레드, 답변자는 "K-Bap team" 고정(어드민 정보 미노출)', async () => {
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<FeedbackDetailScreen />); });
  expect(byId(r, 'feedback-detail-content').props.children).toBe(ITEM.content);
  expect(byId(r, 'feedback-detail-replies')).toBeTruthy();
  const texts = r.root.findAllByType('Text' as never).flatMap((n) => (typeof n.props.children === 'string' ? [n.props.children] : []));
  expect(texts).toContain('feedback.teamName');
});

it('⑥ 상세 — 답변 0건이면 스레드 섹션 자체가 없다(빈 헤더 금지 P-210)', async () => {
  mockListState = idleList([{ ...ITEM, replies: [] }]);
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<FeedbackDetailScreen />); });
  expect(r.root.findAllByProps({ testID: 'feedback-detail-replies' })).toHaveLength(0);
});

it('⑥ 상세 — 캐시에 없고 뒤 페이지가 남았으면 당겨온다(딥링크·콜드 스타트)', async () => {
  const fetchNextPage = jest.fn();
  mockListState = { ...idleList([]), hasNextPage: true, fetchNextPage };
  await act(async () => { renderer.create(<FeedbackDetailScreen />); });
  expect(fetchNextPage).toHaveBeenCalled();
});

// 페이지 요청이 실패해도 마지막 성공 페이지가 hasNextPage=true를 유지한다 —
// 멈추지 않으면 실패한 요청을 무한 재발행하면서 스켈레톤만 남는다(Codex #170 P2).
it('⑥ 상세 — 페이지 요청 실패면 재요청을 멈추고 오류 폴백(재시도)을 낸다', async () => {
  const fetchNextPage = jest.fn();
  mockListState = {
    ...idleList([]),
    hasNextPage: true,
    isFetchNextPageError: true,
    error: new Error('boom'),
    fetchNextPage,
  };
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<FeedbackDetailScreen />); });
  expect(fetchNextPage).not.toHaveBeenCalled();
  expect(r.root.findAllByProps({ testID: 'query-error-block' }).length + r.root.findAllByProps({ testID: 'error-block' }).length).toBeGreaterThan(0);
});

/* ---- ⑦ 계측·i18n 화이트리스트 ---- */

it('⑦ 계측 화이트리스트 — has_photos·photo_count만(본문·기기정보 키 0)', () => {
  const src = read('src/lib/analytics.ts');
  expect(src).toContain("profile_feedback_submit: ['has_photos', 'photo_count']");
  const compose = read('src/app/profile/feedback/new.tsx');
  const call = compose.match(/track\(EVENTS\.profile_feedback_submit,\s*\{[^}]*\}/)![0];
  expect(call).not.toMatch(/body|content|deviceInfo|uri/);
});

it('⑦ 어댑터 격리 — 와이어 파싱은 feedbackAdapter에만(훅에 재유입 금지)', () => {
  const hook = read('src/lib/data/useFeedback.ts');
  expect(hook).not.toMatch(/interface \w*Wire\b/); // 와이어 타입 선언 0
  expect(hook).toContain("from '@/lib/api/feedbackAdapter'");
  const adapter = read('src/lib/api/feedbackAdapter.ts');
  expect(adapter).toContain('export function adaptFeedback');
});

it('⑦ 한국어 카피 — 대시(—) 부연 없이 문장 분리(AGENTS.md 신규 한국어 카피 기준)', () => {
  const ko = JSON.parse(read('src/lib/i18n/ko.json')).feedback as Record<string, string>;
  for (const [k, v] of Object.entries(ko)) expect(`${k}:${v}`).not.toContain('—');
});

it('⑦ i18n — feedback 키 10개 로케일 전수(ko 등 단수형 없는 언어는 _other만)', () => {
  const base = JSON.parse(read('src/lib/i18n/en.json')).feedback;
  const plain = Object.keys(base).filter((k) => !k.startsWith('replyCount'));
  for (const lang of LANGS) {
    const fb = JSON.parse(read(`src/lib/i18n/${lang}.json`)).feedback;
    expect(fb).toBeTruthy();
    for (const k of plain) expect(typeof fb[k]).toBe('string');
    // 복수형은 언어별 형태 수가 다르다 — _other는 어느 언어에나 있어야 한다
    expect(typeof fb.replyCount_other).toBe('string');
  }
});
