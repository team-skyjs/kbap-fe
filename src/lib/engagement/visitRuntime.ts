import { EngagementCollector } from './collector';
import { type EngagementEvent, type Props, type RuntimeContext, type Screen } from './schema';

export interface VisitRoute { screen: Screen; identity: string }
/** Route identity is memory-only. Visible-time emission stays disabled until occlusion coverage is wired. */
export class VisitRuntime {
  private collector: EngagementCollector;
  private route: VisitRoute | null = null;
  private current: VisitRoute | null = null;
  private foreground = false;
  private suspended = false;
  constructor(now: () => number, send: (event: EngagementEvent, props: Props) => void, context: RuntimeContext) {
    this.collector = new EngagementCollector(now, send, context);
  }
  setForeground(active: boolean) { this.foreground = active; this.sync(); }
  focus(route: VisitRoute | null) { this.route = route; this.sync(); }
  private sync() {
    if (this.suspended) return;
    if (!this.route) { this.collector.end(); this.current = null; return; }
    if (!this.foreground) return;
    if (this.current?.screen === this.route.screen && this.current.identity === this.route.identity) return;
    const source = this.current?.screen === this.route.screen ? 'content_change' : 'navigation';
    this.current = this.route;
    this.collector.begin(this.route.screen, source);
    // Deliberately no setVisibility(true) or scheduler here: uninstrumented native overlays still exist.
  }
  suspendIdentity() { this.suspended = true; this.collector.reset(); this.current = null; }
  resumeIdentity() { this.suspended = false; this.sync(); }
  dispose() { this.collector.reset(); this.route = null; this.current = null; }
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
