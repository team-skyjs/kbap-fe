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
