/**
 * Data-source seam toggle (handoff §5).
 * MOCK_MODE=true  → hooks return mock JSON typed against the contract.
 * MOCK_MODE=false → hooks hit the real API client (wired next week).
 *
 * Screens NEVER read this directly — they only call useXxx() hooks.
 * Flip this one line to go live; screen code stays unchanged.
 */
export const MOCK_MODE = true;

/** Placeholder base URL (real value comes from env when MOCK_MODE=false). */
export const API_BASE_URL = 'https://api.kbap.example/v1';

/**
 * Real BE host. Scan + food-detail connect LIVE against this regardless of
 * MOCK_MODE (the two endpoints the redeployed Swagger actually exposes). The
 * contract is provisional; the adapters isolate the churn.
 *
 * Env switch (KB-66): point BE_BASE at a different host per environment.
 * `EXPO_PUBLIC_BE_BASE` (set in eas.json / .env) wins when present; otherwise
 * we fall back to the deployed dev host.
 *
 * 도메인 로드맵 (P-059/KB-175, 2026-07-22 인프라 전환):
 *   dev(Metro/.env)      → https://dev.kbap.site (P-266 복귀 8/25 — dev-eks 503·구 도메인 재활성 실측)
 *   preview·production   → https://prod.kbap.site  (eas.json env 명시, P-067 전환 완료)
 *   meogo.handev.site    → 폐기 (P-067, 2026-07-25)
 */
export const BE_BASE = process.env.EXPO_PUBLIC_BE_BASE ?? 'https://prod.kbap.site';

/** Versioned REST base — every real endpoint hangs off this (KB-66 common layer). */
export const API_V1_BASE = `${BE_BASE}/api/v1`;
