/** Editorial IDs only; localized content and personal risk always come from the API.
 * Evidence: spec/bridge/ops/2026-10-16-home-selected-food-readiness.md. */
export const HOME_SELECTION = {
  selectionVersion: '2026-10-16.1',
  environment: 'prod',
  evidenceRef: 'spec/bridge/ops/2026-10-16-home-selected-food-readiness.md',
  orderedFoodIds: [743, 444, 432, 325, 300, 629, 435, 248, 414, 445],
} as const;
let revision = 0;
const listeners = new Set<() => void>();
export const selectedContextRevision = () => revision;
export function subscribeSelectedContext(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function advanceSelectedContext() {
  revision++;
  listeners.forEach((listener) => listener());
}
