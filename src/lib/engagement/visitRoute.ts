import { SCREENS, type Screen } from './schema';
import { type VisitRoute } from './visitRuntime';

export interface RouteState {
  index?: number;
  routes: readonly { name: string; key?: string; params?: object; state?: RouteState }[];
}
/** Consume the active leaf, not the root layout's focus. Params/keys never enter the payload. */
export function activeVisitRoute(state: RouteState | undefined): VisitRoute | null {
  if (!state?.routes.length) return null;
  const names: string[] = [];
  const keys: string[] = [];
  let params: Readonly<Record<string, unknown>> = {};
  let cursor: RouteState | undefined = state;
  while (cursor) {
    const route: RouteState['routes'][number] | undefined = cursor.routes[cursor.index ?? 0];
    if (!route) return null;
    names.push(route.name); keys.push(route.key ?? route.name); params = (route.params ?? {}) as Readonly<Record<string, unknown>>;
    if (route.name === '(tabs)' && !route.state) return null; // navigator not settled
    cursor = route.state;
  }
  const raw = names.join('/');
  const canonical = raw.endsWith('/index') && raw !== '(tabs)/index' ? raw.slice(0, -6) : raw;
  if (canonical === 'root' || !(SCREENS as readonly string[]).includes(canonical)) return null;
  // Restrict content identity to route-owned identifiers. Other query changes are not new visits.
  const field = canonical.includes('[id]') ? 'id' : canonical.includes('[key]') ? 'key' : canonical === 'profile/legal' ? 'doc' : null;
  const content = field && (typeof params[field] === 'string' || typeof params[field] === 'number') ? String(params[field]) : '';
  return { screen: canonical as Screen, identity: JSON.stringify([keys, content]) };
}
