/**
 * KB-978(P-593) OTA 즉시 적용 — 운영·비운영 같은 로직(예진 11/04 P-316 변경).
 * 시작: 트리 마운트 전 판정(상한 3초) · 복귀: 3초 창 + 작업 화면·네트워크 정적 게이트(P-347) · 이벤트 app_ota_apply(네이밍 규칙 app_ 도메인).
 */
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
import { AppState, Text } from 'react-native';
import { OtaAutoApplyHost, OtaLaunchGate, resetOtaModuleStateForTest } from '../OtaAutoApplyHost';
import { OTA_LAUNCH_TIMEOUT_MS, OTA_NETWORK_IDLE_MS, OTA_RESUME_WINDOW_MS } from '../otaPolicy';
import { decInflight, incInflight } from '@/lib/net/inflight';
/* eslint-enable import/first */

const DEV_GLOBAL = global as unknown as { __DEV__: boolean };
const appStateListeners: ((s: string) => void)[] = [];

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-04T00:00:00Z').getTime() });
  resetOtaModuleStateForTest();
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
const events = () => mockTrack.mock.calls.map((c) => { expect(c[0]).toBe('app_ota_apply'); return c[1] as { result: string; trigger: string }; });

async function mountGate(): Promise<ReactTestRenderer> {
  let t!: ReactTestRenderer;
  await act(async () => {
    t = renderer.create(
      <OtaLaunchGate>
        <Text testID="tree">app</Text>
      </OtaLaunchGate>,
    );
  });
  return t;
}
const treeMounted = (t: ReactTestRenderer) => t.root.findAllByProps({ testID: 'tree' }).length > 0;

describe('시작 — 트리 마운트 전 판정(최대 3초)', () => {
  it('업데이트 있음 → reload 1 · 트리 마운트 0 · applied/launch', async () => {
    const t = await mountGate();
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(treeMounted(t)).toBe(false); // reload 중 트리를 띄우면 요청이 생겨 P-347 창
    expect(events()).toEqual([{ result: 'applied', trigger: 'launch' }]);
  });

  it('업데이트 없음 → reload 0 · 트리 마운트 · none/launch', async () => {
    mockUpdates.checkForUpdateAsync.mockImplementation(async () => ({ isAvailable: false }));
    const t = await mountGate();
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    expect(treeMounted(t)).toBe(true);
    expect(events()).toEqual([{ result: 'none', trigger: 'launch' }]);
  });

  it('3초 초과 → 3초 시점에 트리 마운트 · reload 0 · timeout/launch (늦게 받아도 그 런타임에서 reload 0)', async () => {
    let finish!: () => void;
    mockUpdates.fetchUpdateAsync.mockImplementation(() => new Promise<unknown>((r) => { finish = () => r({}); }));
    const t = await mountGate();
    await advance(OTA_LAUNCH_TIMEOUT_MS - 1);
    expect(treeMounted(t)).toBe(false); // 상한 전 = 스플래시 유지
    await advance(1);
    expect(treeMounted(t)).toBe(true);
    expect(events()).toEqual([{ result: 'timeout', trigger: 'launch' }]);
    await act(async () => { finish(); });
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled(); // 사용 중 화면 reload 금지 — 다음 복귀 몫
  });

  it('체크 에러 → reload 0 · 트리 마운트 · error/launch', async () => {
    mockUpdates.checkForUpdateAsync.mockImplementation(async () => { throw new Error('NETWORK'); });
    const t = await mountGate();
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    expect(treeMounted(t)).toBe(true);
    expect(events()).toEqual([{ result: 'error', trigger: 'launch' }]);
  });

  it('reload 실패 → 트리 마운트 · applied 뒤 error/launch', async () => {
    mockUpdates.reloadAsync.mockImplementation(async () => { throw new Error('RELOAD'); });
    const t = await mountGate();
    expect(treeMounted(t)).toBe(true);
    expect(events()).toEqual([{ result: 'applied', trigger: 'launch' }, { result: 'error', trigger: 'launch' }]);
  });

  it('Updates.isEnabled=false · __DEV__ = 호출 0 · 이벤트 0 · 트리 즉시 마운트', async () => {
    mockUpdates.isEnabled = false;
    const t = await mountGate();
    expect(treeMounted(t)).toBe(true);
    mockUpdates.isEnabled = true;
    DEV_GLOBAL.__DEV__ = true;
    const t2 = await mountGate();
    expect(treeMounted(t2)).toBe(true);
    expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

describe('복귀 — 3초 창 + 작업 화면·네트워크 정적 게이트', () => {
  async function mountHost() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      renderer.create(
        <QueryClientProvider client={qc}>
          <OtaAutoApplyHost />
        </QueryClientProvider>,
      );
    });
    await advance(OTA_NETWORK_IDLE_MS + 100); // 마운트 직후 정착
  }
  const foreground = async () => {
    await act(async () => {
      appStateListeners.forEach((cb) => cb('active'));
    });
  };

  it('업데이트 있음 · 진행 요청 0 → 복귀 직후 reload · applied/resume', async () => {
    await mountHost();
    await foreground();
    await advance(OTA_NETWORK_IDLE_MS + 100); // 체크 자체(inflight 경유) 뒤 정착
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(events()).toEqual([{ result: 'applied', trigger: 'resume' }]);
  });

  it('P-347 회귀: 진행 중 fetch가 있으면 복귀 reload 0 → 창 마감 deferred → 끝난 뒤 다음 복귀에 적용', async () => {
    await mountHost();
    act(() => { incInflight(); }); // 진행 중 요청
    await foreground();
    await advance(OTA_RESUME_WINDOW_MS + 100);
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    expect(events()).toEqual([{ result: 'deferred', trigger: 'resume' }]);
    act(() => { decInflight(); });
    await advance(OTA_NETWORK_IDLE_MS + 100); // 창 밖 정착 — 사용 중 reload 금지
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    await foreground(); // 받아둔 것 = 재체크 없이 창
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    await advance(10);
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(events().at(-1)).toEqual({ result: 'applied', trigger: 'resume' });
  });

  it('작업 화면(스캔·리뷰 작성·로그인) 복귀 = reload 0 · deferred/resume', async () => {
    for (const p of ['/scan', '/food/7/review', '/login']) {
      resetOtaModuleStateForTest();
      mockTrack.mockReset();
      appStateListeners.length = 0;
      mockRoute.path = p;
      await mountHost();
      await foreground();
      await advance(OTA_RESUME_WINDOW_MS + 100);
      expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
      expect(events()).toEqual([{ result: 'deferred', trigger: 'resume' }]);
    }
  });

  it('업데이트 없음 → none/resume · 2분 내 재복귀 = 체크·이벤트 0(스로틀)', async () => {
    mockUpdates.checkForUpdateAsync.mockImplementation(async () => ({ isAvailable: false }));
    await mountHost();
    await foreground();
    await foreground();
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    expect(events()).toEqual([{ result: 'none', trigger: 'resume' }]);
  });

  it('받는 데 창(3초)을 넘기면 reload 0 · deferred/resume', async () => {
    let finish!: () => void;
    mockUpdates.fetchUpdateAsync.mockImplementation(() => new Promise<unknown>((r) => { finish = () => r({}); }));
    await mountHost();
    await foreground();
    await advance(OTA_RESUME_WINDOW_MS + 100);
    await act(async () => { finish(); });
    await advance(OTA_NETWORK_IDLE_MS + 100);
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    expect(events()).toEqual([{ result: 'deferred', trigger: 'resume' }]);
  });
});
