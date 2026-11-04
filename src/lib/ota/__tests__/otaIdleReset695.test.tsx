/* eslint-disable @typescript-eslint/no-require-imports --
   jest 구조상 불가피: quietRef·otaState가 모듈 상태를 잡으므로 가짜 시계를 켠 **뒤** 호스트를 require한다. */
/**
 * KB-695(#226 Codex P2) — 정적 창 리셋 통지.
 * ① 시나리오(복귀 **직전** 리셋, KB-978 복귀 창으로 이식): ready · 발행값 true → 복귀 직전 리셋 → 창 tryApply 거절 → 다른 활동 없이 정착 뒤(창 안) 적용.
 *    이 경우는 창 열림 재렌더가 리셋된 스냅샷(false)을 **다시 읽어** 풀리므로 옛 "busy 전이 없으면 생략"으로 되돌려도 초록 = **결과 잠금**.
 *    리셋이 **렌더와 그 effect 사이**에 끼면 지금 구조에서도 옛 방식은 고착한다 — 그 판별은 `otaIdleWindow695`(옛 방식 → red).
 * ② 통지 보강의 재렌더 상한 — P-363 "전역 캐시 이벤트마다 Host 리렌더 방지" 유지(옛 생략 → red: false 발행이 안 나옴).
 *    ⚠️ 코얼레스(`pending` 가드)는 이 테스트가 잠그지 않는다 — 재렌더 상한은 useSyncExternalStore가 보장하고 코얼레스는 마이크로태스크 수만 줄인다.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('expo-router', () => ({ usePathname: () => '/' }));
const mockUpdates = { isEnabled: true, checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })), fetchUpdateAsync: jest.fn(async () => ({})), reloadAsync: jest.fn(async () => {}) };
jest.mock('expo-updates', () => mockUpdates);

const T0 = new Date('2026-10-01T00:00:00Z').getTime();
jest.useFakeTimers({ now: T0 });
const { OtaAutoApplyHost, useNetworkIdle } = require('../OtaAutoApplyHost') as typeof import('../OtaAutoApplyHost');
const { OTA_NETWORK_IDLE_MS, OTA_RESUME_WINDOW_MS } = require('../otaPolicy') as typeof import('../otaPolicy');

const DEV_GLOBAL = global as unknown as { __DEV__: boolean };
const appStateListeners: ((s: string) => void)[] = [];
const RN = require('react-native') as typeof import('react-native');
const setAppState = (v: string) => Object.defineProperty(RN.AppState, 'currentState', { value: v, configurable: true });
beforeAll(() => {
  DEV_GLOBAL.__DEV__ = false; // 호스트 Metro 게이트 통과
  // jest RN 목의 AppState.currentState는 문자열이 아니다 → 실제 상황 값으로 고정(가드의 appState 조건)
  setAppState('active');
  jest.spyOn(RN.AppState, 'addEventListener').mockImplementation(((_ev: string, cb: (s: string) => void) => {
    appStateListeners.push(cb);
    return { remove: () => {} };
  }) as never);
});
afterAll(() => {
  DEV_GLOBAL.__DEV__ = true;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const foreground = async () => {
  await act(async () => {
    appStateListeners.forEach((cb) => { cb('background'); cb('active'); }); // KB-980: 복귀 = background 경유
  });
};

/** 받아둔(ready) 상태 만들기 — 첫 복귀를 background 상태로 흘려 창을 deferred로 닫는다(reload 0, otaState.ready 유지).
 *  이후 복귀는 재체크 없이(inflight 0) 창만 연다 — 정적 창 리셋을 체크 자체가 아닌 캐시 이벤트로만 일으키기 위함. */
async function primeReady() {
  setAppState('background');
  await foreground();
  expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1); // ready 경로
  await advance(OTA_RESUME_WINDOW_MS + 100); // 창 마감(deferred)
  expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  setAppState('active');
}

it('ready · 발행값 true → 복귀 직전 non-busy 캐시 이벤트(정적 창 리셋) → 창 tryApply 거절 → 다른 활동 없이 정착 뒤 적용된다', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const seen: boolean[] = [];
  function IdleProbe() {
    seen.push(useNetworkIdle());
    return null;
  }
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <IdleProbe />
        <OtaAutoApplyHost />
      </QueryClientProvider>,
    );
  });
  await primeReady();
  await advance(OTA_NETWORK_IDLE_MS + 100); // 정적 창 정착(발행값 true)
  expect(seen.at(-1)).toBe(true);
  await act(async () => {
    qc.setQueryData(['non-busy'], 1); // busy 아닌 캐시 이벤트 = 정적 창 리셋(since = 지금)
  });
  await advance(0); // react-query 알림 배치(setTimeout 0) 전달
  await foreground(); // ready = 재체크 없이 창 열림 → tryApply 시점엔 리셋 직후라 거절
  expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1); // 재체크 0(inflight 리셋 아님을 보장)
  expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  await advance(OTA_NETWORK_IDLE_MS + 100); // 정착 — 다른 활동 0, 아직 창 안(3초)
  expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
});

it('P-363 유지 — 연속 non-busy 캐시 이벤트 N회 = 재렌더 상한(버스트당 false 1회 + 정착 후 true 1회)', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renders = jest.fn();
  function Probe() {
    renders(useNetworkIdle());
    return null;
  }
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await advance(OTA_NETWORK_IDLE_MS + 100); // 정착 → true
  expect(renders.mock.calls.at(-1)![0]).toBe(true);
  const base = renders.mock.calls.length;
  await act(async () => {
    for (let i = 0; i < 20; i++) qc.setQueryData(['burst', i], i); // 이벤트 폭주(각 added+updated)
  });
  await advance(0); // react-query 알림 배치(setTimeout 0) 전달
  expect(renders.mock.calls.length - base).toBeLessThanOrEqual(1); // false 1회
  expect(renders.mock.calls.at(-1)![0]).toBe(false);
  await advance(OTA_NETWORK_IDLE_MS + 100);
  expect(renders.mock.calls.length - base).toBeLessThanOrEqual(2); // + 정착 true 1회
  expect(renders.mock.calls.at(-1)![0]).toBe(true);
});
