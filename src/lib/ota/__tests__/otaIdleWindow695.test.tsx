/* eslint-disable @typescript-eslint/no-require-imports --
   jest 구조상 불가피: BOOTED_AT·quietRef가 모듈 로드 시각을 잡으므로 가짜 시계를 켠 **뒤** 호스트를 require한다. */
/**
 * KB-695(#226 Codex P2) **판별 테스트** — 공부 세션 작성(10/2, `local-handoff/study/_briefs/kb695-ota-window-test`)을 레포 규칙으로 옮김.
 * "렌더가 스냅샷 true를 읽은 **뒤**, 그 렌더의 적용 effect **전에**" busy 아닌 캐시 이벤트가 정적 창을 리셋하는 창.
 * 장치: Host는 `useNetworkIdle()` 다음에 `usePathname()`을 부른다 → 목 `usePathname`이 지정한 렌더에서 `setQueryData`를 쏘면
 * "다른 컴포넌트가 같은 렌더 패스에서 캐시 이벤트를 낸" 상황과 같다.
 * - 옛 "busy 전이 없으면 통지 생략": effect의 tryApply가 거절된 뒤 발행값은 여전히 true → 정착 통지(true)가 값 변화가 아님 →
 *   재렌더 생략 → **고착(reload 0)**.
 * - 지금(모든 이벤트 코얼레스 통지): 리셋이 false로 발행 → 정착 통지가 값 변화 → 재렌더 → 적용(reload 1).
 * ⚠️ 가짜 시계: jest 가짜 타이머는 queueMicrotask도 가짜라 훅의 통지가 다음 advance까지 안 돈다. 창 직후 `advance(0)`을 빼면
 *    act가 재렌더를 "정착 뒤 시각"에 수행해 스냅샷이 다시 true로 읽히고 새 코드도 고착처럼 보인다 — 그 줄을 지우지 말 것.
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockHook: { fire: null | (() => void) } = { fire: null };
jest.mock('expo-router', () => ({
  usePathname: () => {
    const f = mockHook.fire;
    if (f) {
      mockHook.fire = null;
      f();
    }
    return '/';
  },
}));
jest.mock('@/lib/flags', () => ({ FLAGS: {}, isProdChannel: () => false, isDiagnosticChannel: () => true })); // 비-prod = 세션 중 reload 경로
const mockUpdates = { isEnabled: true, checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })), fetchUpdateAsync: jest.fn(async () => ({})), reloadAsync: jest.fn(async () => {}) };
jest.mock('expo-updates', () => mockUpdates);

const T0 = new Date('2026-10-01T00:00:00Z').getTime();
jest.useFakeTimers({ now: T0 });
const { OtaAutoApplyHost, networkQuietNow } = require('../OtaAutoApplyHost') as typeof import('../OtaAutoApplyHost');
const { OTA_BOOT_GUARD_MS, OTA_NETWORK_IDLE_MS } = require('../otaPolicy') as typeof import('../otaPolicy');

const DEV_GLOBAL = global as unknown as { __DEV__: boolean };
beforeAll(() => {
  DEV_GLOBAL.__DEV__ = false; // 호스트 Metro 게이트 통과
  // jest RN 목의 AppState.currentState는 문자열이 아니라 목 함수 → 포그라운드로 고정(가드의 appState 조건)
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

it('가드 재렌더가 스냅샷 true를 읽은 직후(같은 렌더 패스) non-busy 이벤트 → 그 effect의 tryApply 거절 → 다른 활동 없이 정착 뒤 적용', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <OtaAutoApplyHost splashDone />
      </QueryClientProvider>,
    );
  });
  expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1); // ready 경로
  await advance(OTA_BOOT_GUARD_MS - 100); // 7.9s — 정착(발행 true), 가드 타이머는 8.05s
  expect(networkQuietNow(qc)).toBe(true);
  expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  mockHook.fire = () => {
    qc.setQueryData(['window'], 1); // 다음 Host 렌더(가드 재렌더)에서 useNetworkIdle 뒤에 발화
  };
  await advance(200); // 8.1s — 가드 타이머 → 재렌더(스냅샷 true) → [이벤트: since 리셋] → effect: tryApply 거절
  expect(mockHook.fire).toBe(null); // 실제로 그 렌더에서 발화했다
  await advance(0); // ⚠️ 지우지 말 것 — 훅의 마이크로태스크 통지를 같은 시각에 흘려보낸다(위 파일 주석)
  expect(mockUpdates.reloadAsync).not.toHaveBeenCalled(); // 창 안에서는 거절
  await advance(OTA_NETWORK_IDLE_MS + 200); // 다른 활동 0 — 정착
  expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1); // 옛 생략 = 0(고착)
});
