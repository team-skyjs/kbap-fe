/**
 * KB-1026 점검 화면 잠금 — 원격 스위치(절대 URL·캐시 금지·5초 타임아웃) · **페일 오픈**(실패·타임아웃·404·깨진 JSON·
 * 필드 누락 = 통과) · 재조회(점검 중 30초·아닐 때 60초·시작 재시도 5초·백그라운드 0)와 자동 해제 · 버전 게이트 blocked 우선 · 10개 로케일 문구.
 */
import * as React from 'react';
import { readFileSync } from 'fs';
import { AppState, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  MAINTENANCE_IDLE_POLL_MS,
  MAINTENANCE_POLL_MS,
  MAINTENANCE_START_RETRY_MS,
  MAINTENANCE_TIMEOUT_MS,
  MAINTENANCE_URL,
  __isPolling,
  __resetMaintenance,
  isMaintenanceOn,
  refreshMaintenance,
  startMaintenance,
  getMaintenanceState,
} from '../maintenance';
import { __resetVersionGate, refreshVersionGate } from '../versionGate';
import { MaintenanceOverlay } from '@/components/MaintenanceOverlay';

// jest.mock은 babel-jest가 import 위로 끌어올린다
jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn() }, APP_VERSION_PATH: '/api/app-version' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.5' } } }));
jest.mock('@/lib/openExternal', () => ({ openStoreLink: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api/client');

const fetchMock = jest.fn();
const okJson = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

beforeEach(() => {
  __resetMaintenance();
  __resetVersionGate();
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
});
afterEach(() => {
  jest.useRealTimers();
  __resetMaintenance(); // 켜진 채 끝난 테스트의 30초 폴링 타이머 정리
});

describe('판정 — 정확히 maintenance === true만', () => {
  it.each([
    [{ maintenance: true }, true],
    [{ maintenance: false }, false],
    [{ maintenance: 'true' }, false],
    [{ maintenance: 1 }, false],
    [{}, false],
    [null, false],
    ['maintenance', false],
    [[true], false],
  ])('%j → %s', (body, want) => expect(isMaintenanceOn(body)).toBe(want));
});

describe('조회 — 절대 URL·캐시 금지', () => {
  it('api 클라이언트(BE_BASE)가 아니라 kbap-status.pages.dev를 직접, no-store로', async () => {
    fetchMock.mockResolvedValue(okJson({ maintenance: false }));
    await act(() => refreshMaintenance());
    expect(fetchMock).toHaveBeenCalledWith(MAINTENANCE_URL, expect.objectContaining({ cache: 'no-store' }));
    expect(MAINTENANCE_URL).toBe('https://kbap-status.pages.dev/status.json');
    expect(api.get).not.toHaveBeenCalled();
  });
  it('true면 켜짐', async () => {
    fetchMock.mockResolvedValue(okJson({ maintenance: true }));
    await act(() => refreshMaintenance());
    expect(getMaintenanceState()).toBe(true);
  });
});

describe('페일 오픈 — 오프라인 사용자를 잠그지 않는다', () => {
  it.each([
    ['네트워크 실패', () => Promise.reject(new TypeError('Network request failed'))],
    ['404', () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ maintenance: true }) })],
    ['깨진 JSON', () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('bad')) })],
    ['필드 누락', () => Promise.resolve(okJson({ status: 'down' }))],
  ])('%s = 통과', async (_n, impl) => {
    fetchMock.mockImplementation(impl);
    await act(() => refreshMaintenance());
    expect(getMaintenanceState()).toBe(false);
  });

  it('5초 타임아웃 = 중단 후 통과', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_u: string, init: { signal: AbortSignal }) => {
      signal = init.signal;
      return new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
    });
    const p = refreshMaintenance();
    await act(async () => {
      jest.advanceTimersByTime(MAINTENANCE_TIMEOUT_MS);
      await p;
    });
    expect(MAINTENANCE_TIMEOUT_MS).toBe(5000);
    expect(signal?.aborted).toBe(true);
    expect(getMaintenanceState()).toBe(false);
  });

  it('이미 점검 중이면 조회 실패·404·깨진 JSON에도 유지, false로 읽히면 해제', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ maintenance: true }));
    await act(() => refreshMaintenance());
    expect(getMaintenanceState()).toBe(true);
    const fails = [
      () => Promise.reject(new TypeError('offline')),
      () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
      () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('bad')) }),
    ];
    for (const f of fails) {
      fetchMock.mockImplementationOnce(f);
      await act(() => refreshMaintenance());
      expect(getMaintenanceState()).toBe(true);
    }
    fetchMock.mockResolvedValueOnce(okJson({})); // 읽었고 true가 아님 = 해제
    await act(() => refreshMaintenance());
    expect(getMaintenanceState()).toBe(false);
  });
});

describe('재조회 — active인 동안 항상(점검 중 30초 · 아닐 때 60초), 타이머 하나, 백그라운드 0', () => {
  let appState: (s: string) => void = () => {};
  let stop: () => void = () => {};
  const fail = () => Promise.reject(new TypeError('offline'));
  /** 타이머를 ms만큼 돌리고 조회 프라미스 사슬을 비운다 */
  const tick = (ms: number) =>
    act(async () => {
      jest.advanceTimersByTime(ms);
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });
  const start = async () => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_e: string, cb: (s: string) => void) => {
      appState = cb;
      return { remove: jest.fn() };
    }) as never);
    stop = startMaintenance();
    await tick(0);
  };
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    stop();
    jest.restoreAllMocks();
  });

  it('주기 상수: 점검 중 30초 · 아닐 때 60초 · 시작 재시도 5초', () => {
    expect([MAINTENANCE_POLL_MS, MAINTENANCE_IDLE_POLL_MS, MAINTENANCE_START_RETRY_MS]).toEqual([30_000, 60_000, 5_000]);
  });

  it('점검 아닐 때도 60초마다 조회 → 스위치를 켜면 쓰던 사용자도 1분 안에 점검 화면', async () => {
    fetchMock.mockResolvedValue(okJson({ maintenance: false }));
    await start();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(__isPolling()).toBe(true);
    await tick(MAINTENANCE_IDLE_POLL_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(okJson({ maintenance: true })); // 스위치 켬
    await tick(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getMaintenanceState()).toBe(true);
  });

  it('점검 중에는 30초 주기, false로 읽히면 해제되고 60초 주기로', async () => {
    fetchMock.mockResolvedValue(okJson({ maintenance: true }));
    await start();
    expect(getMaintenanceState()).toBe(true);
    await tick(MAINTENANCE_POLL_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(okJson({ maintenance: false }));
    await tick(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getMaintenanceState()).toBe(false);
    await tick(MAINTENANCE_POLL_MS); // 30초로는 안 돎
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await tick(MAINTENANCE_IDLE_POLL_MS - MAINTENANCE_POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('점검 중 못 읽어도 유지하고 30초 재조회는 계속', async () => {
    fetchMock.mockResolvedValue(okJson({ maintenance: true }));
    await start();
    fetchMock.mockImplementation(fail);
    await tick(MAINTENANCE_POLL_MS);
    await tick(MAINTENANCE_POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getMaintenanceState()).toBe(true);
    expect(__isPolling()).toBe(true);
  });

  it('Q-431: 시작 조회를 못 읽으면 5초 뒤 1회 재시도, 그 뒤는 60초 주기', async () => {
    fetchMock.mockImplementation(fail);
    await start();
    expect(getMaintenanceState()).toBe(false); // 페일 오픈
    await tick(MAINTENANCE_START_RETRY_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await tick(1); // 재시도도 실패
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await tick(MAINTENANCE_START_RETRY_MS); // 두 번째 5초 재시도는 없음
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockResolvedValue(okJson({ maintenance: true }));
    await tick(MAINTENANCE_IDLE_POLL_MS - MAINTENANCE_START_RETRY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getMaintenanceState()).toBe(true);
  });

  it('시작 재시도가 읽히면 바로 점검 화면(5초 안)', async () => {
    fetchMock.mockImplementationOnce(fail);
    await start();
    fetchMock.mockResolvedValue(okJson({ maintenance: true }));
    await tick(MAINTENANCE_START_RETRY_MS);
    expect(getMaintenanceState()).toBe(true);
  });

  it('백그라운드에서는 타이머 0, 복귀하면 바로 조회하고 주기 재개', async () => {
    fetchMock.mockResolvedValue(okJson({ maintenance: false }));
    await start();
    act(() => appState('background'));
    expect(__isPolling()).toBe(false);
    await tick(MAINTENANCE_IDLE_POLL_MS * 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => appState('active'));
    await tick(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(__isPolling()).toBe(true);
    await tick(MAINTENANCE_IDLE_POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('백그라운드로 간 뒤 도착한 응답은 다음 조회를 예약하지 않음', async () => {
    let done: (v: unknown) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((r) => (done = r)));
    await start();
    act(() => appState('background'));
    done(okJson({ maintenance: false }));
    await tick(0);
    expect(__isPolling()).toBe(false);
  });

  it('타이머는 하나 — 복귀 조회와 주기 조회가 겹쳐 쌓이지 않음', async () => {
    fetchMock.mockResolvedValue(okJson({ maintenance: false }));
    await start();
    for (let i = 0; i < 3; i++) {
      act(() => appState('active'));
      await tick(0);
    }
    const before = fetchMock.mock.calls.length; // 시작 1 + 복귀 3
    expect(before).toBe(4);
    await tick(MAINTENANCE_IDLE_POLL_MS);
    expect(fetchMock.mock.calls.length).toBe(before + 1);
  });

  it('startMaintenance 전(직접 조회)에는 예약 없음', async () => {
    jest.useRealTimers();
    fetchMock.mockResolvedValue(okJson({ maintenance: true }));
    await act(() => refreshMaintenance());
    expect(__isPolling()).toBe(false);
  });

  it('늦게 온 옛 응답이 새 결과를 덮지 않음', async () => {
    let slow: (v: unknown) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((r) => (slow = r)));
    const old = refreshMaintenance();
    fetchMock.mockResolvedValueOnce(okJson({ maintenance: false }));
    await act(() => refreshMaintenance());
    slow(okJson({ maintenance: true }));
    await act(() => old);
    expect(getMaintenanceState()).toBe(false);
  });
});

describe('화면', () => {
  const render = () => {
    let t: ReactTestRenderer;
    act(() => {
      t = create(<MaintenanceOverlay />);
    });
    return t!;
  };
  const ids = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.props?.testID === 'string' && typeof n.type === 'string').map((n) => n.props.testID as string);
  const texts = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children as string);

  it('점검 중 = 전체 화면(제목·본문, 버튼 없음), 해제되면 사라짐', async () => {
    fetchMock.mockResolvedValue(okJson({ maintenance: true }));
    const t = render();
    await act(() => refreshMaintenance());
    expect(ids(t)).toContain('maintenance-gate');
    expect(texts(t)).toEqual(expect.arrayContaining(["We're doing maintenance", "We're moving our servers. This screen closes on its own when we're done."]));
    // 디자인(예진 11/22): 항상 어두운 배경(ink) · 흰 제목 · 원형 로고 · 제목 줄 수 제한 없음(긴 번역 3줄)
    const flat = (id: string) => StyleSheet.flatten(t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string')[0]!.props.style);
    expect(flat('maintenance-gate').backgroundColor).toBe('#1C1E21');
    const logo = flat('maintenance-logo');
    expect(logo.borderRadius).toBe(logo.width / 2);
    const title = t.root.findAll((n) => n.props?.accessibilityRole === 'header' && typeof n.type === 'string')[0]!;
    expect(StyleSheet.flatten(title.props.style).color).toBe('#FFFFFF');
    expect(title.props.numberOfLines).toBeUndefined();
    // Q-431: 한국어 어절 단위 줄바꿈("자동 / 으로" 방지) — 제목·본문 둘 다
    const strategies = t.root.findAll((n) => typeof n.type === 'string' && typeof n.props?.children === 'string').map((n) => n.props.lineBreakStrategyIOS);
    expect(strategies).toEqual(['hangul-word', 'hangul-word']);
    expect(t.root.findAll((n) => n.props?.accessibilityRole === 'button' || n.props?.onPress != null)).toHaveLength(0);
    fetchMock.mockResolvedValue(okJson({ maintenance: false }));
    await act(() => refreshMaintenance());
    expect(ids(t)).not.toContain('maintenance-gate');
    act(() => t.unmount());
  });

  it('버전 게이트 blocked가 우선 — 점검 화면을 그리지 않음', async () => {
    api.get.mockResolvedValue({ minSupportedVersion: '9.0.0', latestVersion: '9.0.0', storeUrls: {} });
    await act(() => refreshVersionGate(true));
    fetchMock.mockResolvedValue(okJson({ maintenance: true }));
    const t = render();
    await act(() => refreshMaintenance());
    expect(getMaintenanceState()).toBe(true);
    expect(ids(t)).not.toContain('maintenance-gate');
    act(() => t.unmount());
  });

  it('루트 레이아웃에 버전 게이트 옆으로 마운트', () => {
    const layout = readFileSync('src/app/_layout.tsx', 'utf8');
    expect(layout).toContain('<VersionGateOverlay />');
    expect(layout).toContain('<MaintenanceOverlay />');
  });
});

describe('문구 — 10개 로케일, 하드코딩 0', () => {
  const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
  it.each(LOCALES)('%s: 제목·본문 있음, 이모지·가운데 점·대시·숫자(복구 시각) 0', (loc) => {
    const m = JSON.parse(readFileSync(`src/lib/i18n/${loc}.json`, 'utf8')).maintenance;
    expect(typeof m.title).toBe('string');
    expect(typeof m.body).toBe('string');
    const all = `${m.title}${m.body}`;
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/[·•‐-―−-]/);
    expect(all).not.toMatch(/\d/);
  });
  it('en·ko = 발주 문구 그대로', () => {
    const en = JSON.parse(readFileSync('src/lib/i18n/en.json', 'utf8')).maintenance;
    const ko = JSON.parse(readFileSync('src/lib/i18n/ko.json', 'utf8')).maintenance;
    expect(en).toEqual({ title: "We're doing maintenance", body: "We're moving our servers. This screen closes on its own when we're done." });
    expect(ko).toEqual({ title: '지금은 점검 중이에요', body: '서버를 옮기고 있어요. 점검이 끝나면 이 화면이 자동으로 닫혀요.' });
  });
  it('화면 소스에 문구 하드코딩 0', () => {
    const src = readFileSync('src/components/MaintenanceOverlay.tsx', 'utf8');
    expect(src).toContain("t('maintenance.title')");
    expect(src).toContain("t('maintenance.body')");
    expect(src).not.toMatch(/We're doing|점검 중이에요/);
  });
});
