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

/** P-115: 기본 타임아웃 — 응답 유실(fetch 침묵) 시에도 reject 보장, 무한 스켈레톤
 *  구조 봉쇄. 장시간 정당 요청만 per-call 오버라이드(예: /scans ML 60s). */
const DEFAULT_TIMEOUT_MS = 15_000;

export interface RequestOpts {
  timeoutMs?: number;
  /** P-153: 엔드포인트 한정 추가 헤더(예: X-API-Version) — 기본 헤더에 병합. */
  headers?: Record<string, string>;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': apiLang(),
    ...extraHeaders, // P-153: 엔드포인트 한정(예: X-API-Version)
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
  let text: string;
  if (__DEV__) {
    // 요청 측 로그 — fetch 전에 찍어 NETWORK 실패 시에도 보이게. 토큰은 마스킹.
    // eslint-disable-next-line no-console
    console.log(
      `[api] → ${method} ${API_V1_BASE}${path}`,
      { headers: { ...headers, ...(headers.Authorization ? { Authorization: 'Bearer ***' } : {}) } },
      body != null ? body : '(no body)',
    );
  }
  // P-115: AbortSignal.timeout은 RN Hermes 미보장 — AbortController+setTimeout
  // (finally에서 타이머 정리, 누수 없음). 타이머 창은 fetch+본문 읽기까지 —
  // 헤더만 오고 본문이 침묵하는 유실도 봉쇄.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    try {
      res = await fetch(`${API_V1_BASE}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      // 타임아웃/무연결/DNS/TLS — 전부 NETWORK 프리픽스(classifyQueryError → offline,
      // 재시도 유도 문구). react-query retry가 reject를 받아야 발동한다.
      throw new ApiError(
        controller.signal.aborted
          ? `NETWORK: timeout after ${timeoutMs}ms`
          : `NETWORK: ${(e as Error)?.message ?? e}`,
      );
    }

    // 401 → refresh(rotation, mutex는 핸들러 몫) 후 원요청 1회 재시도 (KB-67).
    // /auth/* 자체의 401은 재시도 대상이 아니다(로그인/refresh 실패는 그대로 표면화).
    if (res.status === 401 && !isRetry && onUnauthorized && !path.startsWith('/auth/')) {
      const refreshed = await onUnauthorized().catch(() => false);
      if (refreshed) return request<T>(method, path, body, true, timeoutMs, extraHeaders);
    }

    try {
      text = await res.text();
    } catch (e) {
      throw new ApiError(
        controller.signal.aborted ? `NETWORK: timeout after ${timeoutMs}ms` : `NETWORK: ${(e as Error)?.message ?? e}`,
      );
    }
  } finally {
    clearTimeout(timer);
  }

  // DevTools Network 탭이 dev-launcher 멀티 호스트 이슈(discussions/954)로 비활성 —
  // dev에선 콘솔이 네트워크 인스펙터 대용. 프로덕션 번들에선 데드코드로 제거된다.
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[api] ← ${res.status} ${method} ${API_V1_BASE}${path}`, text.length > 4000 ? `${text.slice(0, 4000)}… (${text.length}B)` : text);
  }

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
  get: <T>(path: string, opts?: RequestOpts) => request<T>('GET', path, undefined, false, opts?.timeoutMs, opts?.headers),
  post: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('POST', path, body, false, opts?.timeoutMs, opts?.headers),
  patch: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('PATCH', path, body, false, opts?.timeoutMs, opts?.headers),
  put: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>('PUT', path, body, false, opts?.timeoutMs, opts?.headers),
  del: <T>(path: string, opts?: RequestOpts) => request<T>('DELETE', path, undefined, false, opts?.timeoutMs, opts?.headers),
};
