/** KB699 lost-fireworks regressions, moved to KB760's global transition owner.
 * Motion lookup races are covered by unlockCelebrationUi760; the badge no longer owns celebration. */
import { consumeUnlock, getUnlockSnapshot, markUnlockPresented, observeUnlock, resetUnlockSession, subscribeUnlock } from '../unlockCelebrationStore';
beforeEach(() => resetUnlockSession(0));
const pending = () => getUnlockSnapshot().event;
it('① profile loading gap does not erase the observed locked baseline', () => {
  observeUnlock('m1', false, 0); observeUnlock('m1', undefined, 0); observeUnlock('m1', true, 0);
  expect(pending()?.memberId).toBe('m1');
});
it('② pending survives a home subscriber unmount/remount until presentation', () => {
  const listener = jest.fn(); const off = subscribeUnlock(listener);
  observeUnlock('m1', false, 0); observeUnlock('m1', true, 0); const event = pending(); off();
  const offAgain = subscribeUnlock(listener); expect(pending()).toBe(event); expect(getUnlockSnapshot().presented).toBe(false); offAgain();
});
it('③ consumption during an empty profile render still consumes the correct owner', () => {
  observeUnlock('m1', false, 0); observeUnlock('m1', true, 0); const event = pending()!;
  observeUnlock('m1', undefined, 0); expect(consumeUnlock(event.id)).toEqual(event);
  observeUnlock('m1', true, 0); expect(pending()).toBeNull();
});
it('④ logout cancels a pending event and unlocked login is only a baseline', () => {
  observeUnlock('m1', false, 0); observeUnlock('m1', true, 0); expect(pending()).not.toBeNull();
  resetUnlockSession(1); expect(pending()).toBeNull(); observeUnlock('m1', true, 1); expect(pending()).toBeNull();
});
it('⑤ account switch cancels m1; returning unlocked does not resurrect its event', () => {
  observeUnlock('m1', false, 0); observeUnlock('m1', true, 0); observeUnlock('m2', true, 0);
  expect(pending()).toBeNull(); observeUnlock('m1', true, 0); expect(pending()).toBeNull();
});
it('⑥ motion preference lookup is not an entitlement or consumption signal', () => {
  observeUnlock('m1', false, 0); observeUnlock('m1', true, 0); const event = pending()!;
  markUnlockPresented(event.id); expect(pending()).toEqual(event);
  expect(getUnlockSnapshot().presented).toBe(true); // C remains readable until explicit dismissal
});
it('⑦ relock cancels pending and starts a new transition only after later server true', () => {
  observeUnlock('m1', false, 0); observeUnlock('m1', true, 0); const id = pending()!.id;
  observeUnlock('m1', false, 0); expect(pending()).toBeNull();
  observeUnlock('m1', true, 0); expect(pending()!.id).not.toBe(id);
});
it('⑧ duplicate presentation/refetch cannot consume or recreate a transition', () => {
  observeUnlock('m1', false, 0); observeUnlock('m1', true, 0); const event = pending()!;
  markUnlockPresented(event.id); markUnlockPresented(event.id); observeUnlock('m1', true, 0);
  expect(pending()).toEqual(event); consumeUnlock(event.id); observeUnlock('m1', true, 0); expect(pending()).toBeNull();
});
it('⑨ leaving while locked then returning already unlocked is not an observed transition', () => {
  observeUnlock('m1', false, 0); observeUnlock('m2', true, 0); observeUnlock('m1', true, 0);
  expect(pending()).toBeNull();
});
it('⑩ logout while locked discards its baseline and stale responses', () => {
  observeUnlock('m1', false, 0); resetUnlockSession(1); observeUnlock('m1', true, 0);
  expect(pending()).toBeNull(); observeUnlock('m1', true, 1); expect(pending()).toBeNull();
});
