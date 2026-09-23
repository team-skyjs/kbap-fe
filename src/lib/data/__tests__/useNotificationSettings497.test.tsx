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
const trees: ReturnType<typeof renderer.create>[] = [];
const qcFactory = () => { const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } }); clients.push(qc); return qc; };
// 이전 테스트의 Harness가 남아 재렌더 시 latestMutate를 옛 클라이언트로 덮어쓰던 순서 의존(KB-553 직렬화 유닛에서 발현) — 언마운트로 차단
afterEach(() => { act(() => { while (trees.length) trees.pop()!.unmount(); }); while (clients.length) clients.pop()!.clear(); });
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
    trees.push(renderer.create(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>,
    ));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
/** 조건 충족까지 tick 반복(최대 50) — 전체 스위트 부하에서 mutation 콜백 반영이 한 tick 늦는 플레이키 방지 */
const until = async (cond: () => boolean, label = '') => {
  for (let i = 0; i < 50 && !cond(); i++) await tick();
  expect({ label, ok: cond(), patchCalls: (api.patch as jest.Mock).mock.calls.length }).toMatchObject({ ok: true });
};

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

// KB-553(9/14 실기 깜빡임): 낙관 예측은 요청에 담긴 값만 앞서간다 — 요청에 없는 mealTime을 true로 예측하면
// 서버 응답(저장값 false)에서 되돌아가 토글이 깜빡인다. 동의 기록은 consent:true(KB-544 계약).
it('predictSettings: enabled:true만 → mealTime 무변 · consent:true → 동의 2종 예측 · 동의 확정 풀 페이로드 → 전부 ON', () => {
  const { predictSettings } = require('../useNotificationSettings') as typeof import('../useNotificationSettings');
  const off = { activity: false, news: { enabled: false, mealTime: false, privacyConsent: null, receiveConsent: null } };
  const a = predictSettings(off, { news: { enabled: true } });
  expect(a.news.enabled).toBe(true);
  expect(a.news.mealTime).toBe(false); // 요청에 없음 → 예측도 하지 않는다
  expect(a.news.privacyConsent).toBeNull();
  const b = predictSettings(off, { news: { consent: true, privacyConsentVersion: 1, receiveConsentVersion: 1, enabled: true, mealTime: true } });
  expect(b.news).toMatchObject({ enabled: true, mealTime: true, privacyConsent: { version: 1 }, receiveConsent: { version: 1 } });
  const c = predictSettings(b, { news: { enabled: false } });
  expect(c.news).toMatchObject({ enabled: false, mealTime: false, privacyConsent: { version: 1 } }); // 동의는 유지
});

// KB-553(9/14 실기): 동의 확정 응답 전 식사 시간 OFF 탭 → 두 PATCH가 서버에 병렬 도착하면 뒤 요청이 반영 전 행으로
// 응답(enabled:false)해 소식 토글이 꺼져 보였다. 요청은 앞 요청이 끝난 뒤에만 보낸다 — 낙관 표시는 즉시.
it('PATCH 직렬화: 앞 요청이 끝나기 전엔 다음 PATCH를 보내지 않는다 · 낙관 표시는 즉시 · 최종 캐시 = 마지막 응답', async () => {
  const qc = qcFactory();
  (api.get as jest.Mock).mockResolvedValue(OFF);
  const d1 = deferred<NotificationSettings>();
  const d2 = deferred<NotificationSettings>();
  (api.patch as jest.Mock).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
  await mount(qc);
  act(() => latestMutate!({ news: { consent: true, privacyConsentVersion: 1, receiveConsentVersion: 1, enabled: true, mealTime: true } }));
  await tick();
  act(() => latestMutate!({ news: { mealTime: false } }));
  await tick();
  expect(api.patch).toHaveBeenCalledTimes(1); // 두 번째는 대기
  const optimistic = qc.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY)!;
  expect(optimistic.news).toMatchObject({ enabled: true, mealTime: false }); // 낙관: 소식 ON 유지·식사 시간 OFF
  const afterFirst: NotificationSettings = { ...ON, news: { ...ON.news, mealTime: true } };
  await act(async () => { d1.resolve(afterFirst); });
  await until(() => (api.patch as jest.Mock).mock.calls.length === 2); // 앞 요청 완료 후에 전송
  expect((api.patch as jest.Mock).mock.calls[1][1]).toEqual({ news: { mealTime: false } });
  expect(qc.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY)!.news.enabled).toBe(true); // 1번 응답은 최신이 아니라 무시(낙관 유지)
  const afterSecond: NotificationSettings = { ...ON, news: { ...ON.news, mealTime: false } };
  await act(async () => { d2.resolve(afterSecond); });
  await until(() => qc.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY)?.news.mealTime === false);
  expect(qc.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY)!.news).toMatchObject({ enabled: true, mealTime: false });
});

it('PATCH 직렬화: 앞 요청이 실패해도 다음 요청은 전송된다', async () => {
  const qc = qcFactory();
  (api.get as jest.Mock).mockResolvedValue(ON);
  const d1 = deferred<NotificationSettings>();
  (api.patch as jest.Mock).mockReturnValueOnce(d1.promise).mockResolvedValueOnce({ ...ON, news: { ...ON.news, mealTime: false } });
  await mount(qc);
  act(() => latestMutate!({ activity: false }));
  await tick();
  act(() => latestMutate!({ news: { mealTime: false } }));
  await tick();
  expect(api.patch).toHaveBeenCalledTimes(1);
  await act(async () => { d1.reject(new Error('500')); });
  await until(() => (api.patch as jest.Mock).mock.calls.length === 2, 'second patch sent after failure');
  await until(() => qc.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY)?.news.mealTime === false, 'cache mealTime false');
});

// Codex 리뷰(#150) Important 1: 큐 대기 중 계정 전환 → 대기 요청은 전송하지 않고, 이전 계정 값을 캐시에 되살리지 않는다.
it('PATCH 큐: 대기 중 세션 세대가 바뀌면(로그아웃·계정 전환) 전송 0 · 캐시 재시딩 0', async () => {
  const { bumpSessionGen } = require('@/lib/auth/beTokens') as typeof import('@/lib/auth/beTokens');
  const qc = qcFactory();
  (api.get as jest.Mock).mockResolvedValue(ON);
  const d1 = deferred<NotificationSettings>();
  (api.patch as jest.Mock).mockReturnValueOnce(d1.promise).mockResolvedValue(OFF);
  await mount(qc);
  act(() => latestMutate!({ activity: false }));
  await tick();
  act(() => latestMutate!({ news: { mealTime: false } })); // 큐 대기
  await tick();
  expect(api.patch).toHaveBeenCalledTimes(1);
  bumpSessionGen(); // 계정 경계 — 인증 경계는 queryClient.clear()도 함께 한다
  qc.clear();
  await act(async () => { d1.resolve({ ...ON, activity: false }); });
  await until(() => qc.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY) != null); // clear 뒤 GET 재조회 도착
  await tick(); await tick();
  expect(api.patch).toHaveBeenCalledTimes(1); // 대기 요청은 폐기
  // clear 뒤 마운트된 관찰자가 GET을 다시 받는다(ON, activity:true) — 1번 응답(activity:false)·롤백 어느 쪽도 그 위에 쓰지 않음
  expect(qc.getQueryData<NotificationSettings>(NOTIF_SETTINGS_KEY)?.activity).toBe(true);
});

it('Codex #150 P1: onMutate는 동기(cancelQueries await 없음) — 세대 캡처와 mutationFn 전송이 같은 틱(소스 잠금)', () => {
  const src = require('fs').readFileSync('src/lib/data/useNotificationSettings.ts', 'utf8') as string;
  expect(src).toContain('void qc.cancelQueries(');
  expect(src).not.toContain('await qc.cancelQueries(');
  expect(src).toMatch(/onMutate: \(patch\) => \{/);
});
