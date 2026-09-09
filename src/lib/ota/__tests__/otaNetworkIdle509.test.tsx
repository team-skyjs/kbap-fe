/**
 * P-347(KB-509) — OTA reload 네트워크 정적 창: useNetworkIdle 정착 판정 + 배선 잠금.
 * (canReloadNow의 networkIdle AND 조건은 otaAutoApply420에서 잠금.)
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

import { useIsFetching } from '@tanstack/react-query';
import { useNetworkIdle } from '../OtaAutoApplyHost';
import { OTA_NETWORK_IDLE_MS } from '../otaPolicy';

function Probe() {
  const idle = useNetworkIdle();
  const f = useIsFetching();
  return <Text testID="idle">{`${idle}|f${f}`}</Text>;
}

/** 수동 해소 가능한 쿼리 — isFetching 카운트를 실제 react-query로 구동 */
function SlowQuery({ resolveRef }: { resolveRef: { current: (() => void) | null } }) {
  useQuery({
    queryKey: ['slow'],
    queryFn: () =>
      new Promise<string>((r) => {
        resolveRef.current = () => r('done');
      }),
  });
  return null;
}

const idleOf = (t: ReactTestRenderer) => t.root.findByProps({ testID: 'idle' }).props.children as string;

afterEach(() => jest.useRealTimers());

it('진행 중 fetch(useIsFetching ≥1) = idle false 보류 → 0 정착 500ms 후 true', async () => {
  jest.useFakeTimers();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const resolveRef: { current: (() => void) | null } = { current: null };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <SlowQuery resolveRef={resolveRef} />
        <Probe />
      </QueryClientProvider>,
    );
  });
  // fetch 진행 중 — 500ms가 지나도 idle 금지
  await act(async () => { jest.advanceTimersByTime(OTA_NETWORK_IDLE_MS + 200); });
  expect(idleOf(tree)).toBe('false|f1');
  // fetch 해소 — RQ notify는 setTimeout(0) 배치라 1ms 진행으로 플러시
  await act(async () => { resolveRef.current?.(); });
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(idleOf(tree)).toBe('false|f0'); // 해소됐지만 정착 전
  // 정착 500ms 미만 = 아직 false
  await act(async () => { jest.advanceTimersByTime(OTA_NETWORK_IDLE_MS - 100); });
  expect(idleOf(tree)).toBe('false|f0');
  // 500ms 연속 정착 → true
  await act(async () => { jest.advanceTimersByTime(200); });
  expect(idleOf(tree)).toBe('true|f0');
});

it('정착 중 재증가(새 fetch) = 리셋 — 다시 0 정착 후에만 true', async () => {
  jest.useFakeTimers();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  // 정착 진행(300ms) 중 새 fetch 시작 → 리셋
  await act(async () => { jest.advanceTimersByTime(300); });
  const resolveRef: { current: (() => void) | null } = { current: null };
  await act(async () => {
    tree.update(
      <QueryClientProvider client={qc}>
        <SlowQuery resolveRef={resolveRef} />
        <Probe />
      </QueryClientProvider>,
    );
  });
  await act(async () => { jest.advanceTimersByTime(OTA_NETWORK_IDLE_MS + 200); });
  expect(idleOf(tree)).toBe('false|f1'); // 진행 중 — 리셋 유지
  await act(async () => { resolveRef.current?.(); });
  await act(async () => { jest.advanceTimersByTime(1); }); // notify 플러시
  await act(async () => { jest.advanceTimersByTime(OTA_NETWORK_IDLE_MS + 100); });
  expect(idleOf(tree)).toBe('true|f0'); // 해소 후 재정착
});

it('배선 잠금 — 호스트 = useNetworkIdle 경유 canReloadNow AND · 레이아웃 = QueryClientProvider 안', () => {
  const fs = require('fs');
  const host = fs.readFileSync('src/lib/ota/OtaAutoApplyHost.tsx', 'utf8') as string;
  expect(host).toContain('const networkIdle = useNetworkIdle()');
  expect(host).toMatch(/canReloadNow\(\{ bootedAt: BOOTED_AT[^}]*networkIdle \}\)/);
  expect(host).toContain('useIsFetching');
  expect(host).toContain('useIsMutating');
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
  const qcpIdx = layout.indexOf('<QueryClientProvider');
  const hostIdx = layout.indexOf('<OtaAutoApplyHost');
  const qcpClose = layout.indexOf('</QueryClientProvider>');
  expect(qcpIdx).toBeGreaterThan(-1);
  expect(hostIdx).toBeGreaterThan(qcpIdx);
  expect(hostIdx).toBeLessThan(qcpClose);
});
