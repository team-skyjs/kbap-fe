/**
 * KB-497 — 알림 설정 화면(서버 정본 2그룹): 스켈레톤/재시도/토글/캡션(US1) · 소식 토글 → 동의 시트,
 * 식사 시간 비활성, PATCH 본문(US2) · 게스트 = AuthGateSheet(US3) · OS 권한 배너·AppState(US5) ·
 * 계정 전환 캐시(US1 생애주기).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Linking } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (v: unknown) => v,
    withDelay: (_d: number, v: unknown) => v,
    cancelAnimation: () => {},
    interpolate: () => 0,
    useReducedMotion: () => false,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, inOut: () => () => 0, quad: 0, linear: () => 0, ease: 0 },
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Redirect: (p: { href: string }) => { const { View } = require('react-native'); return <View testID="redirect" accessibilityLabel={p.href} />; },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/AuthGateSheet', () => ({
  AuthGateSheet: (p: { open: boolean; context: string }) => { const { View } = require('react-native'); return p.open ? <View testID="auth-gate" accessibilityLabel={p.context} /> : null; },
}));
const mockSession = { guest: false };
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockSession.guest }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn(), EVENTS: { push_pref_toggle: 'push_pref_toggle' } }));
const mockOpen = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/openExternal', () => ({ openWebPage: (...a: unknown[]) => mockOpen(...a) }));
const mockAdapter = { getPermissionStatus: jest.fn().mockResolvedValue('granted'), registerPushToken: jest.fn().mockResolvedValue(undefined) };
jest.mock('@/lib/push/pushAdapter', () => ({
  get getPermissionStatus() { return mockAdapter.getPermissionStatus; },
  get registerPushToken() { return mockAdapter.registerPushToken; },
}));
const mockData = {
  query: { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() },
  update: { mutate: jest.fn(), isError: false, reset: jest.fn() },
};
jest.mock('@/lib/data/useNotificationSettings', () => ({
  useNotificationSettings: jest.fn(() => mockData.query),
  useUpdateNotificationSettings: () => mockData.update,
  NOTIF_SETTINGS_KEY: ['notifSettings'],
}));

import NotificationSettings from '@/app/profile/notifications';
import { useNotificationSettings } from '@/lib/data/useNotificationSettings';

const OFF = { activity: false, news: { enabled: false, mealTime: false, privacyConsent: null, receiveConsent: null } };
const ON = {
  activity: true,
  news: { enabled: true, mealTime: true, privacyConsent: { version: 1, grantedAt: '2026-09-10T00:00:00' }, receiveConsent: { version: 1, grantedAt: '2026-09-11T00:00:00' } },
};

const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.forEach((tr) => tr.unmount())); trees.length = 0; });
async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<NotificationSettings />); });
  trees.push(tree);
  return tree;
}
const has = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id).length > 0;
const tap = async (tree: ReactTestRenderer, id: string) => {
  const node = tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0];
  expect(node).toBeDefined();
  await act(async () => { node.props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.guest = false;
  mockData.query = { data: undefined, isLoading: false, isError: false, refetch: jest.fn() };
  mockData.update = { mutate: jest.fn(), isError: false, reset: jest.fn() };
  mockAdapter.getPermissionStatus.mockResolvedValue('granted');
});

/* ---------- US1 ---------- */
it('US1(a) 읽는 중 = 스켈레톤, 스위치 0개', async () => {
  mockData.query.isLoading = true;
  const tree = await render();
  expect(has(tree, 'notif-skeleton')).toBe(true);
  expect(has(tree, 'notif-switch')).toBe(false);
});

it('US1(b) 읽기 실패 = 재시도 배너, 탭 = refetch 1회, 스위치 0개', async () => {
  mockData.query.isError = true;
  const tree = await render();
  expect(has(tree, 'notif-switch')).toBe(false);
  await tap(tree, 'notif-read-error');
  expect(mockData.query.refetch).toHaveBeenCalledTimes(1);
});

it('US1(c) 데이터 = 활동·소식·식사 시간 스위치 3개 + 소식 ON일 때만 동의 캡션(최근 일시·수신 동의 버전)', async () => {
  mockData.query.data = ON;
  const tree = await render();
  expect(tree.root.findAll((n) => n.props?.testID === 'notif-switch' && typeof n.type === 'string').length).toBe(3);
  expect(has(tree, 'notif-consent-status')).toBe(true);
  const cap = tree.root.findAll((n) => typeof n.props?.children === 'string' && String(n.props.children).startsWith('notif.consentStatus'))[0];
  expect(cap.props.children).toContain('"version":1');
  expect(cap.props.children).toContain(new Date('2026-09-11T00:00:00').toLocaleDateString('en')); // 두 동의 중 최근
  await tap(tree, 'notif-consent-full');
  expect(mockOpen).toHaveBeenCalledWith('https://team-skyjs.github.io/kbap-legal/marketing-receive.html');
});

it('US1(c2) 소식 OFF = 캡션 없음 + 식사 시간 행 비활성(opacity)', async () => {
  mockData.query.data = OFF;
  const tree = await render();
  expect(has(tree, 'notif-consent-status')).toBe(false);
  const row = tree.root.findAll((n) => n.props?.testID === 'notif-mealtime-row')[0];
  const { StyleSheet } = require('react-native');
  expect(StyleSheet.flatten(row.props.style).opacity).toBe(0.4);
  expect(tree.root.findAll((n) => n.props?.testID === 'notif-mealtime')[0].props.disabled).toBe(true);
});

it('US1(d) 활동 토글 탭 → mutate({activity: !cur}) 1회', async () => {
  mockData.query.data = OFF;
  const tree = await render();
  await tap(tree, 'notif-activity');
  expect(mockData.update.mutate).toHaveBeenCalledTimes(1);
  expect(mockData.update.mutate).toHaveBeenCalledWith({ activity: true });
});

it('US1(e) 저장 실패 = 배너, 탭 = reset', async () => {
  mockData.query.data = OFF;
  mockData.update.isError = true;
  const tree = await render();
  await tap(tree, 'notif-save-failed');
  expect(mockData.update.reset).toHaveBeenCalledTimes(1);
});

it('US1(f) 그룹 라벨 2개 렌더(섹션 설명 없음)', async () => {
  mockData.query.data = OFF;
  const tree = await render();
  const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);
  expect(texts).toContain('notif.activityGroup');
  expect(texts).toContain('notif.newsGroup');
  expect(texts.some((x) => x.endsWith('GroupSub'))).toBe(false);
});

/* ---------- US2 ---------- */
it('US2(a) 소식 OFF에서 소식 토글 탭 → mutate 0회 + 동의 시트 open', async () => {
  mockData.query.data = OFF;
  const tree = await render();
  expect(has(tree, 'notif-sheet-consent')).toBe(false);
  await tap(tree, 'notif-news');
  expect(mockData.update.mutate).not.toHaveBeenCalled();
  expect(has(tree, 'notif-sheet-consent')).toBe(true);
});

it('US2(b) 시트에서 두 동의 체크 + 확인 → mutate({news:{enabled:true, 버전 2종}}) 1회 + 시트 닫힘', async () => {
  mockData.query.data = OFF;
  const tree = await render();
  await tap(tree, 'notif-news');
  await tap(tree, 'consent-privacy');
  await tap(tree, 'notif-sheet-confirm'); // 하나만 체크 = 비활성 → 무동작
  expect(mockData.update.mutate).not.toHaveBeenCalled();
  await tap(tree, 'consent-receive');
  await tap(tree, 'notif-sheet-confirm');
  expect(mockData.update.mutate).toHaveBeenCalledTimes(1);
  expect(mockData.update.mutate).toHaveBeenCalledWith({ news: { enabled: true, privacyConsentVersion: 1, receiveConsentVersion: 1 } });
  expect(has(tree, 'notif-sheet-consent')).toBe(false);
});

it('US2(c) 시트 「나중에」 → mutate 0회, 시트 닫힘', async () => {
  mockData.query.data = OFF;
  const tree = await render();
  await tap(tree, 'notif-news');
  await tap(tree, 'notif-sheet-later');
  expect(mockData.update.mutate).not.toHaveBeenCalled();
  expect(has(tree, 'notif-sheet-consent')).toBe(false);
});

it('US2(d) 소식 ON에서 소식 토글 탭 → 확인 모달(서버 요청 0) → 「알림 끄기」 = mutate({news:{enabled:false}}) — 시트 없음', async () => {
  mockData.query.data = ON;
  const tree = await render();
  await tap(tree, 'notif-news');
  expect(mockData.update.mutate).not.toHaveBeenCalled(); // 이탈 방어: 확인 전 변화 없음
  expect(has(tree, 'notif-off-confirm')).toBe(true);
  await tap(tree, 'notif-off-confirm-cta');
  expect(mockData.update.mutate).toHaveBeenCalledWith({ news: { enabled: false } });
  expect(has(tree, 'notif-sheet-consent')).toBe(false);
  expect(has(tree, 'notif-off-confirm')).toBe(false);
});

it('US2(d2) 확인 모달 「취소」 = mutate 0회, 토글 ON 유지', async () => {
  mockData.query.data = ON;
  const tree = await render();
  await tap(tree, 'notif-news');
  await tap(tree, 'notif-off-cancel');
  expect(mockData.update.mutate).not.toHaveBeenCalled();
  expect(has(tree, 'notif-off-confirm')).toBe(false);
});

it('US2(e) 소식 ON에서 식사 시간 탭 → mutate({news:{mealTime: !cur}}) — enabled 미포함(동의 유지)', async () => {
  mockData.query.data = ON;
  const tree = await render();
  await tap(tree, 'notif-mealtime');
  expect(mockData.update.mutate).toHaveBeenCalledWith({ news: { mealTime: false } });
});

it('US2(f) 소식 OFF에서 식사 시간 탭 → mutate 0회·시트 0회(비활성)', async () => {
  mockData.query.data = OFF;
  const tree = await render();
  const node = tree.root.findAll((n) => n.props?.testID === 'notif-mealtime' && typeof n.props?.onPress === 'function')[0];
  await act(async () => { node.props.onPress(); }); // disabled라도 핸들러 직접 호출 시 무동작 보장
  expect(mockData.update.mutate).not.toHaveBeenCalled();
  expect(has(tree, 'notif-sheet-consent')).toBe(false);
});

/* ---------- US3 ---------- */
it('US3 게스트 = AuthGateSheet(profile)만, 스위치 0개, 설정 조회 비활성', async () => {
  mockSession.guest = true;
  mockData.query.data = ON;
  const tree = await render();
  expect(has(tree, 'auth-gate')).toBe(true);
  expect(has(tree, 'notif-switch')).toBe(false);
  expect((useNotificationSettings as jest.Mock).mock.calls.every((c) => c[0] === false)).toBe(true);
});

/* ---------- US5 ---------- */
it('US5 OS 권한 denied = 배너, 탭 = Linking.openSettings; AppState active = 권한 재조회 + 토큰 등록', async () => {
  mockAdapter.getPermissionStatus.mockResolvedValue('denied');
  const handlers: ((s: string) => void)[] = [];
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => { handlers.push(cb); return { remove: jest.fn() }; }) as never);
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as never);
  mockData.query.data = OFF;
  const tree = await render();
  await tap(tree, 'notif-os-off');
  expect(open).toHaveBeenCalledTimes(1);
  mockAdapter.getPermissionStatus.mockClear();
  act(() => handlers.forEach((h) => h('background')));
  expect(mockAdapter.registerPushToken).not.toHaveBeenCalled();
  act(() => handlers.forEach((h) => h('active')));
  expect(mockAdapter.getPermissionStatus).toHaveBeenCalledTimes(1);
  expect(mockAdapter.registerPushToken).toHaveBeenCalledTimes(1);
  spy.mockRestore();
  open.mockRestore();
});

/* ---------- 소스 잠금 ---------- */
it('설정 화면은 AsyncStorage를 쓰지 않는다(서버 정본) + 동의 체크 행 없음', () => {
  const src = require('fs').readFileSync('src/app/profile/notifications.tsx', 'utf8') as string;
  expect(src).not.toContain('AsyncStorage');
  expect(src).not.toContain('news.enabled:false');
  expect(src).toContain("variant=\"consent\"");
});
