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
 * Auth (KB-67, 2026-07-13 하이브리드): Firebase는 소셜 로그인까지만 —
 * POST /auth/login으로 BE access/refresh 토큰을 교환하고, 모든 요청의
 * Authorization은 BE accessToken이다 (auth/beAuth.ts installBeAuth()가
 * 프로바이더+401 핸들러를 주입). 401 → refresh rotation 후 1회 재시도.
 * No provider (web/tests/signed-out) ⇒ no Authorization header.
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

/* ---- BE 토큰 배선 (KB-67) — auth/beAuth.ts installBeAuth()가 주입 ---- */
let authTokenProvider: (() => Promise<string | null>) | null = null;
export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null) {
  authTokenProvider = provider;
}

/** 401 핸들러 — true 반환(=refresh 성공) 시 원요청을 1회 재시도한다. */
let onUnauthorized: (() => Promise<boolean>) | null = null;
export function setOnUnauthorized(handler: (() => Promise<boolean>) | null) {
  onUnauthorized = handler;
}

/** 익명으로 호출해야 하는 공개 인증 엔드포인트 (Authorization 미부착). */
const OPEN_AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

/** Languages the BE accepts for `lang` / Accept-Language. Others → 400, so clamp. */
const ALLOWED_LANGS = new Set(['ko', 'zh-Hans', 'en', 'ja', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es']);

/** Active reader language, clamped to what the BE supports (fallback en). */
export function apiLang(): string {
  const l = i18n.language;
  return ALLOWED_LANGS.has(l) ? l : 'en';
}

async function request<T>(method: string, path: string, body?: unknown, isRetry = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': apiLang(),
  };
  // BE access token (silently skipped when signed out / provider absent —
  // a token fetch failure must not turn every API call into an auth error).
  // 공개 인증 엔드포인트(login/refresh/logout)에는 붙이지 않는다 — 만료된
  // access가 붙으면 서버가 요청 자체를 401시켜 refresh가 영원히 실패한다
  // (BE JWT 가이드: 만료·무효 토큰 부착 시 공개 API도 401).
  const skipAuth = OPEN_AUTH_PATHS.some((p) => path.startsWith(p));
  const accessToken =
    !skipAuth && authTokenProvider ? await authTokenProvider().catch(() => null) : null;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

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

  // 401 → refresh(rotation, mutex는 핸들러 몫) 후 원요청 1회 재시도 (KB-67).
  // /auth/* 자체의 401은 재시도 대상이 아니다(로그인/refresh 실패는 그대로 표면화).
  if (res.status === 401 && !isRetry && onUnauthorized && !path.startsWith('/auth/')) {
    const refreshed = await onUnauthorized().catch(() => false);
    if (refreshed) return request<T>(method, path, body, true);
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
  // 200 but success:false — never trust HTTP status alone.
  if (!json || !json.success) {
    throw new ApiError(json?.message ?? `Malformed response (HTTP ${res.status})`, res.status);
  }
  // Unit 응답(BaseResponseUnit)은 payload 필드 자체가 없다 — success면 통과.
  return json.payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
