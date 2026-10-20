import * as React from 'react';
import { AccessibilityInfo, AppState, Modal, Platform, StyleSheet } from 'react-native';
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
  const pass = (c: unknown) => c;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: pass },
    useSharedValue: (value: number) => jest.requireActual('react').useState(() => { const shared = { value, set: (next: number) => { shared.value = next; } }; mockShared.push(shared); return shared; })[0],
    useAnimatedStyle: () => ({}), useAnimatedProps: () => ({}), useReducedMotion: () => mockReduced, cancelAnimation: jest.fn(),
    withTiming: jest.fn((v: number) => v), withSpring: jest.fn((v: number) => v), withDelay: (_d: number, a: unknown) => a,
    withSequence: (...a: unknown[]) => a[a.length - 1], withRepeat: (a: unknown) => a,
    Easing: { linear: (x: number) => x, quad: (x: number) => x, out: (f: unknown) => f },
  };
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
const springs = () => jest.requireMock('react-native-reanimated').withSpring as jest.Mock;
const SEQUENCE_SPRINGS = 4; // KB-819: 불꽃·무한 기호·시트·버튼 — 시퀀스 1회 시작 = 스프링 4회
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
  expect(withTiming).toHaveBeenCalled();
  expect(springs()).toHaveBeenCalledTimes(SEQUENCE_SPRINGS);
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
  expect(springs()).not.toHaveBeenCalled();
  expect(tree.root.findAll((n) => n.props.testID === 'unlock-celebration-burst')).toHaveLength(0);
});
it('motion clock starts at native onShow, not at visible (iOS presents after the ad dismisses)', async () => {
  mockReduced = false;
  const withTiming = jest.requireMock('react-native-reanimated').withTiming as jest.Mock;
  const tree = await mount(); act(() => unlock());
  expect(modal(tree).props.visible).toBe(true);
  act(() => jest.advanceTimersByTime(1000));
  expect(withTiming).not.toHaveBeenCalled();
  expect(springs()).not.toHaveBeenCalled();
  mockShared.forEach((shared) => expect(shared.value).toBe(0));
  act(() => modal(tree).props.onShow());
  expect(springs()).toHaveBeenCalledTimes(SEQUENCE_SPRINGS);
  expect(withTiming).toHaveBeenCalledWith(1, { duration: 450 }); // 글로우
  act(() => modal(tree).props.onRequestClose());
  act(() => { if (Platform.OS === 'ios') modal(tree).props.onDismiss(); else jest.runOnlyPendingTimers(); });
  springs().mockClear(); act(() => unlock());
  expect(modal(tree).props.visible).toBe(true);
  expect(springs()).not.toHaveBeenCalled();
  act(() => modal(tree).props.onShow());
  expect(springs()).toHaveBeenCalledTimes(SEQUENCE_SPRINGS);
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
it('KB-819: 파티클 48개가 불꽃 프레임 중심(0×0 원점)에서 방사 · 충격파 링 2개', async () => {
  mockReduced = false;
  const { StyleSheet } = jest.requireActual('react-native');
  const tree = await mount(); act(() => unlock(false)); act(() => modal(tree).props.onShow());
  const origin = tree.root.findAll((n) => n.props.testID === 'unlock-celebration-burst' && typeof n.type === 'string')[0];
  expect(StyleSheet.flatten(origin.props.style)).toMatchObject({ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 });
  let anchor = origin.parent; while (anchor && anchor.props.testID !== 'unlock-flame-anchor') anchor = anchor.parent;
  expect(anchor).toBeTruthy(); // 불꽃 프레임 상자 안의 중심
  const ids = new Set(tree.root.findAll((n) => typeof n.props.testID === 'string' && /^unlock-particle-\d+$/.test(n.props.testID)).map((n) => n.props.testID));
  expect(ids.size).toBe(48);
  expect(tree.root.findAll((n) => n.props.testID === 'unlock-ring-1').length).toBeGreaterThan(0);
  expect(tree.root.findAll((n) => n.props.testID === 'unlock-ring-2').length).toBeGreaterThan(0);
});
it('KB-819: 시트는 내용만큼(flexGrow·minHeight 없음), 히어로가 남는 높이 · 루프·시퀀스는 언마운트 시 전부 cancel', async () => {
  mockReduced = false;
  const { StyleSheet } = jest.requireActual('react-native');
  const reanimated = jest.requireMock('react-native-reanimated');
  const tree = await mount(); act(() => unlock(false)); act(() => modal(tree).props.onShow());
  const sheet = StyleSheet.flatten(tree.root.findAll((n) => n.props.testID === 'unlock-sheet' && typeof n.type === 'string')[0].props.style);
  expect(sheet.flexGrow).toBeUndefined();
  expect(sheet.minHeight).toBeUndefined();
  reanimated.cancelAnimation.mockClear();
  act(() => { trees.splice(trees.indexOf(tree), 1); tree.unmount(); });
  expect(reanimated.cancelAnimation.mock.calls.length).toBeGreaterThanOrEqual(15); // 시퀀스 15값(루프 flicker·breath 포함)
});
it('QA E2: the hidden resting pose is the start pose, so the first shown frame never has the finished sheet', async () => {
  mockReduced = false;
  const withTiming = jest.requireMock('react-native-reanimated').withTiming as jest.Mock;
  const tree = await mount();
  expect(mockShared.length).toBeGreaterThanOrEqual(2);
  mockShared.forEach((shared) => expect(shared.value).toBe(0)); // hidden, before any event
  act(() => unlock(false)); act(() => modal(tree).props.onShow());
  expect(withTiming).toHaveBeenCalled();
  expect(mockShared.filter((shared) => shared.value === 1).length).toBeGreaterThanOrEqual(10); // mock 애니메이션 = 끝값 즉시
  act(() => modal(tree).props.onRequestClose());
  act(() => { if (Platform.OS === 'ios') modal(tree).props.onDismiss(); else jest.runOnlyPendingTimers(); });
  expect(modal(tree).props.visible).toBe(false);
  mockShared.forEach((shared) => expect(shared.value).toBe(0)); // closing returns to the start pose for the next show
});
it('QA E2: under Reduce Motion the resting pose is the finished sheet (no hidden first frame)', async () => {
  const tree = await mount(); // Reduce Motion ON (beforeEach)
  expect(mockShared.filter((shared) => shared.value === 1)).toHaveLength(8); // 불꽃·글로우·무한(등장·그리기)·시트·제목·본문·버튼 = 최종
  expect(mockShared.every((shared) => shared.value === 0 || shared.value === 1)).toBe(true); // 파티클·링·shimmer·루프 = 정지(0)
  expect(springs()).not.toHaveBeenCalled();
  act(() => unlock(false));
  expect(modal(tree).props.visible).toBe(true);
});
it('QA Android G2: motion starts after the content first lays out + one frame (not at visible, not waiting for late onShow); covers the full screen', async () => {
  const os = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
  try {
    mockReduced = false;
    const withTiming = jest.requireMock('react-native-reanimated').withTiming as jest.Mock;
    const tree = await mount(); act(() => unlock(false));
    expect(withTiming).not.toHaveBeenCalled(); // committed but not drawn yet
    const root = tree.root.findAll((n) => n.props.testID === 'unlock-celebration' && typeof n.props.onLayout === 'function')[0];
    expect(StyleSheet.flatten(root.props.style).minHeight).toBe(jest.requireActual('react-native').Dimensions.get('window').height);
    act(() => root.props.onLayout({ nativeEvent: { layout: { width: 400, height: 300 } } }));
    expect(withTiming).not.toHaveBeenCalled(); // waits one frame
    act(() => jest.runOnlyPendingTimers());
    expect(springs()).toHaveBeenCalledTimes(SEQUENCE_SPRINGS);
    expect(modal(tree).props).toMatchObject({ statusBarTranslucent: true, navigationBarTranslucent: true });
    act(() => modal(tree).props.onShow());
    expect(springs()).toHaveBeenCalledTimes(SEQUENCE_SPRINGS); // late onShow does not restart it
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
it('QA P-493 Android N1: 모달 루트 = 첫 프레임부터 불투명 주황(배경 페이드 없음 — 흰 플래시 금지)', async () => {
  mockReduced = false;
  const { StyleSheet } = jest.requireActual('react-native');
  const { color: C } = jest.requireActual('@/lib/theme');
  const tree = await mount(); act(() => unlock(false));
  const root = tree.root.findAll((n) => n.props.testID === 'unlock-celebration' && typeof n.type === 'string')[0];
  const style = StyleSheet.flatten(root.props.style);
  expect(style.backgroundColor).toBe(C.primaryPress);
  expect(style.opacity).toBeUndefined();
  expect(tree.root.findAll((n) => n.props.testID === 'unlock-bg')).toHaveLength(0);
});
