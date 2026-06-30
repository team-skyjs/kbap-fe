/**
 * risk.ts — personalized-risk display guard (Constitution III · SC-003 · spec FR-003).
 *
 * SAFETY INVARIANT: a user with NO dietary restrictions has no basis for a
 * personalized "safe" verdict, so we must NEVER show one (false-safe forbidden).
 * Empty-profile users see caution/unable only, and are nudged to fill their
 * profile to enable personalization.
 *
 * This is the single chokepoint every risk render goes through — keeping the
 * guard in one pure function prevents a missed `if` anywhere from leaking a
 * false-safe.
 */
import type { RiskState } from '@/lib/theme';

/**
 * @param raw              risk as returned by the API (personalized server-side)
 * @param hasRestrictions  whether the user has any dietary restrictions
 */
export function personalRisk(raw: RiskState, hasRestrictions: boolean): RiskState {
  // No profile → a "safe" claim would be a false-safe. Downgrade to caution.
  if (!hasRestrictions && raw === 'safe') return 'caution';
  return raw;
}
