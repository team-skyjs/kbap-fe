/** UI memory only. Server quota remains the entitlement source. */
export type UnlockEvent = Readonly<{ id: number; memberId: string; generation: number; context: 'scan' | 'done' }>;
type Snapshot = Readonly<{ event: UnlockEvent | null; presented: boolean; blocked: boolean }>;
let generation = 0;
let previous: { memberId: string; unlocked: boolean } | null = null;
let serial = 0;
let scanFocused = false;
const blockers = new Set<symbol>();
let snapshot: Snapshot = { event: null, presented: false, blocked: false };
const listeners = new Set<() => void>();
function publish(next: Snapshot) { snapshot = next; listeners.forEach((fn) => fn()); }
export const getUnlockSnapshot = () => snapshot;
export function subscribeUnlock(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function resetUnlockSession(next: number) {
  generation = next;
  previous = null;
  scanFocused = false;
  publish({ event: null, presented: false, blocked: blockers.size > 0 });
}
export function setUnlockScanFocused(value: boolean) {
  scanFocused = value;
  if (!value && snapshot.event?.context === 'scan') consumeUnlock(snapshot.event.id);
}
export function blockUnlockPresentation() {
  const key = Symbol(); blockers.add(key);
  publish({ ...snapshot, blocked: true });
  return () => { blockers.delete(key); publish({ ...snapshot, blocked: blockers.size > 0 }); };
}
export function observeUnlock(memberId: string, unlocked: boolean | null | undefined, requestGeneration: number) {
  if (requestGeneration !== generation || typeof unlocked !== 'boolean') return;
  const prior = previous;
  previous = { memberId, unlocked };
  if (!prior || prior.memberId !== memberId || !unlocked) {
    publish({ ...snapshot, event: null, presented: false });
    return;
  }
  if (!prior.unlocked && unlocked) {
    publish({ ...snapshot, event: { id: ++serial, memberId, generation, context: scanFocused ? 'scan' : 'done' }, presented: false });
  }
}
export function markUnlockPresented(id: number) {
  if (snapshot.event?.id === id && !snapshot.presented) publish({ ...snapshot, presented: true });
}
export function consumeUnlock(id: number): UnlockEvent | null {
  const event = snapshot.event;
  if (!event || event.id !== id || event.generation !== generation) return null;
  publish({ ...snapshot, event: null, presented: false });
  return event;
}
export function isUnlockEventCurrent(event: UnlockEvent) {
  return generation === event.generation && previous?.memberId === event.memberId && previous.unlocked;
}
export function hasUnlockPending() { return snapshot.event !== null; }

/** Reward response has the same server entitlement; it may precede a failed profile refetch. */
export function observeAdUnlock(unlocked: boolean, requestGeneration: number) {
  if (previous) observeUnlock(previous.memberId, unlocked, requestGeneration);
}
