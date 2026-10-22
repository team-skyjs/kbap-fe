/** KB-873 schema2: only bounded, explicitly registered context reaches the adapter. */
export const ENGAGEMENT_EVENTS = {
  screen_visit_start: 'screen_visit_start',
  screen_visible_time: 'screen_visible_time',
  screen_surface_impression: 'screen_surface_impression',
  screen_surface_visible_time: 'screen_surface_visible_time',
  screen_scroll_depth: 'screen_scroll_depth',
  screen_scroll_summary: 'screen_scroll_summary',
} as const;
export type EngagementEvent = keyof typeof ENGAGEMENT_EVENTS;
export const SCREENS = ['root', '(tabs)/index', '(tabs)/food', '(tabs)/community', '(tabs)/profile', 'scan', 'scan-order', 'search', 'idol-picks', 'curations/[key]', 'food/[id]', 'food/[id]/reviews', 'food/[id]/review', 'food/[id]/owner', 'profile/saved', 'profile/my-foods', 'profile/order/[id]', 'profile/reviews', 'profile/edit', 'profile/restrictions', 'profile/diet', 'profile/notifications', 'profile/feedback', 'profile/feedback/new', 'profile/feedback/[id]', 'profile/ranking', 'profile/legal', 'notifications', 'login', 'onboarding', 'delete-account', 'processed-foods/[id]', 'processed-foods/[id]/review', 'community/blocked', 'community/post/[id]', 'community/compose', 'unknown'] as const;
export type Screen = typeof SCREENS[number];
export const SURFACES = ['screen', 'body', 'rail', 'photos', 'card', 'sheet', 'dialog'] as const;
export type Surface = typeof SURFACES[number];
export const SOURCES = ['navigation', 'content_change', 'unknown'] as const;
export type VisitSource = typeof SOURCES[number];
export interface RuntimeContext {
  app_env: 'development' | 'release' | 'unknown';
  be_env: 'dev' | 'prod' | 'other' | 'unknown';
  channel: string;
  app_version: string;
  app_build: string;
  os: 'ios' | 'android' | 'web' | 'unknown';
  update_id: string;
  runtime_version: string;
}
export type Props = Record<string, string | number | boolean>;
const ENUMS: Record<string, readonly (string | number | boolean)[]> = {
  schema_version: [2], screen: SCREENS, surface: SURFACES, source: SOURCES,
  app_env: ['development', 'release', 'unknown'], be_env: ['dev', 'prod', 'other', 'unknown'],
  channel: ['production', 'preview', 'teamtest', 'teamtest-prod', 'development', 'local', 'unknown'],
  os: ['ios', 'android', 'web', 'unknown'], reason: ['checkpoint', 'visibility_end', 'exit'],
  axis: ['vertical', 'horizontal'], origin: ['initial', 'user', 'programmatic'],
  depth: [25, 50, 75, 90, 100], has_more: [true, false],
};
const NUMBERS: Record<string, number> = {
  delta_ms: 86_400_000, sequence: Number.MAX_SAFE_INTEGER, list_generation: Number.MAX_SAFE_INTEGER,
  max_depth: 100, max_offset: 100_000_000, content_length: 100_000_000, viewport: 100_000_000,
  loaded_pages: 1_000_000, max_position: 10_000_000, user_scrolls: 1_000_000, direction_changes: 1_000_000,
};
const COMMON = ['schema_version', 'screen', 'source', 'screen_visit_id', 'app_env', 'be_env', 'channel', 'app_version', 'app_build', 'os', 'update_id', 'runtime_version'];
const AREA = ['surface', 'area_id', 'list_generation'];
export const ENGAGEMENT_ALLOWED: Record<EngagementEvent, readonly string[]> = {
  screen_visit_start: COMMON,
  screen_visible_time: [...COMMON, 'delta_ms', 'sequence', 'reason'],
  screen_surface_impression: [...COMMON, ...AREA],
  screen_surface_visible_time: [...COMMON, ...AREA, 'delta_ms', 'sequence', 'reason'],
  screen_scroll_depth: [...COMMON, ...AREA, 'axis', 'origin', 'depth'],
  screen_scroll_summary: [...COMMON, ...AREA, 'axis', 'max_depth', 'max_offset', 'content_length', 'viewport', 'loaded_pages', 'max_position', 'has_more', 'user_scrolls', 'direction_changes'],
};
/** An area ID encodes its surface; screen itself is represented by the visit, never an area. */
export function isValidAreaPair(id: unknown, surface: unknown): boolean {
  return typeof id === 'string' && typeof surface === 'string' && surface !== 'screen'
    && SURFACES.includes(surface as Surface) && new RegExp(`^${surface}_[0-9]+$`).test(id) && id.length <= 80;
}
/** IDs are client-local counters, never route params, server analysis IDs or user content. */
export function sanitizeEngagement(event: EngagementEvent, props?: Record<string, unknown>): Props {
  if (ENGAGEMENT_ALLOWED[event].includes('area_id') && !isValidAreaPair(props?.area_id, props?.surface)) return {};
  const result: Props = {};
  for (const key of ENGAGEMENT_ALLOWED[event]) {
    const value = props?.[key];
    if (ENUMS[key]) { if (ENUMS[key].includes(value as never)) result[key] = value as string | number | boolean; }
    else if (key in NUMBERS) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= NUMBERS[key]) result[key] = value;
    } else if (typeof value === 'string') {
      const ok = key === 'screen_visit_id' ? /^v[0-9]+_[0-9]+$/.test(value)
        : key === 'area_id' ? /^(body|rail|photos|card|sheet|dialog)_[0-9]+$/.test(value)
        : key === 'update_id' ? value === 'unknown' || /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
        : key === 'runtime_version' ? value === 'unknown' || /^[0-9a-f]{40,64}$/i.test(value)
        : value === 'unknown' || /^[0-9]+([.][0-9]+){0,3}$/.test(value);
      if (ok && value.length <= 80) result[key] = value;
    }
  }
  return result;
}
