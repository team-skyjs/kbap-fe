/**
 * KB-1019 시연 화면 게이트 — 명시 허용(channel-gate-allowlist): development·demo 채널과
 * 채널 부재 + __DEV__(Metro)만. production·preview·teamtest·teamtest-prod는 도달 불가.
 */
const ALLOWED = new Set(['development', 'demo']);

export function isBbqProbeChannel(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ch = (require('expo-updates') as { channel?: string | null }).channel;
    if (ch == null || ch === '') return __DEV__;
    return ALLOWED.has(ch);
  } catch {
    return __DEV__;
  }
}
