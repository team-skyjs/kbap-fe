/**
 * api/client.ts — the shared REST client (KB-66 common layer).
 *
 * Every real endpoint goes through here so the {success, payload, message}
 * envelope unwrap and error normalization live in ONE place (spec §0):
 *   - success === true  → resolve `payload` (screens never see the wrapper)
 *   - success === false → throw ApiError(message)
 *   - HTTP 4xx/5xx      → ApiError(message from body if wrapped, else "HTTP <n>")
 *   - fetch reject      → ApiError("NETWORK: …")  (distinct from HTTP; scan
 *                          branches on this prefix to show its network error UI)
 *
 * Reader-language localization: the BE returns dish/ingredient/review names
 * already localized to the user's reader language. Every request advertises the
 * active language via `Accept-Language` (BCP-47). `foods/detail` ALSO takes an
 * explicit `lang` query param per the contract — callers add it; `apiLang()`
 * clamps to the BE's allowed set. (place=ko data like nameKo / owner questions
 * stays Korean regardless.)
 *
 * Auth: JWT injection is a SKELETON only — the auth/login contract isn't in the
 * Swagger yet. `setAuthToken()` parks a bearer for when it lands (§0 stub).
 */
import i18n from '../i18n';
import { API_V1_BASE } from '../data/config';

/** Normalized client error — message is user-presentable (BE `message` or HTTP). */
export class ApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** BE generic envelope. Branch on `success` (NOT HTTP status alone) — §0. */
export interface BaseResponse<T> {
  success: boolean;
  payload: T | null;
  message: string | null;
}

/* ---- JWT injection skeleton (§0 — real token contract still TBD) ---- */
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Languages the BE accepts for `lang` / Accept-Language. Others → 400, so clamp. */
const ALLOWED_LANGS = new Set(['ko', 'zh-Hans', 'en', 'ja', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es']);

/** Active reader language, clamped to what the BE supports (fallback en). */
export function apiLang(): string {
  const l = i18n.language;
  return ALLOWED_LANGS.has(l) ? l : 'en';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': apiLang(),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_V1_BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // No connectivity / DNS / TLS — distinctly a NETWORK failure (not an HTTP status).
    throw new ApiError(`NETWORK: ${(e as Error)?.message ?? e}`);
  }

  const text = await res.text();
  // 204 / empty body (e.g. DELETE) — nothing to unwrap.
  if (res.ok && !text) return undefined as T;

  let json: BaseResponse<T> | null = null;
  try {
    json = text ? (JSON.parse(text) as BaseResponse<T>) : null;
  } catch {
    /* non-JSON body — fall through to the guards below */
  }

  // 4xx/5xx: BE wraps errors in the same envelope, so prefer its message (§0).
  if (!res.ok) {
    throw new ApiError(json?.message ?? `HTTP ${res.status}`, res.status);
  }
  // 200 but success:false or missing payload — never trust HTTP status alone.
  if (!json || !json.success || json.payload == null) {
    throw new ApiError(json?.message ?? `Malformed response (HTTP ${res.status})`, res.status);
  }
  return json.payload;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
