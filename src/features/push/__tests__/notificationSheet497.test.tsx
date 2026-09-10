/**
 * KB-497 — NotificationSheet(primer / consent): 체크 2개 모두 전 확인 비활성 · 전문 링크 ·
 * 나중에/스크림 = onClose · 제출 가드(더블탭 1회) · 체크 전후 체크박스 메트릭 동일(P-151).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockOpen = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/openExternal', () => ({ openWebPage: (...a: unknown[]) => mockOpen(...a) }));

import { NotificationSheet } from '../NotificationSheet';

const trees: ReactTestRenderer[] = [];
afterEach(() => { act(() => trees.forEach((t) => t.unmount())); trees.length = 0; });
function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  trees.push(tree);
  return tree;
}
const host = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
const pressable = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0];
const tap = async (tree: ReactTestRenderer, id: string) => { const n = pressable(tree, id); expect(n).toBeDefined(); await act(async () => { n.props.onPress(); }); };
const props = (over: Partial<React.ComponentProps<typeof NotificationSheet>> = {}) => ({
  open: true, variant: 'primer' as const, title: 'T', body: 'B', confirmLabel: 'OK', onConfirm: jest.fn(), onClose: jest.fn(), ...over,
});

beforeEach(() => jest.clearAllMocks());

it('(a) primer: 제목·본문·확인·나중에, 체크 행 없음, 확인 → onConfirm(undefined)', async () => {
  const p = props();
  const tree = render(<NotificationSheet {...p} />);
  expect(host(tree, 'notif-sheet-primer')).toHaveLength(1);
  expect(host(tree, 'consent-privacy-box')).toHaveLength(0);
  const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children);
  expect(texts).toEqual(expect.arrayContaining(['T', 'B', 'OK', 'push.primerLater']));
  await tap(tree, 'notif-sheet-confirm');
  expect(p.onConfirm).toHaveBeenCalledTimes(1);
  expect(p.onConfirm).toHaveBeenCalledWith(undefined);
});

it('(b) consent: 체크 2행 + 전문 링크, 둘 다 체크 전 확인 비활성(탭 무동작), 둘 다 후 onConfirm({privacy,receive}) 1회', async () => {
  const p = props({ variant: 'consent' });
  const tree = render(<NotificationSheet {...p} />);
  expect(host(tree, 'consent-privacy-box')).toHaveLength(1);
  expect(host(tree, 'consent-receive-box')).toHaveLength(1);
  await tap(tree, 'consent-privacy-full');
  expect(mockOpen).toHaveBeenCalledWith('https://team-skyjs.github.io/kbap-legal/marketing-privacy.html');
  await tap(tree, 'consent-receive-full');
  expect(mockOpen).toHaveBeenCalledWith('https://team-skyjs.github.io/kbap-legal/marketing-receive.html');
  expect(pressable(tree, 'notif-sheet-confirm').props.disabled).toBe(true);
  await tap(tree, 'notif-sheet-confirm');
  expect(p.onConfirm).not.toHaveBeenCalled();
  await tap(tree, 'consent-privacy');
  expect(pressable(tree, 'notif-sheet-confirm').props.disabled).toBe(true);
  await tap(tree, 'notif-sheet-confirm');
  expect(p.onConfirm).not.toHaveBeenCalled();
  await tap(tree, 'consent-receive');
  expect(pressable(tree, 'notif-sheet-confirm').props.disabled).toBe(false);
  await tap(tree, 'notif-sheet-confirm');
  expect(p.onConfirm).toHaveBeenCalledTimes(1);
  expect(p.onConfirm).toHaveBeenCalledWith({ privacy: true, receive: true });
});

it('(c) 나중에 / 스크림 탭 = onClose, onConfirm 0회', async () => {
  const p = props({ variant: 'consent' });
  const tree = render(<NotificationSheet {...p} />);
  await tap(tree, 'notif-sheet-later');
  await tap(tree, 'notif-sheet-backdrop');
  expect(p.onClose).toHaveBeenCalledTimes(2);
  expect(p.onConfirm).not.toHaveBeenCalled();
});

it('(d) 확인은 useSubmitGuard 경유 — 응답 전 더블탭에도 onConfirm 1회', async () => {
  let release!: () => void;
  const onConfirm = jest.fn(() => new Promise<void>((r) => { release = r; }));
  const tree = render(<NotificationSheet {...props({ onConfirm })} />);
  const n = pressable(tree, 'notif-sheet-confirm');
  await act(async () => { n.props.onPress(); n.props.onPress(); });
  expect(onConfirm).toHaveBeenCalledTimes(1);
  await act(async () => { release(); });
});

it('(e) 체크 전후 체크박스 컨테이너 메트릭 동일 — 색만 바뀐다 (P-151, SC-008)', async () => {
  const tree = render(<NotificationSheet {...props({ variant: 'consent' })} />);
  const metrics = (st: unknown) => { const f = StyleSheet.flatten(st as never) as Record<string, unknown>; return { w: f.width, h: f.height, bw: f.borderWidth, r: f.borderRadius }; };
  const before = metrics(host(tree, 'consent-privacy-box')[0].props.style);
  await tap(tree, 'consent-privacy');
  const after = metrics(host(tree, 'consent-privacy-box')[0].props.style);
  expect(after).toEqual(before);
  expect(before.bw).toBeGreaterThan(0); // 미선택도 보더 자리 유지(투명 아님·같은 폭)
});

it('(f) 닫히면 pending 체크가 폐기된다(재오픈 시 미체크)', async () => {
  const p = props({ variant: 'consent' });
  const tree = render(<NotificationSheet {...p} />);
  await tap(tree, 'consent-privacy');
  act(() => { tree.update(<NotificationSheet {...p} open={false} />); });
  act(() => { tree.update(<NotificationSheet {...p} open />); });
  const box = host(tree, 'consent-privacy-box')[0];
  const f = StyleSheet.flatten(box.props.style) as { backgroundColor?: string };
  expect(f.backgroundColor).toBe('transparent');
});
