/**
 * KB-499 — 알림함 화면(서버 정본): 3상태(스켈레톤·에러 재시도·빈) · 행 = 서버 문자열 + 상대 시각 ·
 * 탭 = 미읽음만 읽음 뮤테이션 + type/foodId 기반 이동(없으면 알림함 유지) · 게스트 = 로그인 Redirect ·
 * 읽음/미읽음 행 프레임 불변 · 소스 잠금(로컬 스토어·모두 읽음·게이트 시트 부재).
 */
import * as React from 'react';
import { StyleSheet } from 'react-native';
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
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: () => 0, linear: () => 0, inOut: () => () => 0, cubic: () => 0 },
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
const mockNavigate = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const R = require('react');
  return {
    useSegments: () => ['notifications'],
    useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn(), navigate: mockNavigate, canDismiss: () => false, dismissAll: jest.fn() }), // KB-573: 항목 탭은 lib/nav 헬퍼 경유(navigate) — push 0
    usePathname: () => '/notifications',
    useFocusEffect: () => {},
    Redirect: (p: { href: string }) => R.createElement('Redirect', p),
  };
});
const mockT = jest.fn((k: string, o?: { count?: number }) => (o?.count != null ? `${k}:${o.count}` : k));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn(), EVENTS: { error_state_view: 'error_state_view' } }));

let mockGuest = false;
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockGuest, useSession: () => (mockGuest ? false : true) }));

type Item = { id: number; title: string; body: string; at: string; read: boolean; type?: string; foodId?: string };
const mockInbox = {
  data: undefined as Item[] | undefined,
  isPending: false,
  isError: false,
  error: null as unknown,
  refetch: jest.fn(),
};
const mockMutate = jest.fn();
jest.mock('@/lib/data/useNotifications', () => ({
  useInbox: () => ({ ...mockInbox }),
  useUnreadCount: () => (mockInbox.data ?? []).filter((i) => !i.read).length,
  useMarkRead: () => ({ mutate: mockMutate }),
}));

import Notifications from '../notifications';
import { routeForNotificationData } from '@/lib/push/pushAdapter';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const items: Item[] = [
  { id: 1, title: '서버 제목 1', body: '서버 본문 1', at: ago(5 * 60_000), read: false },
  { id: 2, title: '서버 제목 2', body: '서버 본문 2', at: ago(3 * 3_600_000), read: true },
];

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Notifications />);
  });
  return tree;
}
const byId = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
const press = (tree: ReactTestRenderer, id: string) =>
  act(() => tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0].props.onPress());
const byIdPrefix = (tree: ReactTestRenderer, p: string) => tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith(p) && typeof n.type === 'string');
const texts = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.type === 'Text').map((n) => String(n.props.children));

beforeEach(() => {
  jest.clearAllMocks();
  mockGuest = false;
  mockInbox.data = items;
  mockInbox.isPending = false;
  mockInbox.isError = false;
  mockInbox.error = null;
});

it('① isPending → 스켈레톤만(행·빈 상태 0)', () => {
  mockInbox.data = undefined;
  mockInbox.isPending = true;
  const tree = render();
  expect(byId(tree, 'skeleton-inbox').length).toBe(1);
  expect(byIdPrefix(tree, 'inbox-').length).toBe(0);
  expect(byId(tree, 'notif-empty').length).toBe(0);
});

it('② isError && !data → 공용 에러 블록, 재시도 = refetch 1회', () => {
  mockInbox.data = undefined;
  mockInbox.isError = true;
  mockInbox.error = new Error('NETWORK: down');
  const tree = render();
  expect(byId(tree, 'query-error-block').length).toBe(1);
  expect(byIdPrefix(tree, 'inbox-').length).toBe(0);
  const retry = tree.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .find((n) => n.findAll((c) => c.props?.children === 'common.retry').length > 0);
  expect(retry).toBeTruthy();
  act(() => retry!.props.onPress());
  expect(mockInbox.refetch).toHaveBeenCalledTimes(1);
});

it('③ data [] → 빈 상태(notif-empty), 스켈레톤·에러 0', () => {
  mockInbox.data = [];
  const tree = render();
  expect(byId(tree, 'notif-empty').length).toBe(1);
  expect(byId(tree, 'skeleton-inbox').length).toBe(0);
  expect(byId(tree, 'query-error-block').length).toBe(0);
});

it('④ 행 — 서버 title/body 문자열 그대로(t 미경유) + 상대 시각 5분 전·3시간 전', () => {
  const tree = render();
  expect(byId(tree, 'inbox-1').length).toBe(1);
  expect(byId(tree, 'inbox-2').length).toBe(1);
  const all = texts(tree);
  expect(all).toEqual(expect.arrayContaining(['서버 제목 1', '서버 본문 1', '서버 제목 2', '서버 본문 2']));
  expect(mockT).not.toHaveBeenCalledWith('서버 제목 1');
  expect(all).toEqual(expect.arrayContaining(['community.minsAgo:5', 'community.hoursAgo:3']));
  expect(mockT).not.toHaveBeenCalledWith('reviews.today'); // 구 relativeDate 소멸
});

it('⑨⑩⑪ 탭 — 미읽음만 mutate · type 없음 = 이동 0 · REVIEW_REMINDER+foodId = /food/7 · NEWS = 이동 0 · HELPFUL = 푸시 규칙과 동일', () => {
  mockInbox.data = [
    ...items,
    { id: 3, title: 'r', body: 'r', at: ago(1000), read: false, type: 'REVIEW_REMINDER', foodId: '7' },
    { id: 4, title: 'n', body: 'n', at: ago(1000), read: false, type: 'NEWS' },
    { id: 5, title: 'h', body: 'h', at: ago(1000), read: true, type: 'HELPFUL' },
  ];
  const tree = render();
  press(tree, 'inbox-1');
  expect(mockMutate).toHaveBeenCalledWith(1);
  expect(mockNavigate).not.toHaveBeenCalled(); // type 없음 → 알림함 유지
  press(tree, 'inbox-2'); // 읽음 항목
  expect(mockMutate).toHaveBeenCalledTimes(1);
  press(tree, 'inbox-3');
  expect(mockMutate).toHaveBeenLastCalledWith(3);
  expect(mockNavigate).toHaveBeenLastCalledWith('/food/7');
  press(tree, 'inbox-4');
  expect(mockMutate).toHaveBeenLastCalledWith(4);
  expect(mockNavigate).toHaveBeenCalledTimes(1); // NEWS 이동 없음
  press(tree, 'inbox-5'); // 읽음 + HELPFUL: mutate 0, 이동은 규칙대로
  expect(mockMutate).toHaveBeenCalledTimes(3);
  expect(mockNavigate).toHaveBeenLastCalledWith(routeForNotificationData({ type: 'HELPFUL' }));
});

it('⑫ 프레임 불변 — 읽음/미읽음 행은 backgroundColor만 다르고 점은 미읽음에만', () => {
  const tree = render();
  const flat = (id: string) => ({ ...(StyleSheet.flatten(byId(tree, id)[0].props.style) as Record<string, unknown>) });
  const a = flat('inbox-1');
  const b = flat('inbox-2');
  expect(a.backgroundColor).toBe('rgba(255,113,52,0.05)'); // primaryTint
  expect(b.backgroundColor).not.toBe('rgba(255,113,52,0.05)');
  delete a.backgroundColor;
  delete b.backgroundColor;
  expect(a).toEqual(b);
  expect(byId(tree, 'unread-1').length).toBe(1);
  expect(byId(tree, 'unread-2').length).toBe(0);
});

it('⑬ 게스트 — 로그인 Redirect(returnTo=/notifications), 알림함 어떤 표면도 렌더 0', () => {
  mockGuest = true;
  const tree = render();
  const redirects = tree.root.findAll((n) => n.type === 'Redirect');
  expect(redirects.length).toBe(1);
  expect(redirects[0].props.href).toBe('/login?returnTo=%2Fnotifications&entry=other');
  expect(byIdPrefix(tree, 'inbox-').length).toBe(0);
  expect(byId(tree, 'skeleton-inbox').length).toBe(0);
  expect(byId(tree, 'query-error-block').length).toBe(0);
  expect(byId(tree, 'notif-empty').length).toBe(0);
  expect(texts(tree)).not.toContain('inbox.title');
});

it('⑤ 소스 잠금 — 로컬 스토어·모두 읽음·구 상대 시각·게이트 시트 부재, timeAgo·routeForNotificationData·returnTo 존재', () => {
  const fs = require('fs') as typeof import('fs');
  const src = fs.readFileSync('src/app/notifications.tsx', 'utf8');
  for (const bad of ['notifications/inbox', 'markAllInboxRead', 'inbox-mark-all', 'relativeDate', 'AuthGateSheet', 'reviews.today']) {
    expect({ bad, present: src.includes(bad) }).toEqual({ bad, present: false });
  }
  for (const good of ['timeAgo(', 'routeForNotificationData(', 'returnTo', "useInbox()", 'useMarkRead()', 'SkeletonInbox', 'QueryErrorBlock']) {
    expect({ good, present: src.includes(good) }).toEqual({ good, present: true });
  }
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8');
  expect(layout).toContain('onPushTapped(');
  expect(layout).toContain('invalidateNotifications()');
  const push = fs.readFileSync('src/lib/push/pushAdapter.ts', 'utf8');
  expect(push).not.toContain('recordInboxNotification');
  expect(push).toContain('invalidateNotifications()');
});
