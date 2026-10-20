import { blockUnlockPresentation, consumeUnlock, getUnlockSnapshot, hasUnlockPending, hasObservedUnlockTransition, isUnlockEventCurrent, markUnlockPresented, observeAdUnlock, observeUnlock, resetUnlockSession, setUnlockScanFocused } from '../unlockCelebrationStore';
import { adaptAdReward } from '@/lib/api/adRewardAdapter';
import { currentGen, saveTokens } from '@/lib/auth/beTokens';
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(async () => {}), getItemAsync: jest.fn(async () => null), deleteItemAsync: jest.fn(async () => {}) }));
beforeEach(() => resetUnlockSession(0));
it('only a same-member false→true creates one event, with scan context captured at transition', () => {
  observeUnlock('a', true, 0); expect(hasUnlockPending()).toBe(false);
  observeUnlock('a', false, 0); setUnlockScanFocused(true); observeAdUnlock(true, 0);
  const event = getUnlockSnapshot().event!; expect(event.context).toBe('scan');
  markUnlockPresented(event.id); observeUnlock('a', true, 0);
  expect(getUnlockSnapshot()).toMatchObject({ event, presented: true });
  expect(consumeUnlock(event.id)).toEqual(event); expect(consumeUnlock(event.id)).toBeNull();
  expect(hasObservedUnlockTransition()).toBe(true); // late reward callback must still defer to the consumed CTA
  observeUnlock('a', true, 0); expect(hasUnlockPending()).toBe(false);
});
it('review context, unknown loading, reward response loss and later server confirmation', () => {
  observeUnlock('a', false, 0); observeUnlock('a', null, 0);
  expect(hasUnlockPending()).toBe(false);
  observeUnlock('a', true, 0); expect(getUnlockSnapshot().event?.context).toBe('done');
});
it('logout generation, late responses, and first unlocked observation on restart never celebrate', () => {
  observeUnlock('a', false, 0); observeUnlock('a', true, 0);
  const event = getUnlockSnapshot().event!;
  resetUnlockSession(1); observeUnlock('a', true, 0); observeAdUnlock(true, 0);
  expect(hasUnlockPending()).toBe(false); expect(isUnlockEventCurrent(event)).toBe(false);
  observeUnlock('b', true, 1); expect(hasUnlockPending()).toBe(false);
  resetUnlockSession(1); observeUnlock('b', true, 1); expect(hasUnlockPending()).toBe(false);
});
it('account switch without an intervening guest render drops pending, relock permits a new transition', () => {
  observeUnlock('a', false, 0); observeUnlock('a', true, 0); const first = getUnlockSnapshot().event!;
  observeUnlock('b', true, 0); expect(hasUnlockPending()).toBe(false); expect(isUnlockEventCurrent(first)).toBe(false);
  observeUnlock('b', false, 0); observeUnlock('b', true, 0); const second = getUnlockSnapshot().event!;
  expect(second.id).not.toBe(first.id);
  observeUnlock('b', false, 0); expect(hasUnlockPending()).toBe(false); expect(isUnlockEventCurrent(second)).toBe(false);
});
it('modal blockers survive session reset and release independently', () => {
  const a = blockUnlockPresentation(), b = blockUnlockPresentation();
  resetUnlockSession(1); a(); expect(getUnlockSnapshot().blocked).toBe(true);
  b(); expect(getUnlockSnapshot().blocked).toBe(false);
});
it('failed review, local reward count or unknown entitlement never produce an event', () => {
  observeAdUnlock(true, 0); expect(hasUnlockPending()).toBe(false);
  observeUnlock('a', false, 0); observeAdUnlock(false, 0); observeUnlock('a', undefined, 0);
  expect(hasUnlockPending()).toBe(false);
});
it.each([null, undefined, {}, { rewardCount: 3, remainingForUnlock: 0 }, { rewardCount: -1, remainingForUnlock: 0, scanUnlocked: true }])('invalid reward payload is not success: %j', (input) => {
  expect(() => adaptAdReward(input)).toThrow('Invalid reward response');
});
it('valid response uses server boolean, not a local threshold', () => {
  expect(adaptAdReward({ rewardCount: 3, remainingForUnlock: 0, scanUnlocked: false }).scanUnlocked).toBe(false);
});
it('Codex #291 P1: a fresh login (saveTokens newSession) moves the store to the new generation', async () => {
  await saveTokens('A', 'R', { newSession: true });
  const gen = currentGen();
  expect(gen).toBeGreaterThan(0);
  observeUnlock('a', false, gen); observeUnlock('a', true, gen);
  expect(hasUnlockPending()).toBe(true);
});
