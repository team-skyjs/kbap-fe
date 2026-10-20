import * as React from 'react';
import { AccessibilityInfo, AppState, Modal, Platform } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { UnlockCelebration } from '../UnlockCelebration';
import { blockUnlockPresentation, getUnlockSnapshot, observeUnlock, resetUnlockSession, setUnlockScanFocused } from '../unlockCelebrationStore';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }), initReactI18next: { type: '3rdParty', init: () => {} } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('@/components/FlameShape', () => ({ FlameShape: () => null }));
jest.mock('@/components/CountdownBadge', () => ({ QuotaBurstParticle: () => null, BADGE_W: 64, BADGE_H: 72 }));
let mockGate: { mode: string } = { mode: 'pass' };
jest.mock('@/lib/versionGate', () => ({ useVersionGate: () => mockGate }));
let mockReduced = true;
const mockShared: { value: number }[] = [];
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: { View }, useSharedValue: (value: number) => jest.requireActual('react').useState(() => { const shared = { value, set: (next: number) => { shared.value = next; } }; mockShared.push(shared); return shared; })[0], useAnimatedStyle: () => ({}), useReducedMotion: () => mockReduced, cancelAnimation: jest.fn(), withTiming: jest.fn((v: number) => v) };
});
jest.mock('@/components/Btn', () => ({ Btn: (p: Record<string, unknown>) => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return <Pressable testID={p.testID} onPress={p.onPress}><Text>{p.children}</Text></Pressable>;
} }));
const trees: ReactTestRenderer[] = [];
beforeEach(() => {
  resetUnlockSession(0); jest.useFakeTimers(); jest.clearAllMocks(); mockShared.length = 0; mockGate = { mode: 'pass' };
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  mockReduced = true;
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

it('QA P-489 home: app-start host animates with Reduce Motion OFF even if the async lookup never answers', async () => {
  mockReduced = false;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => new Promise(() => {}));
  const withTiming = jest.requireMock('react-native-reanimated').withTiming as jest.Mock;
  const tree = await mount(); // host mounted long before the unlock
  act(() => jest.advanceTimersByTime(60000));
  act(() => unlock(false)); act(() => modal(tree).props.onShow());
  expect(withTiming).toHaveBeenCalledTimes(2);
  expect(tree.root.findAll((n) => n.props.testID === 'unlock-celebration-burst').length).toBeGreaterThan(0);
});
it('a Reduce Motion change after mount wins over the startup value', async () => {
  mockReduced = false;
  let change!: (value: boolean) => void;
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_name: string, cb: (value: boolean) => void) => { change = cb; return { remove: () => {} }; }) as never);
  const tree = await mount(); act(() => { change(true); unlock(); });
  act(() => modal(tree).props.onShow());
  expect(modal(tree).props.visible).toBe(true);
  expect(jest.requireMock('react-native-reanimated').withTiming).not.toHaveBeenCalled();
  expect(tree.root.findAll((n) => n.props.testID === 'unlock-celebration-burst')).toHaveLength(0);
});
it('motion clock starts at native onShow, not at visible (iOS presents after the ad dismisses)', async () => {
  mockReduced = false;
  const withTiming = jest.requireMock('react-native-reanimated').withTiming as jest.Mock;
  const tree = await mount(); act(() => unlock());
  expect(modal(tree).props.visible).toBe(true);
  act(() => jest.advanceTimersByTime(1000));
  expect(withTiming).not.toHaveBeenCalled();
  expect(mockShared.length).toBeGreaterThanOrEqual(2);
  mockShared.forEach((shared) => expect(shared.value).toBe(0));
  act(() => modal(tree).props.onShow());
  expect(withTiming).toHaveBeenCalledWith(1, { duration: 550 });
  expect(withTiming).toHaveBeenCalledWith(1, { duration: 700 });
  expect(withTiming).toHaveBeenCalledTimes(2);
  act(() => modal(tree).props.onRequestClose());
  act(() => { if (Platform.OS === 'ios') modal(tree).props.onDismiss(); else jest.runOnlyPendingTimers(); });
  withTiming.mockClear(); act(() => unlock());
  expect(modal(tree).props.visible).toBe(true);
  expect(withTiming).not.toHaveBeenCalled();
  act(() => modal(tree).props.onShow());
  expect(withTiming).toHaveBeenCalledTimes(2);
});
it('hard version gate suppresses the native modal without consuming the pending event', async () => {
  mockGate = { mode: 'blocked' };
  const tree = await mount(); act(() => unlock(false));
  expect(modal(tree).props.visible).toBe(false);
  expect(getUnlockSnapshot().event).not.toBeNull();
  mockGate = { mode: 'pass' };
  act(() => tree.update(<UnlockCelebration eligible onStartScanning={jest.fn()} />));
  expect(modal(tree).props.visible).toBe(true);
});
it('Codex #291 R4: burst wrapper has the badge frame and its center is the flame frame center (scale keeps it there)', async () => {
  mockReduced = false;
  const { StyleSheet } = jest.requireActual('react-native');
  const { FLAME_FRAME } = jest.requireActual('../UnlockCelebration');
  const tree = await mount(); act(() => unlock(false));
  const burst = StyleSheet.flatten(tree.root.findAll((n) => n.props.testID === 'unlock-celebration-burst')[0].props.style);
  expect(burst).toMatchObject({ position: 'absolute', width: 64, height: 72 });
  expect(burst.left + burst.width / 2).toBe(FLAME_FRAME.w / 2);
  expect(burst.top + burst.height / 2).toBe(FLAME_FRAME.h / 2);
  expect(burst.transform).toEqual([{ scale: 4 }]); // scale pivots on the wrapper center = flame center
});
it('QA E2: the hidden resting pose is the start pose, so the first shown frame never has the finished sheet', async () => {
  mockReduced = false;
  const withTiming = jest.requireMock('react-native-reanimated').withTiming as jest.Mock;
  const tree = await mount();
  expect(mockShared.length).toBeGreaterThanOrEqual(2);
  mockShared.forEach((shared) => expect(shared.value).toBe(0)); // hidden, before any event
  act(() => unlock(false)); act(() => modal(tree).props.onShow());
  expect(withTiming).toHaveBeenCalledTimes(2);
  mockShared.forEach((shared) => expect(shared.value).toBe(1)); // mock withTiming jumps to the end value
  act(() => modal(tree).props.onRequestClose());
  act(() => { if (Platform.OS === 'ios') modal(tree).props.onDismiss(); else jest.runOnlyPendingTimers(); });
  expect(modal(tree).props.visible).toBe(false);
  mockShared.forEach((shared) => expect(shared.value).toBe(0)); // closing returns to the start pose for the next show
});
it('QA E2: under Reduce Motion the resting pose is the finished sheet (no hidden first frame)', async () => {
  const tree = await mount(); // Reduce Motion ON (beforeEach)
  expect(mockShared.map((shared) => shared.value).sort()).toEqual([0, 1]); // burst 0, entrance 1
  act(() => unlock(false));
  expect(modal(tree).props.visible).toBe(true);
});
it('QA Android: motion starts at visible without waiting for the late onShow; modal covers status and nav bars', async () => {
  const os = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
  try {
    mockReduced = false;
    const withTiming = jest.requireMock('react-native-reanimated').withTiming as jest.Mock;
    const tree = await mount(); act(() => unlock(false));
    expect(withTiming).toHaveBeenCalledTimes(2); // no onShow yet
    expect(modal(tree).props).toMatchObject({ statusBarTranslucent: true, navigationBarTranslucent: true });
    act(() => modal(tree).props.onShow());
    expect(withTiming).toHaveBeenCalledTimes(2); // onShow does not restart it
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  }
});
it('Codex #291 R9: CTA dismissal while inactive defers the scan continuation and runs it once on return', async () => {
  let appChange!: (value: string) => void;
  const realAdd = AppState.addEventListener.bind(AppState);
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((name: string, cb: (value: string) => void) => {
    if (name === 'change') { appChange = cb; return { remove: () => {} }; }
    return realAdd(name as never, cb as never);
  }) as never);
  const setState = (value: string) => Object.defineProperty(AppState, 'currentState', { configurable: true, value });
  const start = jest.fn(); const tree = await mount(start);
  act(() => unlock()); act(() => modal(tree).props.onShow());
  act(() => action(tree).props.onPress());
  act(() => { setState('background'); appChange('background'); });
  act(() => { if (Platform.OS === 'ios') modal(tree).props.onDismiss(); else jest.runOnlyPendingTimers(); });
  expect(start).not.toHaveBeenCalled();
  expect(getUnlockSnapshot().event).toBeNull(); // event stays consumed
  act(() => { setState('active'); appChange('active'); });
  expect(start).toHaveBeenCalledTimes(1);
  act(() => { setState('background'); appChange('background'); });
  act(() => { setState('active'); appChange('active'); });
  expect(start).toHaveBeenCalledTimes(1);
});
