/**
 * onboarding/submit.ts — the ONE-SHOT batch submit at the end of setup
 * (KB-110). Steps never call the server individually; everything collected
 * locally lands here once. The BE endpoint is NOT deployed yet — this is the
 * STUB interface to swap to the real call when the Swagger lands (KB-75 syncs
 * server-side onboarding state later).
 *
 * Skipped settings are EXPLICIT: 'UNSET' (미설정), never silently defaulted —
 * the BE must be able to tell "chose nothing" from "never answered".
 */

export const UNSET = 'UNSET' as const;
export type Unset = typeof UNSET;

export interface OnboardingProfilePayload {
  nickname: string;
  nationality: string; // ISO 3166-1 alpha-2
  language: string; // reader language (BCP-47, one of the 9)
  avoidIngredients: string[] | Unset; // 81종 codes, or skipped
  spiceTolerance: number | Unset; // 0..10, or skipped
}

/** STUB — replace with the real POST when the batch endpoint deploys. */
export async function submitOnboardingProfile(payload: OnboardingProfilePayload): Promise<void> {
  console.log('[onboarding] batch submit (stub)', {
    ...payload,
    avoidIngredients:
      payload.avoidIngredients === UNSET ? 'UNSET' : `${payload.avoidIngredients.length} items`,
  });
  // MOCK: resolves immediately. Real call goes through api.post + envelope.
}
