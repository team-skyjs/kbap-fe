import * as React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';

const mockTrack = jest.fn();
let mockState: unknown;
let mockResolved = false;
let mockHolding = false;
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
// 실제 expo-router 57 모양: 컨테이너 ref(state 이벤트) + 루트 상태 = '__root' 래퍼 안에 앱 스택(QA AV — 합성 상태가 이 둘을 가려 0건을 놓쳤다)
const mockNav = { isReady: () => true, getRootState: () => mockState, addListener: (_e: string, _cb: (e: { data: { state: unknown } }) => void) => () => {} };
jest.mock('expo-router', () => ({ useNavigationContainerRef: () => mockNav }));
jest.mock('@/lib/data/config', () => ({ BE_BASE: 'https://prod.kbap.site' }));
jest.mock('@/lib/deeplink', () => ({
  subscribeEntryResolved: () => () => {}, isEntryResolved: () => mockResolved, hasPendingDeeplink: () => mockHolding,
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { platform: { ios: { buildNumber: '45' } } } }));
jest.mock('expo-updates', () => ({ channel: 'production', updateId: null, runtimeVersion: '9ee06892b67f66f1ea72c0bc5725eb853442df11' }));
// eslint-disable-next-line import/first
import { VisitTrackingHost } from '../VisitTrackingHost';
// eslint-disable-next-line import/first
import { resumeEngagementIdentity } from '../visitRuntime';

beforeEach(() => {
  mockTrack.mockClear(); mockResolved = false; mockHolding = false;
  resumeEngagementIdentity(); // 부팅 기본 = 식별 미정 — 이 유닛은 식별 확정 뒤의 진입·보류만 본다
  mockState = { routes: [{ name: '__root', key: 'root', state: { routes: [{ name: 'food/[id]/index', key: 'detail', params: { id: 'sensitive-id' } }] } }] };
});

test('entry/deeplink hold, foreground and StrictMode replay produce one settled visit; listener cleans up', async () => {
  const remove = jest.fn();
  let change: ((value: string) => void) | undefined;
  const sub = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    change = listener as (value: string) => void;
    return { remove };
  });
  let tree: renderer.ReactTestRenderer | undefined;
  const render = () => <React.StrictMode><VisitTrackingHost /></React.StrictMode>;
  try {
    await act(async () => { tree = renderer.create(render()); });
    await act(async () => { change?.('active'); });
    expect(mockTrack).not.toHaveBeenCalled();
    mockResolved = true; mockHolding = true;
    await act(async () => { tree!.update(render()); });
    expect(mockTrack).not.toHaveBeenCalled();
    mockHolding = false;
    await act(async () => { tree!.update(render()); });
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack.mock.calls[0]).toEqual(['screen_visit_start', expect.objectContaining({ screen: 'food/[id]', channel: 'production', app_build: '45' })]);
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('sensitive-id');
    await act(async () => { tree!.update(render()); change?.('background'); change?.('active'); });
    expect(mockTrack).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => { tree?.unmount(); });
    expect(remove).toHaveBeenCalled(); sub.mockRestore();
  }
});
