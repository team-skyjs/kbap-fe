import { EngagementCollector } from './collector';
import { type EngagementEvent, type Props, type RuntimeContext, type Screen } from './schema';

export interface VisitRoute { screen: Screen; identity: string }
/** KB-873 ②b — 체류 송신 옵션. dwell false(teamtest·production) = setVisibility·타이머 0, 방문 시작만. */
export interface DwellOptions {
  dwell: boolean;
  /** 공용 틱 하나 — 보일 때만 살아 있다. 반환 = 정지 */
  schedule?: (fn: () => void, ms: number) => () => void;
}
/** 공용 틱 간격 — 15초 checkpoint·1초 impression 판정의 해상도 */
export const DWELL_TICK_MS = 1_000;
const defaultSchedule = (fn: () => void, ms: number) => { const id = setInterval(fn, ms); return () => clearInterval(id); };
/** Route identity is memory-only. Visible time = 보임(앱 앞 · 덮개 0 · 방문 중)인 동안만, 공용 틱 1개로 집계. */
export class VisitRuntime {
  private collector: EngagementCollector;
  private route: VisitRoute | null = null;
  private current: VisitRoute | null = null;
  private foreground = false;
  private occluded = false;
  private suspended = false;
  private stopTicker: (() => void) | null = null;
  private readonly dwell: boolean;
  private readonly schedule: (fn: () => void, ms: number) => () => void;
  constructor(now: () => number, send: (event: EngagementEvent, props: Props) => void, context: RuntimeContext, options: DwellOptions = { dwell: false }) {
    this.collector = new EngagementCollector(now, send, context);
    this.dwell = options.dwell;
    this.schedule = options.schedule ?? defaultSchedule;
  }
  setForeground(active: boolean) { this.foreground = active; this.sync(); this.applyVisibility(); }
  /** occlusion.ts isOccluded() — 앱 안 덮개(Modal·Alert·사진 선택기·전면 광고·동의 폼) 또는 AppState≠active */
  setOccluded(value: boolean) { this.occluded = value; this.applyVisibility(); }
  focus(route: VisitRoute | null) { this.route = route; this.sync(); this.applyVisibility(); }
  /** 보이는 동안만 틱 1개 — 가림·백그라운드·식별 정지·방문 없음 = 타이머 0. 보임 → 숨김은 collector가 visibility_end로 flush */
  private applyVisibility() {
    if (!this.dwell) return;
    const focused = !this.suspended && this.current != null;
    this.collector.setVisibility({ foreground: this.foreground, focused, uncovered: !this.occluded });
    const visible = focused && this.foreground && !this.occluded;
    if (visible && !this.stopTicker) this.stopTicker = this.schedule(() => this.collector.tick(), DWELL_TICK_MS);
    else if (!visible && this.stopTicker) { this.stopTicker(); this.stopTicker = null; }
  }
  private sync() {
    if (this.suspended) return;
    if (!this.route) { this.collector.end(); this.current = null; return; }
    if (!this.foreground) return;
    if (this.current?.screen === this.route.screen && this.current.identity === this.route.identity) return;
    const source = this.current?.screen === this.route.screen ? 'content_change' : 'navigation';
    this.current = this.route;
    this.collector.begin(this.route.screen, source);
  }
  suspendIdentity() { this.suspended = true; this.collector.reset(); this.current = null; this.applyVisibility(); }
  resumeIdentity() { this.suspended = false; this.sync(); this.applyVisibility(); }
  dispose() { this.collector.reset(); this.route = null; this.current = null; if (this.stopTicker) { this.stopTicker(); this.stopTicker = null; } }
}

let runtime: VisitRuntime | null = null;
// Codex #342: 부팅 = 식별 미정(pending)으로 시작. 저장된 세션의 프로필이 스플래시 뒤에 오면, 그 전에 익명으로 첫 방문을 보내고
// setAnalyticsUser가 정지→재개하며 같은 화면을 한 번 더 보냈다. 손님 부팅은 initSessionFromStorage가, 회원은 setAnalyticsUser가 재개한다
let identitySuspended = true;
export function installVisitRuntime(next: VisitRuntime): () => void {
  runtime?.dispose(); runtime = next;
  if (identitySuspended) next.suspendIdentity();
  return () => { next.dispose(); if (runtime === next) runtime = null; };
}
/** Called synchronously before token generation/SDK identity changes; no SDK dependency or cycle. */
export function suspendEngagementIdentity() { identitySuspended = true; runtime?.suspendIdentity(); }
export function resumeEngagementIdentity() { identitySuspended = false; runtime?.resumeIdentity(); }
