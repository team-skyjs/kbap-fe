/**
 * KB-497 — 알림 설정 서버 정본 훅: GET 캐시 · PATCH 낙관 반영 · 실패 롤백 · 최신 응답만
 * 반영(seq) · 엔드포인트 한정 X-API-Version 헤더 · 계정 전환(clear) 시 캐시 소멸.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn(), patch: jest.fn() }, apiLang: () => 'en' }));
const consentMock = { NOTIF_SETTINGS_API_VERSION: null as string | null, PRIVACY_CONSENT_VERSION: 1, RECEIVE_CONSENT_VERSION: 1 };
jest.mock('@/lib/push/consent', () => consentMock);

import { api } from '@/lib/api/client';
import {
  NOTIF_SETTINGS_KEY,
  patchNotificationSettings,
  useNotificationSettings,
  useUpdateNotificationSettings,
  type NotificationSettings,
  type NotificationSettingsPatch,
} from '@/lib/data/useNotificationSettings';

const OFF: NotificationSettings = { activity: false, news: { enabled: false, mealTime: false, privacyConsent: null, receiveConsent: null } };
const ON: NotificationSettings = {
  activity: true,
  news: { enabled: true, mealTime: true, privacyConsent: { version: 1, grantedAt: '2026-09-11T00:00:00' }, receiveConsent: { version: 1, grantedAt: '2026-09-11T00:00:00' } },
};

const clients: QueryClient[] = [];
const qcFactory = () => { const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } }); clients.push(qc); return qc; };
afterEach(() => { while (clients.length) clients.pop()!.clear(); });
type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
const deferred = <T,>(): Deferred<T> => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

let latestMutate: ((p: NotificationSettingsPatch) => void) | null = null;
let latestQuery: ReturnType<typeof useNotificationSettings> | null = null;
function Harness() {
  latestQuery = useNotificationSettings();
  const m = useUpdateNotificationSettings();
  latestMutate = (p) => m.mutate(p);
  return null;
}
async function mount(qc: QueryClient) {
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  jest.clearAllMocks();
  consentMock.NOTIF_SETTINGS_API_VERSION = null;
  (api.get as jest.Mock).mockResolvedValue(OFF);
});

it('(a) GET 응답이 그대로 캐시에 들어간다', async () => {
  const qc = qcFactory();
  await mount(qc);
  expect(api.get).toHaveBeenCalledWith('/api/notifications/settings', undefined);
  expect(qc.getQueryData(NOTIF_SETTINGS_KEY)).toEqual(OFF);
  expect(latestQuery?.data).toEqual(OFF);
});

it('(b) PATCH 낙관 반영 → 서버 응답 전체로 교체', async () => {
  const qc = qcFactory();
  await mount(qc);
  const d = deferred<NotificationSettings>();
  (api.patch as jest.Mock).mockReturnValueOnce(d.promise);
  act(() => latestMutate!({ activity: true }));
  await tick();
  expect((qc.getQueryData(NOTIF_SETTINGS_KEY) as NotificationSettings).activity).toBe(true); // 낙관
  expect(api.patch).toHaveBeenCalledWith('/api/notifications/settings', { activity: true }, undefined);
  const server = { ...ON, news: { ...ON.news, enabled: false, mealTime: false, privacyConsent: null, receiveConsent: null } };
  d.resolve(server);
  await tick();
  expect(qc.getQueryData(NOTIF_SETTINGS_KEY)).toEqual(server);
});

it('(c) PATCH 실패 → 스냅샷 롤백 + error 노출', async () => {
  const qc = qcFactory();
  await mount(qc);
  (api.patch as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('NOTIFICATION-001'), { status: 400 }));
  let mutation!: ReturnType<typeof useUpdateNotificationSettings>;
  function H2() { mutation = useUpdateNotificationSettings(); return null; }
  await act(async () => { renderer.create(<QueryClientProvider client={qc}><H2 /></QueryClientProvider>); });
  act(() => mutation.mutate({ news: { mealTime: true } }));
  await tick();
  await tick();
  expect(qc.getQueryData(NOTIF_SETTINGS_KEY)).toEqual(OFF); // 롤백
  expect(mutation.isError).toBe(true);
});

it('(d) 연타: 늦게 도착한 첫 응답은 무시되고 마지막 응답만 반영된다', async () => {
  const qc = qcFactory();
  await mount(qc);
  const d1 = deferred<NotificationSettings>(), d2 = deferred<NotificationSettings>();
  (api.patch as jest.Mock).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
  act(() => latestMutate!({ activity: true }));
  await tick();
  act(() => latestMutate!({ activity: false }));
  await tick();
  d2.resolve({ ...OFF, activity: false });
  await tick();
  d1.resolve({ ...OFF, activity: true }); // 스테일
  await tick();
  expect((qc.getQueryData(NOTIF_SETTINGS_KEY) as NotificationSettings).activity).toBe(false);
});

it('(d2) 훅 밖 patchNotificationSettings도 같은 seq를 공유한다 — 프라이머 응답 지연 중 사용자가 끈 값을 되돌리지 않음', async () => {
  const qc = qcFactory();
  await mount(qc);
  const d1 = deferred<NotificationSettings>(), d2 = deferred<NotificationSettings>();
  (api.patch as jest.Mock).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
  const primer = patchNotificationSettings({ activity: true }, qc); // 프라이머(훅 밖)
  await tick();
  act(() => latestMutate!({ activity: false })); // 설정 화면에서 끔
  await tick();
  d2.resolve({ ...OFF, activity: false });
  await tick();
  d1.resolve({ ...OFF, activity: true });
  await primer;
  await tick();
  expect((qc.getQueryData(NOTIF_SETTINGS_KEY) as NotificationSettings).activity).toBe(false);
});

it('(e) NOTIF_SETTINGS_API_VERSION 문자열이면 GET/PATCH에 엔드포인트 한정 헤더, null이면 오버라이드 없음', async () => {
  consentMock.NOTIF_SETTINGS_API_VERSION = '2.1';
  const qc = qcFactory();
  await mount(qc);
  expect(api.get).toHaveBeenCalledWith('/api/notifications/settings', { headers: { 'X-API-Version': '2.1' } });
  (api.patch as jest.Mock).mockResolvedValueOnce(OFF);
  act(() => latestMutate!({ activity: true }));
  await tick();
  expect(api.patch).toHaveBeenCalledWith('/api/notifications/settings', { activity: true }, { headers: { 'X-API-Version': '2.1' } });
});

it('(f) 계정 전환(queryClient.clear) 후 캐시가 없다', async () => {
  const qc = qcFactory();
  await mount(qc);
  expect(qc.getQueryData(NOTIF_SETTINGS_KEY)).toBeDefined();
  qc.clear();
  expect(qc.getQueryData(NOTIF_SETTINGS_KEY)).toBeUndefined();
});
