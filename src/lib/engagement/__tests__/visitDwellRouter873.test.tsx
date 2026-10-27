/**
 * KB-873 ②b — 체류 경로를 **실제 expo-router 트리**(ExpoRoot + 실제 '__root' 상태)·실제 호스트·실제 가림(pushOcclusion)으로 잠근다.
 * 합성 상태는 #342 QA AV에서 결함을 가렸다 — 체류도 실제 라우터로 본다.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Text } from 'react-native';

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('@/lib/data/config', () => ({ BE_BASE: 'https://dev.kbap.site' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { platform: { ios: { buildNumber: '46' } } } }));
jest.mock('expo-updates', () => ({ channel: 'development', updateId: null, runtimeVersion: '9ee06892' }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ExpoRoot, Stack, Tabs, router } from 'expo-router';
import { getMockContext } from 'expo-router/build/testing-library/mock-config';
import { __resetDeeplinkForTest } from '@/lib/deeplink';
import { FLAGS } from '@/lib/flags';
import { pushOcclusion, _resetOcclusionForTest } from '../occlusion';
import { resumeEngagementIdentity } from '../visitRuntime';
import { VisitTrackingHost } from '../VisitTrackingHost';
/* eslint-enable import/first */

const Page = (name: string) => function P() { return <Text>{name}</Text>; };
const trees: ReactTestRenderer[] = [];
function renderRouter(routes: Record<string, React.ComponentType>) {
  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
  const ctx = getMockContext(routes as never);
  act(() => { trees.push(renderer.create(<ExpoRoot context={ctx} location="/" />)); });
}
const ROUTES = {
  _layout: () => <><Stack /><VisitTrackingHost /></>,
  '(tabs)/_layout': () => <Tabs />,
  '(tabs)/index': Page('home'),
  'food/[id]/index': Page('detail'),
};
/** 가짜 타이머 위에서 라우터·호스트의 마이크로태스크·0ms 재읽기를 비운다 */
// 라우터 정착·호스트의 마이크로태스크·0ms 재읽기 — 짧은 단계로(체류 checkpoint 측정에 영향 없게 총 50ms 안)
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { jest.advanceTimersByTime(5); await Promise.resolve(); }); };
const run = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); await Promise.resolve(); });
const dwell = () => mockTrack.mock.calls.filter((c) => c[0] === 'screen_visible_time').map((c) => {
  const p = c[1] as { screen: string; delta_ms: number; reason: string };
  return { screen: p.screen, delta: p.delta_ms, reason: p.reason };
});
const prevDwell = FLAGS.engagementDwell;

beforeEach(() => {
  jest.useFakeTimers();
  mockTrack.mockClear(); __resetDeeplinkForTest(true); _resetOcclusionForTest(); resumeEngagementIdentity();
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
});
afterEach(() => {
  act(() => trees.splice(0).forEach((t) => t.unmount()));
  (FLAGS as { engagementDwell: boolean }).engagementDwell = prevDwell;
  jest.useRealTimers();
});

it('dev 채널(ON): 홈 15초 = checkpoint · 덮개 = visibility_end(가린 20초 0 누적) · 상세로 이동 = exit flush(보인 3초만)', async () => {
  (FLAGS as { engagementDwell: boolean }).engagementDwell = true;
  renderRouter(ROUTES);
  await settle();
  expect(mockTrack.mock.calls.filter((c) => c[0] === 'screen_visit_start')).toHaveLength(1);
  await run(15_000);
  expect(dwell()).toEqual([{ screen: '(tabs)/index', delta: 15_000, reason: 'checkpoint' }]);
  await run(2_000);
  let release!: () => void;
  await act(async () => { release = pushOcclusion(); }); // Modal·Alert·사진 선택기 등(래퍼가 같은 원시 함수를 쓴다)
  // settle(≤50ms)가 방문 시작 뒤에 흘러 checkpoint 다음 구간에 남는다 — 그 창만 허용
  expect(dwell().at(-1)).toMatchObject({ screen: '(tabs)/index', reason: 'visibility_end' });
  expect(dwell().at(-1)!.delta).toBeGreaterThanOrEqual(2_000);
  expect(dwell().at(-1)!.delta).toBeLessThanOrEqual(2_050);
  const n = dwell().length;
  await run(20_000);
  expect(dwell()).toHaveLength(n); // 가린 동안 체류 0
  await act(async () => { release(); });
  await run(3_000);
  await act(async () => { router.push('/food/7'); }); await settle();
  expect(dwell().at(-1)).toMatchObject({ screen: '(tabs)/index', reason: 'exit' });
  expect(dwell().at(-1)!.delta).toBeGreaterThanOrEqual(3_000); // 가린 20초는 빠진다
  expect(dwell().at(-1)!.delta).toBeLessThanOrEqual(3_050);
  expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('"7"'); // id 원문 전송 0
});

it('teamtest·production(OFF) = 실제 라우터에서도 방문 시작만 · 체류 이벤트 0', async () => {
  (FLAGS as { engagementDwell: boolean }).engagementDwell = false;
  renderRouter(ROUTES);
  await settle();
  await run(40_000);
  await act(async () => { router.push('/food/7'); }); await settle();
  expect(mockTrack.mock.calls.map((c) => c[0])).toEqual(['screen_visit_start', 'screen_visit_start']);
});
