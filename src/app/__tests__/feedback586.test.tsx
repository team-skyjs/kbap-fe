/**
 * P-394(KB-586) — 프로필 문의하기 + 내 문의.
 * ① 게스트 진입: 프로필 게스트 분기에도 진입 행이 있고, 화면 자체에 로그인 게이트가 없다
 * ② 제출: 사진 0장이면 imagePaths 미전송 / 사진은 purpose=FEEDBACK으로 올린 path만 전송
 * ③ 완료는 **응답 성공 후에만**(P-387) — 실패면 본문·사진 유지 + back 안 함
 * ④ 429(FEEDBACK-003)는 전용 안내
 * ⑤ deviceInfo: 계약 9키 화이트리스트, 못 얻는 키는 **생략**(빈 문자열 금지)
 * ⑥ 목록·상세 렌더(P-406 목록 우선 — 행 = 제목 1줄·상대시간·상태 텍스트 / 상세 답변 스레드·답변자 "K-Bap team" 고정)
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
  // 포커스 이펙트: 기본은 마운트 시 포커스(정리 함수 = 이탈). 이탈 시나리오는 테스트에서 직접 호출한다.
  useFocusEffect: (cb: () => (() => void) | void) => {
    const R = require('react') as typeof import('react');
    R.useEffect(() => {
      const off = cb();
      mockBlur.fn = typeof off === 'function' ? off : () => {};
      return typeof off === 'function' ? off : undefined;
    }, [cb]);
  },
}));
const mockBlur: { fn: () => void } = { fn: () => {} };
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
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.3', nativeBuildVersion: '34' }));
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
  isFetching: false,
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

const byId = (r: ReactTestRenderer | ReactTestRenderer['root'], id: string) =>
  ('root' in r ? r.root : r).findAllByProps({ testID: id })[0];

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
  // P-406: 두 진입점 모두 **목록**으로 간다(작성 직행 금지)
  expect(profile.match(/router\.push\('\/profile\/feedback' as Href\)/g)?.length).toBe(2);
  expect(profile).not.toContain("'/profile/feedback/new'");
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

// 업로드가 끝나기 전에 유저가 "내 문의"로 넘어가면, 늦게 도착한 성공 콜백의 back()이
// **그 화면**을 닫아 작성 화면으로 역주행한다(Codex #170 3R).
it('③ 전송 중 화면을 떠났으면 성공해도 back 하지 않는다(늦은 콜백 역주행 방지)', async () => {
  let resolve!: (v: unknown) => void;
  mockSubmit.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<FeedbackComposeScreen />); });
  const input = r.root.findAllByType(TextInput).find((n) => n.props.testID === 'feedback-body')!;
  await act(async () => { input.props.onChangeText('slow'); });
  let sent!: Promise<unknown>;
  await act(async () => { sent = byId(r, 'feedback-send').props.onPress(); });
  await act(async () => { mockBlur.fn(); }); // 유저가 화면을 떠남
  await act(async () => { resolve({ id: '1' }); await sent; });
  expect(mockToast).toHaveBeenCalledWith('feedback.sent'); // 안내는 뜬다(루트 호스트)
  expect(mockBack).not.toHaveBeenCalled(); // 지금 보고 있는 화면을 닫지 않는다
});

it('④ 갤러리 권한 거부 안내는 카메라 문구(scan.*)를 쓰지 않는다', () => {
  const compose = read('src/app/profile/feedback/new.tsx');
  expect(compose).not.toContain("scan.permission");
  expect(compose).toContain("t('photo.libraryPermTitle')");
  expect(compose).toContain("t('photo.libraryPermBody')");
  for (const lang of LANGS) {
    const photo = JSON.parse(read(`src/lib/i18n/${lang}.json`)).photo;
    expect(typeof photo.libraryPermTitle).toBe('string');
    expect(typeof photo.libraryPermBody).toBe('string');
  }
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

const hostTexts = (node: ReactTestRenderer['root']) =>
  node.findAllByType('Text' as never).flatMap((n) => (typeof n.props.children === 'string' ? [n.props.children as string] : []));

/* P-406(KB-627): 목록이 첫 화면 — 행은 제목 1줄 + 상대시간(+상태) + chevron. 칩·답변 수·우상단 날짜 없음. */
it('⑥ 목록 행 — 제목 = 첫 비지 않은 줄(1줄) · 서브 = 상대시간 · 상태 텍스트 · 칩·답변 수 없음', async () => {
  mockListState = idleList([{ ...ITEM, content: '\n  스캔 버튼이 두 번 눌려요  \n둘째 줄' }]);
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<MyFeedbackScreen />); });
  const row = byId(r, 'feedback-row-12');
  const texts = hostTexts(row);
  expect(texts[0]).toBe('스캔 버튼이 두 번 눌려요'); // 앞 빈 줄·공백 건너뜀, 둘째 줄 안 붙음
  const title = row.findAll((n) => n.props.children === '스캔 버튼이 두 번 눌려요' && n.props.numberOfLines !== undefined)[0];
  expect(title.props.numberOfLines).toBe(1);
  expect(texts[1]).toMatch(/^reviews\.daysAgo:\d+$/); // 상대시간
  expect(byId(row, 'feedback-row-status').props.children).toBe('feedback.statusAnswered'); // 상태 = 별도 Text
  expect(texts.some((x) => x.includes('·'))).toBe(false); // 구분 문자 없음(Q-62 · P-385)
  expect(texts.some((x) => x.startsWith('feedback.replyCount'))).toBe(false); // 답변 수 없음
  expect(row.findAll((n) => (n.type as { name?: string }).name === 'Chip')).toHaveLength(0); // 칩 없음
});

it('⑥ 목록 행 — OPEN은 시간만 · CLOSED는 상태 붙음', async () => {
  mockListState = idleList([
    { ...ITEM, id: '1', status: 'OPEN' as const, replies: [] },
    { ...ITEM, id: '2', status: 'CLOSED' as const },
  ]);
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<MyFeedbackScreen />); });
  expect(hostTexts(byId(r, 'feedback-row-1'))).toHaveLength(2); // 제목 + 시간뿐
  expect(byId(byId(r, 'feedback-row-1'), 'feedback-row-status')).toBeUndefined();
  expect(byId(byId(r, 'feedback-row-2'), 'feedback-row-status').props.children).toBe('feedback.statusClosed');
});

it('⑥ 목록 행 — 본문이 전부 공백이어도 **행은 남는다**(제목만 생략, 시간은 보임)', async () => {
  mockListState = idleList([{ ...ITEM, content: '  \n \t ' }]);
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<MyFeedbackScreen />); });
  const row = byId(r, 'feedback-row-12');
  expect(row).toBeTruthy();
  const texts = hostTexts(row);
  expect(texts).toEqual([expect.stringMatching(/^reviews\.daysAgo:\d+$/), 'feedback.statusAnswered']); // 제목 없이 시간·상태
});

it('⑥ 알약 "+ New" → 작성 라우트 · 빈 상태에도 알약(예전 빈 상태 CTA는 없음)', async () => {
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<MyFeedbackScreen />); });
  await act(async () => { byId(r, 'feedback-new-fab').props.onPress(); });
  expect(mockPush).toHaveBeenCalledWith('/profile/feedback/new');
  expect(hostTexts(byId(r, 'feedback-new-fab'))).toEqual(['feedback.newInquiry']);

  mockListState = idleList([]);
  await act(async () => { r = renderer.create(<MyFeedbackScreen />); });
  expect(byId(r, 'feedback-new-fab')).toBeTruthy();
  expect(byId(r, 'feedback-empty-cta')).toBeUndefined();
});

it('⑥ 목록·상세 헤더 = "Contact us"(feedback.title) · 작성 헤더 = feedback.newTitle · 작성에 my-link 없음', async () => {
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<MyFeedbackScreen />); });
  expect(hostTexts(r.root)).toContain('feedback.title');
  await act(async () => { r = renderer.create(<FeedbackDetailScreen />); });
  expect(hostTexts(r.root)).toContain('feedback.title');
  await act(async () => { r = renderer.create(<FeedbackComposeScreen />); });
  expect(hostTexts(r.root)).toContain('feedback.newTitle');
  expect(byId(r, 'feedback-my-link')).toBeUndefined();
  for (const f of ['index.tsx', 'new.tsx', '[id].tsx']) expect(read(`src/app/profile/feedback/${f}`)).not.toContain('myTitle');
});

it('⑥ 목록 — 다음 페이지 실패면 푸터에 재시도를 낸다(전체 오류 블록은 안 뜨는 자리)', async () => {
  const fetchNextPage = jest.fn();
  mockListState = { ...idleList([ITEM]), isError: true, isFetchNextPageError: true, error: new Error('boom'), fetchNextPage };
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<MyFeedbackScreen />); });
  expect(byId(r, 'feedback-row-12')).toBeTruthy(); // 받아둔 목록은 그대로 보인다
  expect(byId(r, 'feedback-next-error')).toBeTruthy();
  await act(async () => { byId(r, 'feedback-next-retry').props.onPress(); });
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

// app.json에 ios.buildNumber도 android.versionCode도 없고 eas.json이 remote+autoIncrement라,
// expoConfig 경유로는 buildNumber가 **항상 비어** 나갔다(Codex #170 4R).
it('⑤ deviceInfo — 버전·빌드 번호는 설치된 바이너리에서 읽는다(expoConfig 아님)', () => {
  const { collectDeviceInfo } = jest.requireActual('@/lib/deviceInfo') as typeof import('@/lib/deviceInfo');
  const info = collectDeviceInfo();
  expect(info.buildNumber).toBe('34');
  expect(info.appVersion).toBe('1.0.3');
  // expo-application은 expo-notifications가 이미 끌고 와 있다 — 직접 의존이면 지문이 돈다
  expect(JSON.parse(read('package.json')).dependencies['expo-application']).toBeUndefined();
});

it('⑤ deviceInfo — 안드로이드 osVersion은 API 레벨이 아니라 릴리스', () => {
  // react-native 모듈 전체를 목하면 lazy getter가 전부 평가돼 터진다 — Platform 속성만 갈아끼운다
  const { Platform } = require('react-native') as typeof import('react-native');
  const saved = Object.getOwnPropertyDescriptors(Platform);
  const set = (k: string, v: unknown) => Object.defineProperty(Platform, k, { value: v, configurable: true });
  try {
    set('OS', 'android');
    set('Version', 35);
    set('constants', { Release: '15', Model: 'Pixel 9' });
    const { collectDeviceInfo } = jest.requireActual('@/lib/deviceInfo') as typeof import('@/lib/deviceInfo');
    const info = collectDeviceInfo();
    expect(info.osVersion).toBe('15'); // API 레벨 35가 아니라 유저가 아는 버전
    expect(info.deviceModel).toBe('Pixel 9');
  } finally {
    for (const k of ['OS', 'Version', 'constants']) Object.defineProperty(Platform, k, saved[k]);
  }
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
// stale 캐시로 진입하면 기존 페이지 재조회가 이미 떠 있을 수 있다 — 그걸 앞질러 당기면
// 갱신을 취소하고 낡은 체인을 훑다가 "없음"으로 끝난다(Codex #170 4R).
it('⑥ 상세 — 백그라운드 재조회 중이면 페이지를 당기지 않고 기다린다', async () => {
  const fetchNextPage = jest.fn();
  mockListState = { ...idleList([]), hasNextPage: true, isFetching: true, fetchNextPage };
  await act(async () => { renderer.create(<FeedbackDetailScreen />); });
  expect(fetchNextPage).not.toHaveBeenCalled();
});

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

/* ---- P-406 치수 전사(발주 표) — 색은 토큰, 리터럴은 알약 흰색만 ---- */

it('P-406 치수 — 행·알약·목록 여백이 발주 전사값 그대로', () => {
  // 스타일 상수는 StyleSheet에 박혀 있어 렌더 트리로 보기보다 소스가 정확하다(tileUnify505와 같은 방식)
  const src = read('src/app/profile/feedback/index.tsx');
  expect(src).toMatch(/list: \{ paddingTop: 8, paddingHorizontal: 0, paddingBottom: 96 \}/);
  expect(src).toMatch(/row: \{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 \}/);
  expect(src).toMatch(/rowText: \{ flex: 1, gap: 4 \}/);
  expect(src).toMatch(/title: \{ fontSize: 17, fontWeight: '400', color: C\.ink \}/);
  expect(src).toMatch(/sub: \{ fontSize: 15, fontWeight: '400', color: C\.ink3 \}/);
  expect(src).toMatch(/subRow: \{ flexDirection: 'row', alignItems: 'baseline', gap: 8 \}/);
  expect(src).toMatch(/position: 'absolute', right: 24, height: 52, paddingLeft: FAB_PAD - PLUS_GLYPH_INSET, paddingRight: FAB_PAD, borderRadius: 26,\s*backgroundColor: C\.ink, flexDirection: 'row', alignItems: 'center', gap: 8,/);
  expect(src).toMatch(/fabLabel: \{ fontSize: 17, fontWeight: '600', color: '#FFFFFF' \}/);
  expect(src).toMatch(/bottom: insets\.bottom \+ 24/);
  expect(src).toMatch(/<IconPlus size=\{PLUS_SIZE\} color="#FFFFFF" \/>/);
  expect(src).toMatch(/<IconChevron size=\{20\} color=\{C\.ink3\} \/>/);
  // 보더·그림자 없음(행·알약) — 스타일 블록만 본다(푸터 재시도 버튼의 보더는 기존 그대로)
  const block = (name: string) => src.match(new RegExp(`\\n  ${name}: \\{[\\s\\S]*?\\n?\\s*\\},?\\n`))![0];
  for (const n of ['row', 'rowText', 'fab']) expect(block(n)).not.toMatch(/border(Width|Color)|shadow|elevation/);
});

/* ---- KB-635(P-409, 예진 b36 실기) ---- */

/** D4Plus의 가로 획 = viewBox 24 기준 x 5…19, strokeWidth 2 · round cap → 보이는 가장자리 x 4…20. */
function plusGlyphInset(size: number): number {
  const src = read('src/components/design4Assets.tsx');
  const def = src.slice(src.indexOf('export const D4Plus'), src.indexOf('export const D4FilePen'));
  const tx = Number(def.match(/matrix\(1,0,0,1,([\d.]+),/)![1]); // 5
  const sw = Number(def.match(/strokeWidth=\{(\d+)\}/)![1]); // 2
  expect(def).toContain('d="M0 7L14 7'); // 가로 획이 경로 x=0에서 시작(이동량 tx가 곧 시작점)
  return ((tx - sw / 2) * size) / 24; // 보이는 좌측 가장자리까지의 빈칸
}

it('KB-635 알약 계측 — 글리프 좌측 빈칸만큼 좌 패딩을 줄여 **보이는** 좌·우 여백이 같다', async () => {
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<MyFeedbackScreen />); });
  const fab = r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'feedback-new-fab')[0];
  const st = Object.assign({}, ...[fab.props.style].flat(Infinity).filter(Boolean)) as Record<string, number>;
  const inset = plusGlyphInset(20);
  expect(inset).toBeCloseTo(3.333, 2); // 계측값: 20pt 슬롯 좌측 빈칸
  expect(st.paddingRight).toBe(24); // 텍스트 가장자리 ↔ 알약 우측
  expect(st.paddingLeft + inset).toBeCloseTo(24, 5); // 글리프 가장자리 ↔ 알약 좌측 = 우측과 같다
});

it('KB-635 Send = 검정(C.ink) + 흰 글자 · 본문 공백이면 기존 off 그대로', async () => {
  const bg = (n: ReactTestRenderer['root']) =>
    (Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean)) as { backgroundColor?: string }).backgroundColor;
  const sendHost = (r: ReactTestRenderer) => r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'feedback-send')[0];
  let r!: ReactTestRenderer;
  await act(async () => { r = renderer.create(<FeedbackComposeScreen />); });
  expect(bg(sendHost(r))).toBe('#EAEBEE'); // 빈 본문 = off(C.line) — 기존 규약
  const input = r.root.findAllByType(TextInput).find((n) => n.props.testID === 'feedback-body')!;
  await act(async () => { input.props.onChangeText('hello'); });
  expect(bg(sendHost(r))).toBe('#1C1E21'); // C.ink — 주황(primary) 아님
  const label = sendHost(r).findAll((n) => typeof n.type === 'string' && n.props.children === 'feedback.send')[0];
  const lc = (Object.assign({}, ...[label.props.style].flat(Infinity).filter(Boolean)) as { color?: string }).color;
  expect(lc).toBe('#FFFFFF');
});
