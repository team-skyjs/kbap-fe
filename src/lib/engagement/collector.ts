import { type EngagementEvent, type Props, type RuntimeContext, type Screen, type Surface, type VisitSource, sanitizeEngagement } from './schema';

const BOOT = Date.now(); // opaque process-local ID prefix; durations use the injected monotonic clock only
let serial = 0;
const DEPTHS = [25, 50, 75, 90, 100] as const;
export const CHECKPOINT_MS = 15_000;
export const IMPRESSION_MS = 1_000;
export interface ScrollSample {
  offset: number; viewport: number; contentLength: number;
  origin: 'initial' | 'user' | 'programmatic';
  loadedPages: number; maxPosition: number; hasMore: boolean;
}
interface Area {
  surface: Surface; generation: number; visible: boolean; continuous: number; impressed: boolean;
  delta: number; sequence: number; pendingScrolls: number;
  scroll?: { axis: 'vertical' | 'horizontal'; depths: Set<number>; maxDepth: number; maxOffset: number;
    contentLength: number; viewport: number; loadedPages: number; maxPosition: number; hasMore: boolean;
    userScrolls: number; directionChanges: number; direction: number; lastOffset: number; dirty: boolean };
}
/** Pure aggregation: no intervals, SDK, router, network, user identifiers, or per-frame sends.
 * Runtime wiring must call tick from ONE shared scheduler and pass actual visibility.
 */
export class EngagementCollector {
  private visit: { id: string; screen: Screen; source: VisitSource } | null = null;
  private areas = new Map<string, Area>();
  private foreground = false;
  private focused = false;
  private uncovered = false;
  private last: number;
  private checkpointAt: number;
  private delta = 0;
  private sequence = 0;
  constructor(private readonly now: () => number, private readonly send: (event: EngagementEvent, props: Props) => void, private readonly runtime: RuntimeContext) {
    this.last = this.readClock();
    this.checkpointAt = this.last;
  }
  private readClock(): number { const n = this.now(); return Number.isFinite(n) ? Math.max(this.last ?? 0, n) : this.last ?? 0; }
  private get visible() { return !!this.visit && this.foreground && this.focused && this.uncovered; }
  private emit(event: EngagementEvent, props: Props = {}) {
    if (!this.visit) return;
    try { this.send(event, sanitizeEngagement(event, { ...this.runtime, ...props, schema_version: 2, screen: this.visit.screen, source: this.visit.source, screen_visit_id: this.visit.id })); }
    catch { /* analytics must not interrupt UI or the remaining collectors */ }
  }
  private areaProps(id: string, a: Area): Props { return { area_id: id, surface: a.surface, list_generation: a.generation }; }
  private advance() {
    const n = this.readClock(); const elapsed = n - this.last; this.last = n;
    if (!this.visible) return;
    this.delta += elapsed;
    for (const [id, a] of this.areas) {
      if (!a.visible) continue;
      a.delta += elapsed; a.continuous += elapsed;
      if (!a.impressed && a.continuous >= IMPRESSION_MS) {
        a.impressed = true; this.emit('screen_surface_impression', this.areaProps(id, a));
      }
    }
  }
  /** Each focus/content replacement is a new visit. Caller never passes a raw URL/query. */
  begin(screen: Screen, source: VisitSource) {
    this.end(); this.visit = { id: `v${BOOT}_${++serial}`, screen, source };
    this.sequence = 0; this.delta = 0; this.last = this.readClock(); this.checkpointAt = this.last;
    this.emit('screen_visit_start');
  }
  setVisibility(value: { foreground: boolean; focused: boolean; uncovered: boolean }) {
    this.advance(); const wasVisible = this.visible;
    this.foreground = value.foreground; this.focused = value.focused; this.uncovered = value.uncovered;
    if (wasVisible && !this.visible) {
      this.flush('visibility_end');
      for (const a of this.areas.values()) a.continuous = 0;
    }
    if (wasVisible !== this.visible) this.checkpointAt = this.last;
  }
  /** Rect inputs are areas, not lengths. Large surfaces use the smaller effective viewport. */
  observe(id: string, surface: Surface, generation: number, geometry: { intersection: number; target: number; viewport: number }) {
    this.advance();
    if (!/^(body|rail|photos|card|sheet|dialog)_[0-9]+$/.test(id) || !Number.isSafeInteger(generation) || generation < 0) return;
    let a = this.areas.get(id);
    if (a && (a.generation !== generation || a.surface !== surface)) { this.remove(id); a = undefined; }
    if (!a) { a = { surface, generation, visible: false, continuous: 0, impressed: false, delta: 0, sequence: 0, pendingScrolls: 0 }; this.areas.set(id, a); }
    const { intersection, target, viewport } = geometry;
    const denom = Math.min(target, viewport);
    const valid = [intersection, target, viewport].every(Number.isFinite) && intersection >= 0 && target > 0 && viewport > 0;
    const visible = valid && Math.min(intersection, denom) / denom >= 0.5;
    if (a.visible && !visible) { this.flushArea(id, a, 'visibility_end'); a.continuous = 0; }
    a.visible = visible;
  }
  /** Scroll gestures are counted explicitly at begin-drag, never per callback. */
  userScroll(id: string) {
    const a = this.areas.get(id);
    if (!a?.visible || !this.visible) return;
    if (a.scroll) { a.scroll.userScrolls++; a.scroll.dirty = true; }
    else a.pendingScrolls++;
  }
  scroll(id: string, axis: 'vertical' | 'horizontal', sample: ScrollSample) {
    this.advance(); const a = this.areas.get(id);
    if (!a || !a.visible || !this.visible) return;
    const { viewport, contentLength } = sample;
    if (![sample.offset, viewport, contentLength, sample.loadedPages, sample.maxPosition].every(Number.isFinite) || viewport <= 0 || contentLength <= 0 || sample.loadedPages < 0 || sample.maxPosition < 0) return;
    const offset = Math.max(0, Math.min(sample.offset, Math.max(0, contentLength - viewport)));
    const depth = Math.min(100, (offset + viewport) / contentLength * 100);
    let s = a.scroll;
    if (!s) {
      s = { axis, depths: new Set(), maxDepth: 0, maxOffset: 0, contentLength, viewport, loadedPages: 0, maxPosition: 0, hasMore: false, userScrolls: a.pendingScrolls, directionChanges: 0, direction: 0, lastOffset: offset, dirty: false };
      a.scroll = s;
    }
    if (s.axis !== axis) return; // axes require distinct area IDs
    if (sample.origin === 'user') {
      const dir = Math.sign(offset - s.lastOffset);
      if (dir && s.direction && dir !== s.direction) s.directionChanges++;
      if (dir) s.direction = dir;
    }
    s.lastOffset = offset; s.maxOffset = Math.max(s.maxOffset, offset); s.maxDepth = Math.max(s.maxDepth, depth);
    s.contentLength = contentLength; s.viewport = viewport; s.loadedPages = Math.max(s.loadedPages, sample.loadedPages);
    s.maxPosition = Math.max(s.maxPosition, sample.maxPosition); s.hasMore = sample.hasMore; s.dirty = true;
    // Short pages have no scroll milestones. End tolerance is 2 layout units.
    if (contentLength <= viewport) return;
    for (const d of DEPTHS) {
      const reached = d === 100 ? contentLength - viewport - offset <= 2 : depth >= d;
      if (reached && !s.depths.has(d)) { s.depths.add(d); this.emit('screen_scroll_depth', { ...this.areaProps(id, a), axis, origin: sample.origin, depth: d }); }
    }
  }
  tick() {
    this.advance();
    if (this.last - this.checkpointAt >= CHECKPOINT_MS) { this.flush('checkpoint'); this.checkpointAt = this.last; }
  }
  private flushArea(id: string, a: Area, reason: 'checkpoint' | 'visibility_end' | 'exit') {
    if (a.delta > 0) { this.emit('screen_surface_visible_time', { ...this.areaProps(id, a), delta_ms: a.delta, sequence: ++a.sequence, reason }); a.delta = 0; }
    const s = a.scroll;
    if (s?.dirty) {
      this.emit('screen_scroll_summary', { ...this.areaProps(id, a), axis: s.axis, max_depth: s.maxDepth, max_offset: s.maxOffset, content_length: s.contentLength, viewport: s.viewport, loaded_pages: s.loadedPages, max_position: s.maxPosition, has_more: s.hasMore, user_scrolls: s.userScrolls, direction_changes: s.directionChanges });
      s.dirty = false;
    }
  }
  private flush(reason: 'checkpoint' | 'visibility_end' | 'exit') {
    if (this.delta > 0) { this.emit('screen_visible_time', { delta_ms: this.delta, sequence: ++this.sequence, reason }); this.delta = 0; }
    for (const [id, a] of this.areas) this.flushArea(id, a, reason);
  }
  remove(id: string) { this.advance(); const a = this.areas.get(id); if (a) this.flushArea(id, a, 'exit'); this.areas.delete(id); }
  end() { this.advance(); this.flush('exit'); this.visit = null; this.areas.clear(); this.delta = 0; }
  /** Account boundary drops unsent intervals, preventing attribution to the next identity. */
  reset() { this.visit = null; this.areas.clear(); this.delta = 0; this.sequence = 0; this.last = this.readClock(); this.checkpointAt = this.last; }
}
