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
  // 9R: 카운트 소스 = netBusy(inflight + RQ 캐시 동기 카운트)
  expect(host).toContain('return inflightCount() > 0 || qc.isFetching() > 0 || qc.isMutating() > 0;');
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8') as string;
  const qcpIdx = layout.indexOf('<QueryClientProvider');
  const hostIdx = layout.indexOf('<OtaAutoApplyHost');
  const qcpClose = layout.indexOf('</QueryClientProvider>');
  expect(qcpIdx).toBeGreaterThan(-1);
  expect(hostIdx).toBeGreaterThan(qcpIdx);
  expect(hostIdx).toBeLessThan(qcpClose);
});


it('#109 P1: react-query 밖 raw 요청(inflight 카운터)도 정적 창에 포함 — 진행 중 보류·완료 후 정착', async () => {
  jest.useFakeTimers();
  const { incInflight, decInflight } = require('@/lib/net/inflight') as typeof import('@/lib/net/inflight');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  act(() => { incInflight(); }); // raw api.get 진행 시뮬레이션(VersionGate 등)
  await act(async () => { jest.advanceTimersByTime(OTA_NETWORK_IDLE_MS + 300); });
  expect(idleOf(tree)).toContain('false'); // RQ 카운트 0이어도 raw 진행 = 보류
  act(() => { decInflight(); });
  await act(async () => { jest.advanceTimersByTime(OTA_NETWORK_IDLE_MS + 100); });
  expect(idleOf(tree)).toContain('true');
});

it('#109 P2: networkIdle 미충족 대기 = 타이머 스케줄 0(폴링 루프 금지) — 시간 조건 미충족만 remain 타이머', () => {
  const host = require('fs').readFileSync('src/lib/ota/OtaAutoApplyHost.tsx', 'utf8') as string;
  expect(host).toContain('if (remainMs <= 0) return;'); // 8s 경과 후엔 타이머 없음 — deps 반응만
  // 9R: 구독 3종(커밋 무관 동기 콜백) — inflight·queryCache·mutationCache
  expect(host).toContain('subscribeInflight(onEvent), qc.getQueryCache().subscribe(onEvent), qc.getMutationCache().subscribe(onEvent)');
  // 단일 관문 잠금 — 8R: client는 request() 전체 track(installationId·토큰 provider 대기 포함),
  // legalText raw fetch는 카운터 경유
  const client = require('fs').readFileSync('src/lib/api/client.ts', 'utf8') as string;
  expect(client).toContain('return track(requestInner<T>(method, path, body, isRetry, timeoutMs, extraHeaders));');
  expect(client).not.toContain('incInflight');
  const legal = require('fs').readFileSync('src/lib/legalText.ts', 'utf8') as string;
  expect(legal).toContain('incInflight();');
  expect(legal).toContain('decInflight();');
});


it('#109 2R P1 ①: idle 정착 후 새 요청 시작 = 같은 렌더에서 동기 false(다음 커밋 대기 없음)', async () => {
  jest.useFakeTimers();
  const { incInflight, decInflight } = require('@/lib/net/inflight') as typeof import('@/lib/net/inflight');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await act(async () => { jest.advanceTimersByTime(OTA_NETWORK_IDLE_MS + 100); });
  expect(idleOf(tree)).toContain('true'); // 정착
  // 새 raw 요청 시작 — busy 전환 커밋의 렌더에서 이미 false(idle && !busy)
  act(() => { incInflight(); });
  expect(idleOf(tree)).toContain('false');
  act(() => { decInflight(); });
});

it('#109 2R P1 ② → 9R: 훅 배선 잠금 — 반환·tryApply 최종 게이트 = 같은 quietRef 호출 시점 계산', () => {
  const host = require('fs').readFileSync('src/lib/ota/OtaAutoApplyHost.tsx', 'utf8') as string;
  expect(host).toContain('return networkQuietNow(qc);');
  expect(host).toContain('if (!networkQuietNow(queryClient)) return false;');
});


it('#109 3R P1: inflight.track — 네이티브 업로드 프라미스 진행 중 카운트 1, 완료/실패 모두 0 복귀 + 배선 잠금', async () => {
  jest.useRealTimers();
  const { track, inflightCount } = require('@/lib/net/inflight') as typeof import('@/lib/net/inflight');
  let resolveP!: (v: string) => void;
  const p = track(new Promise<string>((r) => { resolveP = r; }));
  expect(inflightCount()).toBe(1);
  resolveP('ok');
  await p;
  expect(inflightCount()).toBe(0);
  // 실패 경로도 dec 보장
  let rejectP!: (e: Error) => void;
  const p2 = track(new Promise<string>((_r, rej) => { rejectP = rej; }));
  expect(inflightCount()).toBe(1);
  rejectP(new Error('fail'));
  await expect(p2).rejects.toThrow('fail');
  expect(inflightCount()).toBe(0);
  // 배선: uploadAsync = track 경유(발급·complete는 client.ts 경유라 자동)
  const si = require('fs').readFileSync('src/lib/api/scanImage.ts', 'utf8') as string;
  expect(si).toContain('track(FileSystem.uploadAsync(');
});


it('#109 4R: ready 후 재체크 생략 + 체크 자체 inflight 경유 — 배선 잠금 + 체크 진행 중 카운트', async () => {
  const host = require('fs').readFileSync('src/lib/ota/OtaAutoApplyHost.tsx', 'utf8') as string;
  expect(host).toContain('if (readyRef.current) return;'); // ready = 재체크 0(네이티브 프라미스 창 제거)
  expect(host).toContain('void track(checkAndFetchOta(u, stateRef.current, Date.now()))'); // 체크 = 정적 창 포함
  // track 경유 체크 진행 중 = inflightCount 1 (track 계약 재확인 — 4R ②)
  jest.useRealTimers();
  const { track, inflightCount } = require('@/lib/net/inflight') as typeof import('@/lib/net/inflight');
  let resolveCheck!: (v: string) => void;
  const p = track(new Promise<string>((r) => { resolveCheck = r; }));
  expect(inflightCount()).toBe(1);
  resolveCheck('skip');
  await p;
  expect(inflightCount()).toBe(0);
});


it('#109 5R: 라우트 차단 복원 + 라우트 무관 네이티브 track 배선 잠금', () => {
  const fs = require('fs');
  const host = fs.readFileSync('src/lib/ota/OtaAutoApplyHost.tsx', 'utf8') as string;
  expect(host).toContain('if (isBlockedRoute(pathname)) return false;'); // 화면 단위 봉쇄(비-prod)
  expect(host).toContain('const pathname = usePathname();');
  // AuthGateSheet 소셜 로그인(어느 화면에서든)·애플 재인증·위치 = track 경유
  // 8R: 함수 본문 전체 단일 관문(내부 await 개별 track은 사이 창이 샌다)
  const social = fs.readFileSync('src/lib/auth/useSocialAuth.ts', 'utf8') as string;
  expect(social).toContain('const signInWithGoogle = (): Promise<void> => trackInflight((async () => {');
  expect(social).toContain('const signInWithApple = (): Promise<void> => trackInflight((async () => {');
  expect((social.match(/trackInflight\(/g) ?? []).length).toBe(2); // 함수 2곳뿐 — 내부 개별 track 0
  expect(fs.readFileSync('src/lib/auth/appleRevoke.ts', 'utf8')).toContain('track(AppleAuthentication.signInAsync())');
  expect(fs.readFileSync('src/lib/api/places.ts', 'utf8')).toContain('track(Location.getCurrentPositionAsync(');
  expect(fs.readFileSync('src/lib/data/orders.ts', 'utf8')).toContain('track(Location.getCurrentPositionAsync(');
});


it('#109 9R P1: 정착 후 짧은 busy(시작·종료가 커밋 전) = 타임스탬프 리셋 — 즉시 false, 500ms 재정착 후 true', async () => {
  jest.useFakeTimers();
  const { incInflight, decInflight } = require('@/lib/net/inflight') as typeof import('@/lib/net/inflight');
  const { networkQuietNow } = require('../OtaAutoApplyHost') as typeof import('../OtaAutoApplyHost');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await act(async () => { jest.advanceTimersByTime(OTA_NETWORK_IDLE_MS + 100); });
  expect(idleOf(tree)).toContain('true'); // 정착
  // 커밋 없이 같은 틱에 시작·종료 — React 상태 기반이면 idle=true가 살아남던 패턴(9R P1)
  act(() => { incInflight(); decInflight(); });
  expect(networkQuietNow(qc)).toBe(false); // tryApply 최종 게이트 = 즉시 보류
  await act(async () => { jest.advanceTimersByTime(OTA_NETWORK_IDLE_MS - 100); });
  expect(networkQuietNow(qc)).toBe(false); // 재정착 전
  await act(async () => { jest.advanceTimersByTime(200); });
  expect(networkQuietNow(qc)).toBe(true);
  expect(idleOf(tree)).toContain('true'); // 정착 타이머가 리렌더까지 트리거
});
