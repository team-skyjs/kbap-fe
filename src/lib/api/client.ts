/**
 * api/client.ts — thin REST client placeholder.
 * NOT exercised while MOCK_MODE=true. Wired up next week when the contract
 * stabilizes; auth token injection / refresh will live here.
 *
 * Reader-language localization: dish names (FoodCard.name / FoodDetail.name),
 * ingredient names, review translations etc. are returned by the BE already
 * localized to the user's reader language. The FE just displays what it gets —
 * so every request advertises the active reader language via `Accept-Language`
 * (BCP-47, e.g. "zh-Hans", "ja"). In MOCK_MODE the mock JSON ships English
 * names; once live, the BE localizes the response by this header. (place=ko
 * data like nameKo / owner questions stays Korean regardless.)
 */
import i18n from '../i18n';
import { API_BASE_URL } from '../data/config';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.language || 'en',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
