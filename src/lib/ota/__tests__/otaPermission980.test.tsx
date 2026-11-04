/**
 * KB-980(P-594) 권한 팝업 닫힘 ≠ OTA 복귀.
 * ① 복귀 = background를 거친 active만(iOS 시스템 팝업은 inactive만) — 창·체크·이벤트 0
 * ② 권한 요청 중·응답 뒤 5초 = reload 0 · deferred(Android 팝업의 background 전이) · 요청은 withPermissionPrompt로만(src 전수 잠금)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRoute = { path: '/' };
jest.mock('expo-router', () => ({ usePathname: () => mockRoute.path }));
const mockTrack = jest.fn();
// 이 파일은 jest.mock 호이스팅 뒤 정적 import — 목 변수는 mock 접두(팩토리 지연 참조)
jest.mock('@/lib/analytics', () => ({ EVENTS: { app_ota_apply: 'app_ota_apply' }, track: (...a: unknown[]) => mockTrack(...a) }));
const mockUpdates = {
  isEnabled: true,
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
  fetchUpdateAsync: jest.fn(async () => ({})),
  reloadAsync: jest.fn(async () => {}),
};
jest.mock('expo-updates', () => mockUpdates);

/* eslint-disable import/first -- jest.mock 뒤(팩토리 호이스팅) — 레포 관례 */
import { AppState } from 'react-native';
import { OtaAutoApplyHost, resetOtaModuleStateForTest } from '../OtaAutoApplyHost';
import { OTA_NETWORK_IDLE_MS, OTA_RESUME_WINDOW_MS } from '../otaPolicy';
import { PERMISSION_SETTLE_MS, _resetPermissionPromptForTest, withPermissionPrompt } from '@/lib/permissionPrompt';
/* eslint-enable import/first */

const DEV_GLOBAL = global as unknown as { __DEV__: boolean };
const appStateListeners: ((s: string) => void)[] = [];

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-04T00:00:00Z').getTime() });
  resetOtaModuleStateForTest();
  _resetPermissionPromptForTest();
  DEV_GLOBAL.__DEV__ = false;
  mockRoute.path = '/';
  mockUpdates.isEnabled = true;
  mockUpdates.checkForUpdateAsync.mockReset().mockImplementation(async () => ({ isAvailable: true }));
  mockUpdates.fetchUpdateAsync.mockReset().mockImplementation(async () => ({}));
  mockUpdates.reloadAsync.mockReset().mockImplementation(async () => {});
  mockTrack.mockReset();
  appStateListeners.length = 0;
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_ev: string, cb: (s: string) => void) => {
    appStateListeners.push(cb);
    return { remove: () => {} };
  }) as never);
});
afterEach(() => {
  DEV_GLOBAL.__DEV__ = true;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const events = () => mockTrack.mock.calls.map((c) => c[1] as { result: string; trigger: string });
const emit = async (...states: string[]) => {
  await act(async () => {
    for (const s of states) appStateListeners.forEach((cb) => cb(s));
  });
};
async function mountHost() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <OtaAutoApplyHost />
      </QueryClientProvider>,
    );
  });
  await advance(OTA_NETWORK_IDLE_MS + 100);
}

describe('① 복귀 = background 경유 active만', () => {
  it('inactive→active(iOS 권한·ATT 팝업 닫힘) = 체크 0 · 창 0 · 이벤트 0 · reload 0', async () => {
    await mountHost();
    await emit('inactive', 'active');
    await advance(OTA_RESUME_WINDOW_MS + 100);
    expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    expect(events()).toEqual([]);
  });

  it('회귀: background→active = 지금처럼 적용 · background→inactive→active도 복귀', async () => {
    await mountHost();
    await emit('background', 'active');
    await advance(OTA_NETWORK_IDLE_MS + 100);
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(events()).toEqual([{ result: 'applied', trigger: 'resume' }]);

    resetOtaModuleStateForTest();
    mockTrack.mockReset();
    mockUpdates.reloadAsync.mockClear();
    appStateListeners.length = 0;
    await mountHost();
    await emit('background', 'inactive', 'active');
    await advance(OTA_NETWORK_IDLE_MS + 100);
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('복귀 1회 뒤 inactive→active = 다시 복귀로 치지 않음(플래그 소비)', async () => {
    mockUpdates.checkForUpdateAsync.mockImplementation(async () => ({ isAvailable: false }));
    await mountHost();
    await emit('background', 'active');
    jest.setSystemTime(Date.now() + 10 * 60_000); // 스로틀 밖 — 체크가 일어난다면 보인다
    await emit('inactive', 'active');
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });
});

describe('② 권한 요청 중·응답 뒤 5초 = reload 0 · deferred', () => {
  it('요청 중(Android 팝업 background 전이) 복귀 = reload 0 · 창 마감 deferred', async () => {
    await mountHost();
    void withPermissionPrompt(() => new Promise<void>(() => {})); // 응답 대기 중
    await emit('background', 'active');
    await advance(OTA_NETWORK_IDLE_MS + 100); // 정착 재평가가 창 안에서 일어나게 나눠 진행(한 act에 몰면 창 마감이 먼저 = 게이트 없이도 deferred)
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    await advance(OTA_RESUME_WINDOW_MS);
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    expect(events()).toEqual([{ result: 'deferred', trigger: 'resume' }]);
  });

  it('응답 뒤 5초 안 복귀 = reload 0 · deferred → 5초 뒤 다음 진짜 복귀에 적용', async () => {
    await mountHost();
    await act(async () => { await withPermissionPrompt(async () => 'granted'); });
    await advance(PERMISSION_SETTLE_MS - OTA_RESUME_WINDOW_MS - 1_000); // 응답 뒤 ~1.5초
    await emit('background', 'active');
    await advance(OTA_NETWORK_IDLE_MS + 100); // 정착 재평가가 창 안에서 일어나게 나눠 진행(한 act에 몰면 창 마감이 먼저 = 게이트 없이도 deferred)
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    await advance(OTA_RESUME_WINDOW_MS);
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    expect(events()).toEqual([{ result: 'deferred', trigger: 'resume' }]);
    await advance(PERMISSION_SETTLE_MS);
    await emit('background', 'active');
    await advance(10);
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(events().at(-1)).toEqual({ result: 'applied', trigger: 'resume' });
  });

  it('요청이 실패(throw)해도 해제 — 5초 뒤 복귀 적용', async () => {
    await mountHost();
    await act(async () => { await withPermissionPrompt(async () => { throw new Error('x'); }).catch(() => undefined); });
    await advance(PERMISSION_SETTLE_MS);
    await emit('background', 'active');
    await advance(OTA_NETWORK_IDLE_MS + 100);
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });
});

/** 열거형 목록 대신 src 전수 — 나중에 생긴 권한 요청도 잡는다 */
describe('잠금: 권한 요청은 withPermissionPrompt로만', () => {
  const files = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' ? [] : files(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });
  const lines = () => files('src').flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i, l })))
    .filter(({ l }) => !/^\s*(\*|\/\/)/.test(l));

  it('네이티브 request*Permissions*Async 호출 = 같은 줄에 withPermissionPrompt', () => {
    const calls = lines().filter(({ l }) => /\.request\w*Permissions?Async\(/.test(l));
    expect(calls.length).toBeGreaterThanOrEqual(10); // 알림·카메라·사진·위치·ATT
    expect(calls.filter(({ l }) => !l.includes('withPermissionPrompt(() =>')).map(({ f, i }) => `${f}:${i + 1}`)).toEqual([]);
  });
  it('expo-camera 훅의 requestPermission 호출 = withPermissionPrompt(requestPermission)', () => {
    const hookFiles = files('src').filter((f) => /useCameraPermissions\(/.test(fs.readFileSync(f, 'utf8')));
    expect(hookFiles.length).toBeGreaterThan(0);
    const direct = lines().filter(({ f, l }) => hookFiles.includes(f) && /\brequestPermission\(\)/.test(l));
    expect(direct.map(({ f, i }) => `${f}:${i + 1}`)).toEqual([]);
  });
});
