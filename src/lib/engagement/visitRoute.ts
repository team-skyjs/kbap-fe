import { SCREENS, type Screen } from './schema';
import { type VisitRoute } from './visitRuntime';

/** expo-router build/constants INTERNAL_SLOT_NAME — 공개 export가 아니라 값으로 고정(renderRouter 회귀가 실제 모양을 잠근다) */
const ROOT_SLOT = '__root';

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
    // expo-router 루트 내비게이터의 유일한 라우트 '__root'(INTERNAL_SLOT_NAME) = 래퍼 — 이름·키에 넣지 않고 안으로(QA AV: 이게 붙어 SCREENS와 0건 일치)
    if (route.name === ROOT_SLOT) { cursor = route.state; continue; }
    // 키 없는 라우트 = 아직 정착 안 한 초기(stale) 상태 — 재수화되면 키가 붙어 정체성이 바뀌므로 그 전엔 방문으로 세지 않는다(QA AV: 첫 화면 이중 방문)
    if (!route.key) return null;
    names.push(route.name); keys.push(route.key); params = (route.params ?? {}) as Readonly<Record<string, unknown>>;
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
