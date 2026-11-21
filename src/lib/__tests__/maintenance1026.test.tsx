/**
 * KB-1026 점검 화면 잠금 — 원격 스위치(절대 URL·캐시 금지·5초 타임아웃) · **페일 오픈**(실패·타임아웃·404·깨진 JSON·
 * 필드 누락 = 통과) · 점검 중 30초 재조회와 자동 해제 · 버전 게이트 blocked 우선 · 10개 로케일 문구.
 */
import * as React from 'react';
import { readFileSync } from 'fs';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  MAINTENANCE_POLL_MS,
  MAINTENANCE_TIMEOUT_MS,
  MAINTENANCE_URL,
  __isPolling,
  __resetMaintenance,
  isMaintenanceOn,
  refreshMaintenance,
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

  it('이미 점검 중이면 조회 실패·404·깨진 JSON에도 유지, 재조회는 계속 돌고 false로 읽히면 해제', async () => {
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
      expect(__isPolling()).toBe(true);
    }
    fetchMock.mockResolvedValueOnce(okJson({})); // 읽었고 true가 아님 = 해제
    await act(() => refreshMaintenance());
    expect(getMaintenanceState()).toBe(false);
    expect(__isPolling()).toBe(false);
  });
});

describe('점검 중 30초마다 재조회 → false면 자동 해제', () => {
  it('켜지면 폴링 시작, false 응답에 해제·폴링 멈춤', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(okJson({ maintenance: true }));
    await act(() => refreshMaintenance());
    expect(getMaintenanceState()).toBe(true);
    expect(__isPolling()).toBe(true);
    expect(MAINTENANCE_POLL_MS).toBe(30_000);

    fetchMock.mockClear();
    await act(async () => {
      jest.advanceTimersByTime(MAINTENANCE_POLL_MS - 1);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(okJson({ maintenance: false }));
    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getMaintenanceState()).toBe(false);
    expect(__isPolling()).toBe(false);
  });

  it('꺼져 있을 땐 폴링 없음', async () => {
    fetchMock.mockResolvedValue(okJson({ maintenance: false }));
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
