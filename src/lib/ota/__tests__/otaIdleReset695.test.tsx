/* eslint-disable @typescript-eslint/no-require-imports --
   jest 구조상 불가피: BOOTED_AT·quietRef가 모듈 로드 시각을 잡으므로 가짜 시계를 켠 **뒤** 호스트를 require한다. */
/**
 * KB-695(#226 Codex P2) — 정적 창 리셋 통지.
 * ① 시나리오(가드 **직전** 리셋): ready · 발행값 true → 가드 직전 리셋 → 가드 tryApply 거절 → 다른 활동 없이 정착 뒤 적용.
 *    이 경우는 가드 재렌더가 리셋된 스냅샷(false)을 **다시 읽어** 풀리므로 옛 "busy 전이 없으면 생략"으로 되돌려도 초록 = **결과 잠금**.
 *    리셋이 **렌더와 그 effect 사이**에 끼면 지금 구조에서도 옛 방식은 고착한다 — 그 판별은 `otaIdleWindow695`(옛 방식 → red).
 * ② 통지 보강의 재렌더 상한 — P-363 "전역 캐시 이벤트마다 Host 리렌더 방지" 유지(옛 생략 → red: false 발행이 안 나옴).
 *    ⚠️ 코얼레스(`pending` 가드)는 이 테스트가 잠그지 않는다 — 재렌더 상한은 useSyncExternalStore가 보장하고 코얼레스는 마이크로태스크 수만 줄인다.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('expo-router', () => ({ usePathname: () => '/' }));
jest.mock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => false, isDiagnosticChannel: () => true })); // 비-prod = 세션 중 reload 경로
const mockUpdates = { isEnabled: true, checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })), fetchUpdateAsync: jest.fn(async () => ({})), reloadAsync: jest.fn(async () => {}) };
jest.mock('expo-updates', () => mockUpdates);

const T0 = new Date('2026-10-01T00:00:00Z').getTime();
jest.useFakeTimers({ now: T0 });
const { OtaAutoApplyHost, useNetworkIdle } = require('../OtaAutoApplyHost') as typeof import('../OtaAutoApplyHost');
const { OTA_BOOT_GUARD_MS, OTA_NETWORK_IDLE_MS } = require('../otaPolicy') as typeof import('../otaPolicy');

const DEV_GLOBAL = global as unknown as { __DEV__: boolean };
beforeAll(() => {
  DEV_GLOBAL.__DEV__ = false; // 호스트 Metro 게이트 통과
  // jest RN 목의 AppState.currentState는 문자열이 아니다 → 앱이 포그라운드인 실제 상황으로 고정(가드의 appState 조건)
  Object.defineProperty(require('react-native').AppState, 'currentState', { value: 'active', configurable: true });
});
afterAll(() => {
  DEV_GLOBAL.__DEV__ = true;
  jest.useRealTimers();
});

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

it('ready · 발행값 true → 가드 직전 non-busy 캐시 이벤트(정적 창 리셋) → 가드 tryApply 거절 → 다른 활동 없이 정착 뒤 적용된다', async () => {
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
        <OtaAutoApplyHost splashDone />
      </QueryClientProvider>,
    );
  });
  expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1); // ready 경로
  await advance(OTA_BOOT_GUARD_MS - 300); // 7.7s — 정적 창 정착(발행값 true), 부팅 가드는 아직
  expect(seen.at(-1)).toBe(true);
  expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  await act(async () => {
    qc.setQueryData(['non-busy'], 1); // busy 아닌 캐시 이벤트 = 정적 창 리셋(since = 지금)
  });
  await advance(0); // react-query 알림 배치(setTimeout 0) 전달
  await advance(400); // 8.1s — 가드 타이머(+50) 발화 → tryApply 시점엔 창 리셋 후 0.4s라 거절
  expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  await advance(OTA_NETWORK_IDLE_MS + 100); // 정착 — 다른 활동 0
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
