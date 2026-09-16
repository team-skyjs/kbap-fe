/**
 * KB-499 — 알림함 서버 정본 훅: 어댑터 변환 · 목록/미읽음 파생 · 세션 확정 true만 요청 · 읽음 낙관/롤백 ·
 * 세션 세대 가드(계정 전환 중 이전 계정 목록 부활 금지) · 푸시 탭 읽음(onPushTapped) · 두 요청 X-Installation-Id 헤더.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn(), patch: jest.fn() }, apiLang: () => 'en' }));
jest.mock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: jest.fn() } }));

import { api } from '@/lib/api/client';
import { queryClient as mockSharedQcImport } from '@/lib/queryClient';
const mockSharedQc = mockSharedQcImport as unknown as { invalidateQueries: jest.Mock };
import { hasBeSession } from '@/lib/auth/beAuth';
import { bumpSessionGen } from '@/lib/auth/beTokens';
import { _resetSessionForTest, initSessionState, setSessionState } from '@/lib/auth/useSession';
import { toInboxItem, type NotificationWire } from '@/lib/api/notificationAdapter';
import {
  NOTIFICATIONS_KEY,
  fetchNotifications,
  onPushTapped,
  useInbox,
  useMarkRead,
  useUnreadCount,
} from '@/lib/data/useNotifications';

const wire = (id: number, read: boolean, extra: Partial<NotificationWire> = {}): NotificationWire => ({
  id,
  title: `t${id}`,
  body: `b${id}`,
  receivedAt: 1789540000000 - id * 1000,
  read,
  ...extra,
});

const clients: QueryClient[] = [];
const trees: ReturnType<typeof renderer.create>[] = [];
const qcFactory = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  clients.push(qc);
  return qc;
};
afterEach(() => {
  act(() => {
    while (trees.length) trees.pop()!.unmount();
  });
  while (clients.length) clients.pop()!.clear();
  _resetSessionForTest();
});
type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
const deferred = <T,>(): Deferred<T> => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

let latestInbox: ReturnType<typeof useInbox> | null = null;
let latestUnread = -1;
let latestMutate: ((id: number) => void) | null = null;
function Harness() {
  latestInbox = useInbox();
  latestUnread = useUnreadCount();
  const m = useMarkRead();
  latestMutate = (id) => m.mutate(id);
  return null;
}
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function mount(qc: QueryClient) {
  await act(async () => {
    trees.push(renderer.create(<QueryClientProvider client={qc}><Harness /></QueryClientProvider>));
  });
  await tick();
}
const until = async (cond: () => boolean, label = '') => {
  for (let i = 0; i < 50 && !cond(); i++) await tick();
  expect({ label, ok: cond() }).toMatchObject({ ok: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  _resetSessionForTest();
  (api.get as jest.Mock).mockResolvedValue([wire(1, false), wire(2, false), wire(3, true)]);
});

it('① 어댑터 — 5필드 변환 + at ISO · receivedAt 비정상 = 현재 시각 · type/foodId 옵션(문자열 정규화)', () => {
  const base = toInboxItem(wire(1, false, { receivedAt: 1789540000000 }));
  expect(base).toEqual({ id: 1, title: 't1', body: 'b1', at: new Date(1789540000000).toISOString(), read: false, type: undefined, foodId: undefined });
  expect(Number.isNaN(Date.parse(toInboxItem(wire(2, true, { receivedAt: Number.NaN })).at))).toBe(false);
  expect(toInboxItem(wire(3, false, { type: 'REVIEW_REMINDER', foodId: 7 }))).toMatchObject({ type: 'REVIEW_REMINDER', foodId: '7' });
  expect(toInboxItem(wire(4, false, { type: 'NEWS', foodId: null })).foodId).toBeUndefined();
});

it('② 목록·미읽음 파생 — 세션 true: GET 1회(/api/notifications), 순서 그대로, unread = read===false 개수', async () => {
  initSessionState(true);
  const qc = qcFactory();
  await mount(qc);
  await until(() => (latestInbox?.data?.length ?? 0) === 3, 'loaded');
  expect((api.get as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['/api/notifications']);
  expect(latestInbox!.data!.map((i) => i.id)).toEqual([1, 2, 3]);
  expect(latestUnread).toBe(2);
});

it('③ 세션 게이트 — null·false = 요청 0·배지 0, true 확정 시 fetch 1회', async () => {
  const qc = qcFactory();
  await mount(qc); // session null(부팅 미확정)
  await tick();
  expect(api.get).not.toHaveBeenCalled();
  expect(latestUnread).toBe(0);
  act(() => initSessionState(false)); // 게스트 확정
  await tick();
  expect(api.get).not.toHaveBeenCalled();
  expect(latestUnread).toBe(0);
  act(() => setSessionState(true)); // 로그인 경계
  await until(() => latestUnread === 2, 'member');
  expect(api.get).toHaveBeenCalledTimes(1);
});

it('⑤⑥ 읽음 낙관 → 실패 롤백 / 성공 시 응답 교체, 둘 다 onSettled 재조회', async () => {
  initSessionState(true);
  const qc = qcFactory();
  await mount(qc);
  await until(() => latestUnread === 2);
  // 실패
  const d1 = deferred<NotificationWire>();
  (api.patch as jest.Mock).mockReturnValueOnce(d1.promise);
  act(() => latestMutate!(1));
  await tick();
  expect(latestUnread).toBe(1); // 낙관 즉시
  expect(qc.getQueryData<{ id: number; read: boolean }[]>(NOTIFICATIONS_KEY)!.find((i) => i.id === 1)!.read).toBe(true);
  expect(api.patch).toHaveBeenCalledWith('/api/notifications/1/read');
  const getsBefore = (api.get as jest.Mock).mock.calls.length;
  d1.reject(new Error('NETWORK: down'));
  await until(() => latestUnread === 2, 'rollback');
  await until(() => (api.get as jest.Mock).mock.calls.length > getsBefore, 'refetch after error');
  // 성공
  const d2 = deferred<NotificationWire>();
  (api.patch as jest.Mock).mockReturnValueOnce(d2.promise);
  act(() => latestMutate!(2));
  await tick();
  expect(latestUnread).toBe(1);
  const getsBefore2 = (api.get as jest.Mock).mock.calls.length;
  (api.get as jest.Mock).mockResolvedValue([wire(1, false), wire(2, true), wire(3, true)]); // 서버도 읽음 반영
  d2.resolve(wire(2, true));
  await until(() => (api.get as jest.Mock).mock.calls.length > getsBefore2, 'refetch after success');
  await until(() => latestUnread === 1, 'stays read');
});

it('⑦ 세션 세대 가드 — 뮤테이션 중 계정 경계(gen bump + clear) 후 실패해도 이전 목록을 캐시에 되살리지 않는다', async () => {
  initSessionState(true);
  const qc = qcFactory();
  await mount(qc);
  await until(() => latestUnread === 2);
  const d = deferred<NotificationWire>();
  (api.patch as jest.Mock).mockReturnValueOnce(d.promise);
  act(() => latestMutate!(1));
  await tick();
  // 경계: 로그아웃(세대 증가 + 캐시 소멸 + 세션 false → 쿼리 비활성이라 재조회도 없음)
  bumpSessionGen();
  qc.clear();
  act(() => setSessionState(false));
  await tick();
  d.reject(new Error('late failure'));
  await tick();
  await tick();
  expect(qc.getQueryData(NOTIFICATIONS_KEY)).toBeUndefined();
  expect(latestUnread).toBe(0);
});

it('④ 이미 읽은 항목 — 훅은 호출자가 걸러야 하므로 계약만: 읽음 항목 PATCH도 멱등(200)으로 응답 교체 없이 유지', async () => {
  initSessionState(true);
  const qc = qcFactory();
  await mount(qc);
  await until(() => latestUnread === 2);
  (api.patch as jest.Mock).mockResolvedValue(wire(3, true));
  act(() => latestMutate!(3));
  await tick();
  expect(latestUnread).toBe(2); // 변화 없음
});

it('⑧ onPushTapped — 회원: PATCH + 공유 클라이언트 invalidate · 문자열 id 허용 · 게스트/없음/비수치 = 0', async () => {
  (hasBeSession as jest.Mock).mockResolvedValue(true);
  (api.patch as jest.Mock).mockResolvedValue(wire(7, true));
  await onPushTapped(7);
  expect(api.patch).toHaveBeenCalledWith('/api/notifications/7/read');
  expect(mockSharedQc.invalidateQueries).toHaveBeenCalledWith({ queryKey: NOTIFICATIONS_KEY });
  await onPushTapped('9');
  expect(api.patch).toHaveBeenLastCalledWith('/api/notifications/9/read');
  // 실패도 비치명 + 재조회
  (api.patch as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('404'), { status: 404 }));
  await expect(onPushTapped(11)).resolves.toBeUndefined();
  expect(mockSharedQc.invalidateQueries).toHaveBeenCalledTimes(3);
  jest.clearAllMocks();
  (hasBeSession as jest.Mock).mockResolvedValue(false);
  await onPushTapped(7);
  await onPushTapped(undefined);
  await onPushTapped('abc');
  expect(api.patch).not.toHaveBeenCalled();
  expect(mockSharedQc.invalidateQueries).not.toHaveBeenCalled();
});

it('④ 헤더 단언(DoD) — 실클라이언트: GET /api/notifications · PATCH /api/notifications/{id}/read 모두 X-Installation-Id 부착', async () => {
  process.env.EXPO_PUBLIC_BE_BASE = 'https://dev.kbap.site';
  const calls: { url: string; init: { method: string; headers: Record<string, string> } }[] = [];
  const fetchMock = jest.fn((url: string, init: { method: string; headers: Record<string, string> }) => {
    calls.push({ url, init });
    const payload = init.method === 'GET' ? [wire(1, false)] : wire(3, true);
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ success: true, payload, message: null })) } as unknown as Response);
  });
  let fetchFn: typeof fetchNotifications, markFn: (id: number) => Promise<unknown>;
  jest.isolateModules(() => {
    jest.doMock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => false }));
    jest.doMock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
    jest.doMock('@/lib/installationId', () => ({ getInstallationId: jest.fn().mockResolvedValue('uuid-fixed-0001') }));
    jest.doMock('@/lib/auth/beAuth', () => ({ hasBeSession: jest.fn() }));
    jest.doMock('@/lib/auth/beTokens', () => ({ currentGen: () => 0 }));
    jest.doMock('@/lib/auth/useSession', () => ({ useSession: () => true }));
    jest.doMock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: jest.fn() } }));
    jest.dontMock('@/lib/api/client');
    global.fetch = fetchMock as unknown as typeof fetch;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/lib/data/useNotifications') as typeof import('@/lib/data/useNotifications');
    fetchFn = mod.fetchNotifications;
    markFn = mod.markNotificationRead;
  });
  const list = await fetchFn!();
  expect(list).toHaveLength(1);
  await markFn!(3);
  expect(calls.map((c) => [c.init.method, c.url.replace('https://dev.kbap.site', '')])).toEqual([
    ['GET', '/api/notifications'],
    ['PATCH', '/api/notifications/3/read'],
  ]);
  for (const c of calls) expect(c.init.headers['X-Installation-Id']).toBe('uuid-fixed-0001');
});
