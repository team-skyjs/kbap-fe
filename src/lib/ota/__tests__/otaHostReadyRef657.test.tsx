/* eslint-disable import/first --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-657(PR-3) → KB-978 — 업데이트를 받아 ready가 된 뒤엔 포그라운드 복귀(AppState active)에서 **재체크를 생략**한다
 * (적용 대기 중 네이티브 프라미스 위 reload 창 제거, #109 4R). 스로틀(2분)과 구분하려고 **3분 경과 뒤** 복귀시킨다.
 * KB-978: 콜드 스타트 체크는 OtaLaunchGate 몫 — 호스트 마운트만으로는 체크 0. ready는 모듈 상태(otaState)라
 * 이 파일의 테스트는 시각을 겹치지 않게 진행한다(스로틀 기준 시각이 이어진다).
 */
import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const appStateListeners: ((s: string) => void)[] = [];
jest.mock('expo-router', () => ({ usePathname: () => '/' }));
const mockUpdates = { isEnabled: true, checkForUpdateAsync: jest.fn(), fetchUpdateAsync: jest.fn(async () => ({})), reloadAsync: jest.fn(async () => {}) };
jest.mock('expo-updates', () => mockUpdates);

import { AppState } from 'react-native';
import { OtaAutoApplyHost } from '../OtaAutoApplyHost';

const DEV_GLOBAL = global as unknown as { __DEV__: boolean };

async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    renderer.create(
      <QueryClientProvider client={qc}>
        <OtaAutoApplyHost />
      </QueryClientProvider>,
    );
  });
}
const foreground = async () => {
  await act(async () => {
    appStateListeners.forEach((cb) => { cb('background'); cb('active'); }); // KB-980: 복귀 = background 경유
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  DEV_GLOBAL.__DEV__ = false; // 호스트의 Metro 게이트 통과
  appStateListeners.length = 0;
  // react-native 모듈 통째 목은 deprecated getter를 건드려 로드가 깨진다 — AppState만 spy
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_ev: string, cb: (s: string) => void) => {
    appStateListeners.push(cb);
    return { remove: () => {} };
  }) as never);
  mockUpdates.checkForUpdateAsync.mockReset();
  mockUpdates.fetchUpdateAsync.mockClear();
});
afterEach(() => {
  DEV_GLOBAL.__DEV__ = true;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('대조군: 업데이트 없음 → 마운트 체크 0(시작은 게이트 몫) · 복귀 체크 1 · 3분 뒤 복귀 = 재체크(스로틀 밖)', async () => {
  jest.setSystemTime(new Date('2026-10-01T00:00:00Z'));
  mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
  await mount();
  expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
  await foreground();
  expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  jest.setSystemTime(new Date('2026-10-01T00:03:00Z'));
  await foreground();
  expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(2);
});

it('ready 뒤 포그라운드 복귀(3분 뒤) = 재체크 생략 — otaState.ready', async () => {
  jest.setSystemTime(new Date('2026-10-01T01:00:00Z'));
  mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
  await mount();
  await foreground();
  expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1); // 대조: ready 경로를 실제로 탔다
  jest.setSystemTime(new Date('2026-10-01T01:03:00Z'));
  await foreground();
  expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1); // 생략
});
