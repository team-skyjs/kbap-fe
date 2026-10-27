/**
 * QA AV(da6fc0b4) 회귀 — 합성 상태가 아니라 **실제 expo-router 트리**(renderRouter)로 방문 시작을 잠근다.
 * 놓쳤던 두 가지: ① useRootNavigationState는 구독 없는 스냅숏(루트 레이아웃이 다시 안 그려짐) ② 루트 상태가 '__root' 래퍼로 시작.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Text } from 'react-native';

const mockTrack = jest.fn();
// track만 대역 — setAnalyticsUser 등 식별 경로는 실제 모듈(Codex #342: 저장 세션 + 늦은 프로필 = 첫 방문 1번)
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('@/lib/data/config', () => ({ BE_BASE: 'https://dev.kbap.site' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { platform: { ios: { buildNumber: '46' } } } }));
jest.mock('expo-updates', () => ({ channel: 'development', updateId: null, runtimeVersion: '9ee06892' }));

/* eslint-disable import/first -- jest.mock 뒤 */
import { ExpoRoot, Slot, Stack, Tabs, router } from 'expo-router';
import { getMockContext } from 'expo-router/build/testing-library/mock-config';
import { store } from 'expo-router/build/global-state/router-store';
import { __resetDeeplinkForTest } from '@/lib/deeplink';
import { setAnalyticsUser } from '@/lib/analytics';
import { resumeEngagementIdentity } from '../visitRuntime';
import { VisitTrackingHost } from '../VisitTrackingHost';
/* eslint-enable import/first */

const visits = () => mockTrack.mock.calls.filter((c) => c[0] === 'screen_visit_start').map((c) => (c[1] as { screen: string }).screen);
const flush = () => act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); await Promise.resolve(); });
const Page = (name: string) => function P() { return <Text>{name}</Text>; };
// expo-router/testing-library의 renderRouter와 같은 조립(인메모리 라우트 → ExpoRoot) — RNTL 의존 없이 react-test-renderer로
const trees: ReactTestRenderer[] = [];
function renderRouter(routes: Record<string, React.ComponentType>, initialUrl = '/') {
  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
  const ctx = getMockContext(routes as never);
  act(() => { trees.push(renderer.create(<ExpoRoot context={ctx} location={initialUrl} />)); });
}
afterEach(() => { act(() => trees.splice(0).forEach((t) => t.unmount())); });

beforeEach(() => { mockTrack.mockClear(); __resetDeeplinkForTest(true); });

// 이 파일 첫 테스트 = 새 모듈 상태(부팅 그대로 — 식별 미정). 저장된 세션의 프로필이 스플래시 뒤 도착하는 경로
it('Codex #342: 저장된 세션 + 늦은 프로필 = 프로필 전엔 방문 0 · 도착 뒤 첫 화면 정확히 1번(익명 선발송·재발송 0) · 같은 회원 재조회 = 추가 0', async () => {
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true }); // 앱 앞(부팅 직후)
  renderRouter({
    _layout: () => <><Stack /><VisitTrackingHost /></>,
    '(tabs)/_layout': () => <Tabs />,
    '(tabs)/index': Page('home'),
  }, '/');
  await flush();
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(visits()).toEqual([]); // 식별 미정 = 익명으로 먼저 보내지 않는다
  await act(async () => { setAnalyticsUser('41'); }); await flush();
  expect(visits()).toEqual(['(tabs)/index']);
  await act(async () => { setAnalyticsUser('41'); }); await flush(); // useMe 재조회(같은 회원)
  expect(visits()).toEqual(['(tabs)/index']);
});

it('홈 → 음식 탭 → 상세 2개(콘텐츠 교체) → 스캔 → 프로필 = 화면마다 screen_visit_start · 같은 화면 재렌더·포그라운드 복귀 = 중복 0', async () => {
  resumeEngagementIdentity(); // 식별 확정 상태에서(순서 독립)
  const handlers: ((s: string) => void)[] = [];
  const orig = AppState.addEventListener;
  AppState.addEventListener = ((e: 'change', h: (s: string) => void) => { handlers.push(h); return orig.call(AppState, e, h as never); }) as typeof AppState.addEventListener;
  try {
    renderRouter({
      _layout: () => <><Stack /><VisitTrackingHost /></>,
      '(tabs)/_layout': () => <Tabs />,
      '(tabs)/index': Page('home'),
      '(tabs)/food': Page('food'),
      '(tabs)/profile': Page('profile'),
      'food/[id]/index': Page('detail'),
      scan: Page('scan'),
    }, '/');
    await act(async () => { handlers.forEach((h) => h('active')); });
    await flush();
    expect(visits()).toEqual(['(tabs)/index']);
    await act(async () => { router.navigate('/food'); }); await flush();
    await act(async () => { router.push('/food/7'); }); await flush();
    await act(async () => { router.push('/food/8'); }); await flush();
    await act(async () => { router.push('/scan'); }); await flush();
    await act(async () => { router.navigate('/profile'); }); await flush();
    expect(visits()).toEqual(['(tabs)/index', '(tabs)/food', 'food/[id]', 'food/[id]', 'scan', '(tabs)/profile']);
    const sources = mockTrack.mock.calls.filter((c) => c[0] === 'screen_visit_start').map((c) => (c[1] as { source: string }).source);
    expect(sources[3]).toBe('content_change'); // 같은 상세 패턴 · 다른 id
    expect(JSON.stringify(mockTrack.mock.calls)).not.toMatch(/"7"|"8"/); // id 원문 전송 0
    const n = visits().length;
    await act(async () => { handlers.forEach((h) => h('background')); handlers.forEach((h) => h('active')); }); await flush();
    expect(visits()).toHaveLength(n); // 같은 화면 복귀 = 새 방문 아님
  } finally {
    AppState.addEventListener = orig;
  }
});

it("expo-router 57 실제 루트 상태 = '__root' 래퍼로 시작(이 가정이 깨지면 visitRoute의 래퍼 건너뛰기를 다시 볼 것)", async () => {
  renderRouter({ _layout: () => <Slot />, index: Page('i') }, '/');
  await flush();
  expect(store.navigationRef.getRootState().routes[0]?.name).toBe('__root');
});
