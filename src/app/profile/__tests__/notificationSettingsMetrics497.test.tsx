/**
 * KB-497 — P-151 프레임 불변: Switch on/off · 식사 시간 행 활성/비활성 · 캡션 유무에서
 * 레이아웃 메트릭(width·height·padding·borderWidth·borderRadius)이 같아야 한다. 상태 = 색·불투명도만.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View, createAnimatedComponent: (c: unknown) => c }, useSharedValue: (v: unknown) => ({ value: v }), useAnimatedStyle: () => ({}), withSpring: (v: unknown) => v, withTiming: (v: unknown) => v, withRepeat: (v: unknown) => v, cancelAnimation: () => {}, interpolate: () => 0, Easing: { out: () => () => 0, inOut: () => () => 0, quad: 0, linear: () => 0 } };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), Redirect: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en', languageCode: 'en' }] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/AuthGateSheet', () => ({ AuthGateSheet: () => null }));
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => false }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn(), EVENTS: { push_pref_toggle: 'x' } }));
jest.mock('@/lib/openExternal', () => ({ openWebPage: jest.fn() }));
jest.mock('@/lib/push/pushAdapter', () => ({ getPermissionStatus: jest.fn().mockResolvedValue('granted'), registerPushToken: jest.fn().mockResolvedValue(undefined) }));
const mockData = { data: undefined as unknown };
jest.mock('@/lib/data/useNotificationSettings', () => ({
  useNotificationSettings: () => ({ data: mockData.data, isLoading: false, isError: false, refetch: jest.fn() }),
  useUpdateNotificationSettings: () => ({ mutate: jest.fn(), isError: false, reset: jest.fn() }),
  NOTIF_SETTINGS_KEY: ['notifSettings'],
}));

import NotificationSettings from '@/app/profile/notifications';

const OFF = { activity: false, news: { enabled: false, mealTime: false, privacyConsent: null, receiveConsent: null } };
const ON = { activity: true, news: { enabled: true, mealTime: true, privacyConsent: { version: 1, grantedAt: '2026-09-11T00:00:00' }, receiveConsent: { version: 1, grantedAt: '2026-09-11T00:00:00' } } };
const KEYS = ['width', 'height', 'paddingVertical', 'paddingHorizontal', 'padding', 'borderWidth', 'borderRadius', 'gap', 'marginBottom'] as const;
const metrics = (st: unknown) => { const f = StyleSheet.flatten(st as never) as Record<string, unknown>; return Object.fromEntries(KEYS.map((k) => [k, f[k]])); };

const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.forEach((t) => t.unmount())); trees.length = 0; });
async function renderWith(data: unknown) {
  mockData.data = data;
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<NotificationSettings />); });
  trees.push(tree);
  return tree;
}
const hosts = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');

it('Switch on/off — 트랙·노브 메트릭 동일(색만)', async () => {
  const on = await renderWith(ON), off = await renderWith(OFF);
  const swOn = hosts(on, 'notif-switch'), swOff = hosts(off, 'notif-switch');
  expect(swOn).toHaveLength(3); expect(swOff).toHaveLength(3);
  for (let i = 0; i < 3; i++) {
    expect(metrics(swOn[i].props.style)).toEqual(metrics(swOff[i].props.style));
    expect(metrics(swOn[i].children[0] && (swOn[i].children[0] as { props: { style: unknown } }).props.style))
      .toEqual(metrics((swOff[i].children[0] as { props: { style: unknown } }).props.style));
  }
});

it('식사 시간 행 활성/비활성 — 래퍼는 opacity만 다르고 행 메트릭 동일', async () => {
  const on = await renderWith(ON), off = await renderWith(OFF);
  const rowOn = hosts(on, 'notif-mealtime')[0], rowOff = hosts(off, 'notif-mealtime')[0];
  expect(metrics(rowOn.props.style)).toEqual(metrics(rowOff.props.style));
  const wrapOn = StyleSheet.flatten(hosts(on, 'notif-mealtime-row')[0].props.style) as Record<string, unknown>;
  const wrapOff = StyleSheet.flatten(hosts(off, 'notif-mealtime-row')[0].props.style) as Record<string, unknown>;
  expect(wrapOn.opacity ?? 1).toBe(1);
  expect(wrapOff.opacity).toBe(0.4);
  expect(Object.keys(wrapOff).filter((k) => k !== 'opacity')).toEqual([]);
});

it('캡션 유무 — 활동·소식 행 메트릭 동일(캡션은 별도 블록)', async () => {
  const on = await renderWith(ON), off = await renderWith(OFF);
  for (const id of ['notif-activity', 'notif-news']) {
    expect(metrics(hosts(on, id)[0].props.style)).toEqual(metrics(hosts(off, id)[0].props.style));
  }
});
