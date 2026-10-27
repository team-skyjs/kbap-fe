import { VisitRuntime, installVisitRuntime, suspendEngagementIdentity, resumeEngagementIdentity } from '../visitRuntime';
import { activeVisitRoute, type RouteState } from '../visitRoute';
import { runtimeContext } from '../runtimeContext';
import type { Props } from '../schema';

const context = runtimeContext({ development: false, os: 'ios', beBase: 'https://prod.kbap.site', channel: 'production' });
function setup() {
  const events: { event: string; props: Props }[] = [];
  const runtime = new VisitRuntime(() => 1000, (event, props) => events.push({ event, props }), context);
  runtime.setForeground(true);
  return { runtime, events };
}
const state = (id: string, key = 'detail-1'): RouteState => ({ index: 0, routes: [{ name: 'food/[id]/index', key, params: { id, query: 'private text' } }] });

test('root/unsettled/unknown routes wait, nested active leaf only and route params stay memory-only', () => {
  expect(activeVisitRoute(undefined)).toBeNull();
  expect(activeVisitRoute({ routes: [{ name: '(tabs)' }] })).toBeNull();
  expect(activeVisitRoute({ routes: [{ name: 'private/actual-id' }] })).toBeNull();
  // QA AV: 키 없는 라우트 = 정착 전(stale) 상태 → 대기. 실제 라우터는 '__root' 래퍼 안에 키 붙은 스택
  expect(activeVisitRoute({ routes: [{ name: '(tabs)', state: { index: 1, routes: [{ name: 'index' }, { name: 'profile' }] } }] })).toBeNull();
  const tab = activeVisitRoute({ routes: [{ name: '__root', key: 'r', state: { routes: [{ name: '(tabs)', key: 't', state: { index: 1, routes: [{ name: 'index', key: 'i' }, { name: 'profile', key: 'p' }] } }] } }] });
  expect(tab?.screen).toBe('(tabs)/profile');
  const { runtime, events } = setup();
  runtime.focus(activeVisitRoute(state('private-food-id')));
  expect(events[0].props.screen).toBe('food/[id]');
  expect(JSON.stringify(events)).not.toMatch(/private|query|detail-1/);
});

test('same leaf rerender and query changes do not restart; content/key change and A-B-A do', () => {
  const { runtime, events } = setup();
  runtime.focus(activeVisitRoute(state('A'))); runtime.focus(activeVisitRoute(state('A')));
  runtime.focus(activeVisitRoute({ routes: [{ name: 'food/[id]/index', key: 'detail-1', params: { id: 'A', query: 'changed' } }] }));
  expect(events).toHaveLength(1);
  runtime.focus(activeVisitRoute(state('B'))); runtime.focus(activeVisitRoute(state('A')));
  runtime.focus(activeVisitRoute(state('A', 'detail-2')));
  expect(events.map((e) => e.props.source)).toEqual(['navigation', 'content_change', 'content_change', 'content_change']);
  expect(new Set(events.map((e) => e.props.screen_visit_id)).size).toBe(4);
});

test('inactive background waits for focus, return to same active leaf does not duplicate', () => {
  const { runtime, events } = setup();
  runtime.setForeground(false); runtime.focus(activeVisitRoute(state('A')));
  expect(events).toHaveLength(0);
  runtime.setForeground(true); runtime.setForeground(true); runtime.setForeground(false); runtime.setForeground(true);
  expect(events).toHaveLength(1);
  runtime.setForeground(false); runtime.focus(activeVisitRoute(state('B'))); expect(events).toHaveLength(1);
  runtime.setForeground(true); expect(events).toHaveLength(2);
});

test('identity boundary discards current visit and waits until SDK identity settlement; no elapsed-time emission yet', () => {
  resumeEngagementIdentity(); // 부팅 기본 = 식별 미정(Codex #342) — 이 유닛은 식별 확정 뒤의 경계만 본다
  const { runtime, events } = setup(); const uninstall = installVisitRuntime(runtime);
  try {
    runtime.focus(activeVisitRoute(state('A')));
    suspendEngagementIdentity(); runtime.focus(activeVisitRoute(state('B'))); runtime.setForeground(true);
    expect(events).toHaveLength(1);
    resumeEngagementIdentity(); expect(events).toHaveLength(2);
    expect(events[1].props.screen_visit_id).not.toBe(events[0].props.screen_visit_id);
    runtime.focus(null); runtime.dispose();
    expect(events.every((e) => e.event === 'screen_visit_start')).toBe(true);
  } finally { resumeEngagementIdentity(); uninstall(); }
});

test('a boundary before host mount remains suspended and cleanup disposes ownership', () => {
  suspendEngagementIdentity(); const { runtime, events } = setup(); const uninstall = installVisitRuntime(runtime);
  runtime.focus(activeVisitRoute(state('A'))); expect(events).toHaveLength(0);
  resumeEngagementIdentity(); expect(events).toHaveLength(1);
  uninstall(); resumeEngagementIdentity(); expect(events).toHaveLength(1);
});

test.each(['production', 'preview', 'teamtest', 'teamtest-prod', 'development'])('actual channel %s survives independently of BE and release mode', (channel) => {
  expect(runtimeContext({ development: false, os: 'android', beBase: 'https://dev.kbap.site', channel, nativeVersion: '1.0.4', nativeBuild: 29 })).toMatchObject({ channel, app_env: 'release', be_env: 'dev', app_version: '1.0.4', app_build: '29' });
});

test('missing/invalid installed metadata becomes unknown, secrets/URL are never props', () => {
  const props = runtimeContext({ development: false, os: 'invalid', beBase: 'https://prod.kbap.site.attacker.test/private?token=private', channel: 'private', nativeVersion: 'private', runtimeVersion: { policy: 'fingerprint' } });
  expect(props).toMatchObject({ be_env: 'other', channel: 'unknown', os: 'unknown', app_version: 'unknown', app_build: 'unknown', update_id: 'unknown', runtime_version: 'unknown' });
  expect(JSON.stringify(props)).not.toMatch(/private|attacker|token|policy/);
  expect(runtimeContext({ development: true, os: 'web', beBase: 'invalid' }).channel).toBe('local');
  expect(context.channel).toBe('production');
});
