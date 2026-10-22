import { EngagementCollector } from '../collector';
import { sanitizeEngagement, type Props, type RuntimeContext } from '../schema';
import { sanitize } from '../../analytics';
import { screenFromSegments } from '../../uiClick';
import { readdirSync } from 'fs';
import { join } from 'path';

const runtime: RuntimeContext = { app_env: 'release', be_env: 'dev', channel: 'teamtest', app_version: '1.0.4', app_build: '45', os: 'ios', update_id: 'unknown', runtime_version: 'unknown' };
function setup() {
  let time = 0;
  const events: { event: string; props: Props }[] = [];
  const c = new EngagementCollector(() => time, (event, props) => events.push({ event, props }), runtime);
  const advance = (ms: number) => { time += ms; };
  const visible = (foreground = true, focused = true, uncovered = true) => c.setVisibility({ foreground, focused, uncovered });
  const props = (event: string) => events.filter((x) => x.event === event).map((x) => x.props);
  c.begin('food/[id]', 'navigation'); visible();
  return { c, events, advance, visible, props };
}
const geometry = { intersection: 100, target: 100, viewport: 100 };
const sample = { offset: 0, viewport: 100, contentLength: 400, origin: 'initial' as const, loadedPages: 1, maxPosition: 0, hasMore: true };

test('visible delta excludes background, focus loss and covering modal; duplicate checkpoint cannot double count', () => {
  const { c, advance, visible, props } = setup();
  advance(15000); c.tick(); c.tick();
  advance(2000); visible(false); advance(50000); visible();
  advance(1000); visible(true, false); advance(90000); visible();
  advance(3000); visible(true, true, false); advance(40000); visible();
  advance(4000); c.end();
  const times = props('screen_visible_time');
  expect(times.map((p) => p.delta_ms)).toEqual([15000, 2000, 1000, 3000, 4000]);
  expect(times.map((p) => p.sequence)).toEqual([1, 2, 3, 4, 5]);
});
test('redundant active callbacks do not postpone 15s checkpoints', () => {
  const { c, advance, visible, props } = setup();
  advance(10000); visible(); advance(5000); c.tick();
  expect(props('screen_visible_time')).toMatchObject([{ delta_ms: 15000, reason: 'checkpoint' }]);
});
test('same route content replacement/focus return gets a new visit ID; account reset drops prior buffers', () => {
  const { c, advance, props } = setup();
  advance(200); c.begin('food/[id]', 'content_change'); advance(500); c.reset(); c.tick();
  c.begin('food/[id]', 'navigation'); advance(300); c.end();
  expect(new Set(props('screen_visit_start').map((p) => p.screen_visit_id)).size).toBe(3);
  expect(props('screen_visible_time').map((p) => p.delta_ms)).toEqual([200, 300]);
});
test('impression requires continuous1s, including interruption by background; large cards use viewport denominator', () => {
  const { c, advance, visible, props } = setup();
  c.observe('card_1', 'card', 0, { intersection: 50, target: 1000, viewport: 100 });
  advance(900); visible(false); advance(10000); visible(); advance(900); c.tick();
  expect(props('screen_surface_impression')).toHaveLength(0);
  advance(100); c.tick(); c.tick();
  expect(props('screen_surface_impression')).toHaveLength(1);
  c.observe('card_1', 'card', 0, { ...geometry, intersection: 0 }); advance(100);
  c.observe('card_1', 'card', 0, geometry); advance(1100); c.tick();
  expect(props('screen_surface_impression')).toHaveLength(1);
  c.observe('card_1', 'card', 1, geometry); advance(1000); c.tick();
  expect(props('screen_surface_impression')).toHaveLength(2);
  expect(props('screen_surface_impression')[1].list_generation).toBe(1);
});
test('invalid geometry ends visibility and unregistration flushes only prior measured delta', () => {
  const { c, advance, props } = setup(); c.observe('card_1', 'card', 0, geometry);
  advance(500); c.observe('card_1', 'card', 0, { ...geometry, target: NaN });
  advance(10000); c.remove('card_1');
  expect(props('screen_surface_visible_time').map((p) => p.delta_ms)).toEqual([500]);
});
test('scroll thresholds bounded by visit+area+generation; short pages are not scrolled-to-end', () => {
  const { c, props } = setup(); c.observe('body_1', 'body', 0, geometry);
  c.scroll('body_1', 'vertical', sample);
  for (let i = 0; i < 1000; i++) c.scroll('body_1', 'vertical', { ...sample, offset: 1000, origin: 'user' });
  expect(props('screen_scroll_depth').map((p) => p.depth)).toEqual([25, 50, 75, 90, 100]);
  expect(props('screen_scroll_depth')[0].origin).toBe('initial');
  c.observe('body_2', 'body', 0, geometry); c.scroll('body_2', 'vertical', { ...sample, contentLength: 50 });
  expect(props('screen_scroll_depth')).toHaveLength(5);
  c.observe('body_1', 'body', 1, geometry); c.scroll('body_1', 'vertical', sample);
  expect(props('screen_scroll_depth')).toHaveLength(6);
});
test('page append changes length but not generation or prior milestones; user gestures separate from programmatic movement', () => {
  const { c, advance, props } = setup(); c.observe('rail_1', 'rail', 1, geometry);
  c.scroll('rail_1', 'horizontal', { ...sample, offset: 300, origin: 'programmatic' });
  c.userScroll('rail_1');
  c.scroll('rail_1', 'horizontal', { ...sample, offset: 200, contentLength: 800, origin: 'user', loadedPages: 2, maxPosition: 7 });
  c.scroll('rail_1', 'horizontal', { ...sample, offset: 300, contentLength: 800, origin: 'user', loadedPages: 2, maxPosition: 8 });
  advance(15000); c.tick(); c.tick();
  const summaries = props('screen_scroll_summary'); expect(summaries).toHaveLength(1);
  expect(summaries[0]).toMatchObject({ max_depth: 100, content_length: 800, loaded_pages: 2, max_position: 8, user_scrolls: 1, direction_changes: 1 });
});
test('overscroll clamps, end tolerance2 units, hidden scroll callbacks create no events', () => {
  const { c, visible, props } = setup(); c.observe('body_1', 'body', 0, geometry);
  c.scroll('body_1', 'vertical', { ...sample, offset: 298, origin: 'user' });
  expect(props('screen_scroll_depth').at(-1)?.depth).toBe(100);
  visible(false); c.scroll('body_1', 'vertical', { ...sample, offset: -100 });
  expect(props('screen_scroll_depth')).toHaveLength(5);
});
test('regressing/invalid clock cannot produce negative or NaN duration; sink failure cannot break UI', () => {
  let time = 100;
  const send = jest.fn(); const c = new EngagementCollector(() => time, send, runtime);
  c.begin('scan', 'navigation'); c.setVisibility({ foreground: true, focused: true, uncovered: true });
  time = 50; c.tick(); time = NaN; c.tick(); time = 200; c.end();
  expect(send.mock.calls.find(([event]) => event === 'screen_visible_time')?.[1].delta_ms).toBe(100);
  const bad = new EngagementCollector(() => 0, () => { throw new Error('sdk unavailable'); }, runtime);
  expect(() => { bad.begin('scan', 'unknown'); bad.end(); }).not.toThrow();
});
test('adapter registers schema2 keys, validates values, excludes sensitive strings and leaves legacy properties unchanged', () => {
  const raw = { schema_version: 2, screen: 'scan', source: 'navigation', delta_ms: 50, sequence: 1, reason: 'exit', screen_visit_id: 'v123_4', channel: 'teamtest', app_version: '1.0.4', ocrText: 'private', email: 'private@example.com', target: 'avoid-EGG', runtime_version: 'file://private', update_id: 'https://private', be_env: 'private@example.com', os: 'ios' };
  const p = sanitize('screen_visible_time', raw);
  expect(p).toMatchObject({ delta_ms: 50, screen_visit_id: 'v123_4', channel: 'teamtest' });
  for (const key of ['ocrText', 'email', 'target', 'runtime_version', 'update_id', 'be_env']) expect(p).not.toHaveProperty(key);
  expect(sanitizeEngagement('screen_scroll_depth', { depth: 26, origin: 'private', screen: 'food/123', list_generation: NaN })).toEqual({});
  expect(sanitize('food_bookmark_toggle', { on: true, food_id: 123 })).toEqual({ on: true });
});

test('five-minute 60fps scroll stream emits bounded milestones/checkpoints, never per frame', () => {
  const { c, advance, events } = setup(); c.observe('body_1', 'body', 0, geometry);
  c.scroll('body_1', 'vertical', sample); c.userScroll('body_1');
  for (let second = 0; second < 300; second++) {
    for (let frame = 0; frame < 60; frame++) c.scroll('body_1', 'vertical', { ...sample, offset: second, origin: 'user' });
    advance(1000); c.tick();
  }
  c.end();
  expect(events.filter((e) => e.event === 'screen_scroll_depth')).toHaveLength(5);
  expect(events.filter((e) => e.event === 'screen_visible_time')).toHaveLength(20);
  expect(events.length).toBeLessThanOrEqual(70);
  expect(events.filter((e) => e.event === 'screen_visible_time').reduce((n, e) => n + Number(e.props.delta_ms), 0)).toBe(300000);
});

test('begin-drag before the first onScroll is counted once', () => {
  const { c, advance, props } = setup(); c.observe('body_1', 'body', 0, geometry);
  c.userScroll('body_1'); c.scroll('body_1', 'vertical', { ...sample, origin: 'user' });
  advance(15000); c.tick(); expect(props('screen_scroll_summary')[0].user_scrolls).toBe(1);
});


test('all current route files retain the canonical screenFromSegments output at the adapter boundary', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(path);
    return entry.name.endsWith('.tsx') && !entry.name.startsWith('_') && !entry.name.startsWith('+') && entry.name !== 'states.tsx' ? [path] : [];
  });
  const routes = walk('src/app');
  expect(routes.length).toBeGreaterThan(30);
  for (const route of routes) {
    const segments = route.replace(/^src\/app\//, '').replace(/\.tsx$/, '').split('/');
    if (segments.at(-1) === 'index') segments.pop();
    const screen = screenFromSegments(segments);
    expect({ route, screen: sanitize('screen_visit_start', { screen })?.screen }).toEqual({ route, screen });
  }
  for (const screen of ['compose', 'post/[id]', 'onboarding/index', 'profile/feedback/index', 'food/private-id']) {
    expect(sanitize('screen_visit_start', { screen })).not.toHaveProperty('screen');
  }
});

test.each(['body', 'rail', 'photos', 'card', 'sheet', 'dialog'] as const)('area prefix must match %s in collector and sanitizer', (surface) => {
  const { c, advance, events } = setup();
  const areaEvents = ['screen_surface_impression', 'screen_surface_visible_time', 'screen_scroll_depth', 'screen_scroll_summary'] as const;
  const id = `${surface}_1`;
  for (const wrong of ['screen', 'body', 'rail', 'photos', 'card', 'sheet', 'dialog'] as const) {
    if (wrong === surface) continue;
    c.observe(id, wrong, 0, geometry);
    c.scroll(id, 'vertical', sample);
    for (const event of areaEvents) expect(sanitizeEngagement(event, { screen: 'scan', area_id: id, surface: wrong, depth: 25 })).toEqual({});
  }
  advance(1000); c.tick(); c.end();
  expect(events.filter((e) => e.props.area_id)).toEqual([]);
  expect(sanitizeEngagement('screen_surface_impression', { area_id: id, surface })).toEqual({ area_id: id, surface });
});

test('invalid re-registration cannot replace or flush an existing valid area', () => {
  const { c, advance, events, props } = setup();
  c.observe('card_1', 'card', 0, geometry);
  advance(600); c.observe('card_1', 'body', 1, geometry);
  expect(events.filter((e) => e.props.area_id)).toEqual([]);
  advance(400); c.tick(); c.end();
  expect(props('screen_surface_impression')).toMatchObject([{ area_id: 'card_1', surface: 'card', list_generation: 0 }]);
  expect(props('screen_surface_visible_time')).toMatchObject([{ surface: 'card', list_generation: 0, delta_ms: 1000 }]);
});
