/** KB-873 lifecycle ②b — 체류(screen_visible_time): 보일 때만 공용 틱 1개, 가림·백그라운드·식별 정지 = 타이머 0 */
import { VisitRuntime, DWELL_TICK_MS } from '../visitRuntime';
import { runtimeContext } from '../runtimeContext';
import { CHECKPOINT_MS } from '../collector';
import type { Props } from '../schema';

const ctx = runtimeContext({ development: true, os: 'ios', beBase: 'https://dev.kbap.site', channel: 'development', nativeBuild: '46', updateId: null, runtimeVersion: '9ee06892' });
const route = (screen: 'food/[id]' | '(tabs)/index', id: string) => ({ screen, identity: JSON.stringify([[screen], id]) });

function setup(dwell: boolean) {
  let clock = 1_000;
  const events: { event: string; props: Props }[] = [];
  const live = new Set<() => void>();
  let created = 0;
  const schedule = (fn: () => void) => { created++; live.add(fn); return () => { live.delete(fn); }; };
  const runtime = new VisitRuntime(() => clock, (event, props) => events.push({ event, props }), ctx, { dwell, schedule });
  const advance = (ms: number) => { // 1초 틱을 실제처럼 돌린다(살아 있는 틱만)
    for (let t = 0; t < ms; t += DWELL_TICK_MS) { clock += DWELL_TICK_MS; live.forEach((f) => f()); }
  };
  const visible = () => events.filter((e) => e.event === 'screen_visible_time').map((e) => ({ screen: e.props.screen, delta: e.props.delta_ms, reason: e.props.reason }));
  return { runtime, events, live, advance, visible, created: () => created };
}

it('플래그 OFF(teamtest·production) = 방문 시작만 · 체류 이벤트 0 · 타이머 생성 0', () => {
  const s = setup(false);
  s.runtime.setForeground(true);
  s.runtime.focus(route('(tabs)/index', 'h'));
  s.advance(60_000);
  s.runtime.setOccluded(true); s.runtime.setOccluded(false); s.runtime.focus(route('food/[id]', '7'));
  expect(s.events.map((e) => e.event)).toEqual(['screen_visit_start', 'screen_visit_start']);
  expect(s.created()).toBe(0);
});

it('플래그 ON: 보이는 동안 틱 1개 · 15초 checkpoint · 가림 = visibility_end flush + 타이머 0 + 가린 동안 0 누적 · 다시 보이면 이어서', () => {
  const s = setup(true);
  s.runtime.setForeground(true);
  s.runtime.focus(route('(tabs)/index', 'h'));
  expect(s.live.size).toBe(1);
  s.advance(CHECKPOINT_MS);
  expect(s.visible()).toEqual([{ screen: '(tabs)/index', delta: CHECKPOINT_MS, reason: 'checkpoint' }]);
  s.advance(4_000);
  s.runtime.setOccluded(true); // Modal·Alert·사진 선택기·전면 광고
  expect(s.visible().at(-1)).toEqual({ screen: '(tabs)/index', delta: 4_000, reason: 'visibility_end' });
  expect(s.live.size).toBe(0);
  const n = s.events.length;
  s.advance(30_000); // 가린 동안 — 틱 없음, 시계만 흐름
  expect(s.events.length).toBe(n);
  s.runtime.setOccluded(false);
  expect(s.live.size).toBe(1);
  s.advance(2_000);
  s.runtime.focus(route('food/[id]', '7')); // 이동 = 이전 방문 exit flush(가린 30초 제외)
  expect(s.visible().at(-1)).toEqual({ screen: '(tabs)/index', delta: 2_000, reason: 'exit' });
  expect(s.live.size).toBe(1); // 새 방문도 틱 하나(중복 생성 0)
});

it('백그라운드 = visibility_end + 타이머 0 · 복귀 = 같은 방문 이어서 · 식별 정지 = 미송신분 폐기 + 타이머 0 · dispose = 타이머 0', () => {
  const s = setup(true);
  s.runtime.setForeground(true);
  s.runtime.focus(route('food/[id]', '7'));
  s.advance(3_000);
  s.runtime.setForeground(false);
  expect(s.visible().at(-1)).toEqual({ screen: 'food/[id]', delta: 3_000, reason: 'visibility_end' });
  expect(s.live.size).toBe(0);
  s.advance(60_000);
  s.runtime.setForeground(true);
  expect(s.live.size).toBe(1);
  expect(s.events.filter((e) => e.event === 'screen_visit_start')).toHaveLength(1); // 같은 화면 복귀 = 새 방문 아님
  s.advance(5_000);
  const before = s.events.length;
  s.runtime.suspendIdentity(); // 계정 경계 — 다음 식별자에 귀속되지 않게 미송신 5초 폐기
  expect(s.events.length).toBe(before);
  expect(s.live.size).toBe(0);
  s.runtime.resumeIdentity();
  expect(s.live.size).toBe(1);
  s.runtime.dispose();
  expect(s.live.size).toBe(0);
});
