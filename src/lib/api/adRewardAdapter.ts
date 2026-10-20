export type AdRewardResponse = { rewardCount: number; remainingForUnlock: number; scanUnlocked: boolean };
export function adaptAdReward(value: unknown): AdRewardResponse {
  if (!value || typeof value !== 'object') throw new Error('Invalid reward response');
  const wire = value as Partial<AdRewardResponse>;
  if (typeof wire.scanUnlocked !== 'boolean' || !Number.isInteger(wire.rewardCount) || !Number.isInteger(wire.remainingForUnlock)
    || (wire.rewardCount ?? -1) < 0 || (wire.remainingForUnlock ?? -1) < 0) throw new Error('Invalid reward response');
  return wire as AdRewardResponse;
}
