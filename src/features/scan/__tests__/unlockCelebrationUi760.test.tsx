import * as React from 'react';
import { AccessibilityInfo, AppState, Modal, Platform } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { UnlockCelebration } from '../UnlockCelebration';
import { blockUnlockPresentation, getUnlockSnapshot, observeUnlock, resetUnlockSession, setUnlockScanFocused } from '../unlockCelebrationStore';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('@/components/FlameShape', () => ({ FlameShape: () => null }));
jest.mock('@/components/CountdownBadge', () => ({ QuotaBurstParticle: () => null }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: { View }, useSharedValue: (value: number) => { const shared = { value, set: (next: number) => { shared.value = next; } }; return shared; }, useAnimatedStyle: () => ({}), cancelAnimation: jest.fn(), withTiming: jest.fn((v: number) => v) };
});
jest.mock('@/components/Btn', () => ({ Btn: (p: Record<string, unknown>) => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return <Pressable testID={p.testID} onPress={p.onPress}><Text>{p.children}</Text></Pressable>;
} }));
const trees: ReactTestRenderer[] = [];
beforeEach(() => {
  resetUnlockSession(0); jest.useFakeTimers(); jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => { act(() => trees.splice(0).forEach((tree) => tree.unmount())); jest.useRealTimers(); jest.restoreAllMocks(); });
async function mount(start = jest.fn(), eligible = true) {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<UnlockCelebration eligible={eligible} onStartScanning={start} />); });
  trees.push(tree); return tree;
}
function unlock(scan = true) { observeUnlock('a', false, 0); setUnlockScanFocused(scan); observeUnlock('a', true, 0); }
const modal = (tree: ReactTestRenderer) => tree.root.findByType(Modal);
const action = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props.testID === 'unlock-celebration-action' && typeof n.props.onPress === 'function')[0];
it('scan CTA requests nothing until native dismissal, double tap calls continuation once', async () => {
  const start = jest.fn(); const tree = await mount(start);
  act(() => unlock()); expect(modal(tree).props.visible).toBe(true); expect(start).not.toHaveBeenCalled();
  act(() => modal(tree).props.onShow());
  const press = action(tree).props.onPress;
  act(() => { press(); press(); }); expect(modal(tree).props.visible).toBe(false);
  expect(start).not.toHaveBeenCalled();
  act(() => { if (Platform.OS === 'ios') modal(tree).props.onDismiss(); else jest.runOnlyPendingTimers(); });
  expect(start).toHaveBeenCalledTimes(1); expect(getUnlockSnapshot().event).toBeNull();
});
it('Reduce Motion remains readable, Done/back never starts scanning, no remount replay', async () => {
  const start = jest.fn(); const tree = await mount(start);
  act(() => unlock(false)); act(() => modal(tree).props.onShow());
  act(() => jest.advanceTimersByTime(10000)); expect(modal(tree).props.visible).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('review.done');
  act(() => modal(tree).props.onRequestClose());
  act(() => { if (Platform.OS === 'ios') modal(tree).props.onDismiss(); else jest.runOnlyPendingTimers(); });
  expect(start).not.toHaveBeenCalled();
  act(() => observeUnlock('a', true, 0)); expect(modal(tree).props.visible).toBe(false);
  const second = await mount(start); expect(modal(second).props.visible).toBe(false);
});
it('account switch while dismissing invalidates the camera continuation', async () => {
  const start = jest.fn(); const tree = await mount(start);
  act(() => unlock()); act(() => action(tree).props.onPress()); act(() => resetUnlockSession(1));
  act(() => { if (Platform.OS === 'ios') modal(tree).props.onDismiss(); else jest.runOnlyPendingTimers(); });
  expect(start).not.toHaveBeenCalled();
});
it('presentation waits for existing modal and eligible route, without consuming pending', async () => {
  const tree = await mount(jest.fn(), false);
  let release!: () => void;
  act(() => { release = blockUnlockPresentation(); unlock(); });
  expect(modal(tree).props.visible).toBe(false);
  act(() => tree.update(<UnlockCelebration eligible />)); expect(modal(tree).props.visible).toBe(false);
  act(() => release()); expect(modal(tree).props.visible).toBe(true);
});

it('unknown/failed Reduce Motion lookup keeps a readable static modal', async () => {
  let reject!: (e: Error) => void;
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  const tree = await mount(); act(() => unlock());
  act(() => jest.advanceTimersByTime(10000)); expect(modal(tree).props.visible).toBe(true);
  await act(async () => reject(new Error('unavailable')));
  expect(modal(tree).props.visible).toBe(true);
  expect(jest.requireMock('react-native-reanimated').withTiming).not.toHaveBeenCalled();
});
it('a newer Reduce Motion change wins over the delayed initial lookup', async () => {
  let resolve!: (value: boolean) => void;
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockImplementation(() => new Promise((ok) => { resolve = ok; }));
  let change!: (value: boolean) => void;
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_name: string, cb: (value: boolean) => void) => { change = cb; return { remove: () => {} }; }) as never);
  const tree = await mount(); act(() => { change(true); unlock(); });
  await act(async () => resolve(false));
  expect(modal(tree).props.visible).toBe(true);
  expect(jest.requireMock('react-native-reanimated').withTiming).not.toHaveBeenCalled();
});
