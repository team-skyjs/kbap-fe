/**
 * KB-497 — NotificationSheet(primer / consent): 체크 2개 모두 전 확인 비활성 · 전문 링크 ·
 * 나중에/스크림 = onClose · 제출 가드(더블탭 1회) · 체크 전후 체크박스 메트릭 동일(P-151).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, Modal, StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    // 실모듈처럼 렌더 간 동일 객체(매 렌더 새 객체면 훅 effect가 재실행돼 등장 호출 수가 어긋난다)
    useSharedValue: (v: unknown) => require('react').useRef({ value: v }).current,
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    // KB-553: 완료 콜백 즉시 발화(성공) — 드래그 퇴장 종단 = onClose 경로 검증(sheetSwipeDismiss490 방식)
    withTiming: jest.fn((v: unknown, _c?: unknown, cb?: (f: boolean) => void) => {
      if (cb) cb(true);
      return v;
    }),
    runOnJS: (fn: (...a: unknown[]) => void) => fn,
    interpolate: () => 1,
    Extrapolation: { CLAMP: 'clamp' },
    Easing: { out: () => () => 0, quad: 0, linear: () => 0 },
  };
});
// KB-553: RNGH 표면 목 — Pan 빌더는 등록 콜백을 handlers에 보관(테스트가 직접 구동), 마지막 빌더를 __lastPan에 노출.
// GestureDetector는 testID 호스트로 감싸 "제스처 영역이 핸들+제목에 한정"을 트리로 단언한다. 마지막 Pan은 __getLastPan()로.
type PanHandlers = Record<string, (...a: never[]) => unknown>;
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mod: { __lastPan: { handlers: PanHandlers } | null } = { __lastPan: null };
  const pan = () => {
    const handlers: PanHandlers = {};
    const b: Record<string, (...a: unknown[]) => unknown> & { handlers: PanHandlers } = { handlers } as never;
    for (const k of ['runOnJS', 'onUpdate', 'onFinalize', 'onStart', 'onEnd', 'onChange', 'enabled', 'minDistance', 'activeOffsetY']) {
      b[k] = (cb: unknown) => { if (typeof cb === 'function') handlers[k] = cb as never; return b; };
    }
    mod.__lastPan = b;
    return b;
  };
  return {
    __getLastPan: () => mod.__lastPan, // getter는 목 모듈 복사 시 값으로 굳으므로 함수로 노출
    GestureDetector: ({ children }: { children: unknown }) => React.createElement(View, { testID: 'notif-sheet-gesture' }, children),
    GestureHandlerRootView: View,
    Gesture: { Pan: pan, Tap: pan, Pinch: pan, Race: () => ({}), Simultaneous: () => ({}) },
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

const boxOn = (tree: ReactTestRenderer, kind: string) => (StyleSheet.flatten(host(tree, `consent-${kind}-box`)[0].props.style) as { backgroundColor?: string }).backgroundColor !== 'transparent';
const noticeShown = (tree: ReactTestRenderer) => (StyleSheet.flatten(host(tree, 'notif-sheet-notice')[0].props.style) as { opacity?: number }).opacity !== 0;

it('(b) consent(9/14 종한): 둘 다 체크된 채 열림 → 즉시 확인 가능 · 하나 해제 후 확인 = onConfirm 0 + "둘 다 동의" 안내 · 다시 체크 = 안내 소거 + onConfirm 1회', async () => {
  const p = props({ variant: 'consent' });
  const tree = render(<NotificationSheet {...p} />);
  expect(host(tree, 'consent-privacy-box')).toHaveLength(1);
  expect(host(tree, 'consent-receive-box')).toHaveLength(1);
  expect(boxOn(tree, 'privacy')).toBe(true);
  expect(boxOn(tree, 'receive')).toBe(true);
  expect(host(tree, 'notif-sheet-notice')).toHaveLength(1); // 고정 슬롯 — 항상 렌더
  expect(noticeShown(tree)).toBe(false);
  await tap(tree, 'consent-privacy-full');
  expect(mockOpen).toHaveBeenCalledWith('https://team-skyjs.github.io/kbap-legal/marketing-privacy-consent.html');
  await tap(tree, 'consent-receive-full');
  expect(mockOpen).toHaveBeenCalledWith('https://team-skyjs.github.io/kbap-legal/advertising-receipt-consent.html');
  // 하나 해제 → 확인 탭 = 진행 0 + 안내
  await tap(tree, 'consent-privacy');
  expect(boxOn(tree, 'privacy')).toBe(false);
  expect(pressable(tree, 'notif-sheet-confirm').props.disabled).not.toBe(true); // 탭은 받는다
  await tap(tree, 'notif-sheet-confirm');
  expect(p.onConfirm).not.toHaveBeenCalled();
  expect(noticeShown(tree)).toBe(true);
  // 둘 다 해제여도 동일
  await tap(tree, 'consent-receive');
  await tap(tree, 'notif-sheet-confirm');
  expect(p.onConfirm).not.toHaveBeenCalled();
  // 다시 둘 다 체크 → 안내 소거 → 확인 = onConfirm({true,true}) 1회
  await tap(tree, 'consent-privacy');
  expect(noticeShown(tree)).toBe(true); // 아직 하나 남음
  await tap(tree, 'consent-receive');
  expect(noticeShown(tree)).toBe(false);
  await tap(tree, 'notif-sheet-confirm');
  expect(p.onConfirm).toHaveBeenCalledTimes(1);
  expect(p.onConfirm).toHaveBeenCalledWith({ privacy: true, receive: true });
});

it('(b2) consent: 열린 직후 바로 확인 = onConfirm({privacy:true, receive:true}) 1회 (사전 체크)', async () => {
  const p = props({ variant: 'consent' });
  const tree = render(<NotificationSheet {...p} />);
  await tap(tree, 'notif-sheet-confirm');
  expect(p.onConfirm).toHaveBeenCalledTimes(1);
  expect(p.onConfirm).toHaveBeenCalledWith({ privacy: true, receive: true });
});

it('(c) 나중에 / 스크림 탭 = onClose(열림 1회당 1번 — 닫힌 뒤 재탭은 무시, 재오픈 후 다시 1회), onConfirm 0회', async () => {
  const p = props({ variant: 'consent' });
  const tree = render(<NotificationSheet {...p} />);
  await tap(tree, 'notif-sheet-later');
  expect(p.onClose).toHaveBeenCalledTimes(1);
  await tap(tree, 'notif-sheet-backdrop'); // 이미 닫힘 처리됨 → 무시(Codex #150 P2: 중복 onClose 차단)
  expect(p.onClose).toHaveBeenCalledTimes(1);
  act(() => { tree.update(<NotificationSheet {...p} open={false} />); });
  act(() => { tree.update(<NotificationSheet {...p} open />); });
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
  // 안내 슬롯도 표시 전후 메트릭 동일(불투명도만) — 시트 높이 불변
  const nm = (st: unknown) => { const f = StyleSheet.flatten(st as never) as Record<string, unknown>; return { lh: f.lineHeight, fs: f.fontSize, mt: f.marginTop }; };
  const nBefore = nm(host(tree, 'notif-sheet-notice')[0].props.style);
  await tap(tree, 'notif-sheet-confirm'); // privacy 해제 상태 → 안내 표시
  expect(noticeShown(tree)).toBe(true);
  expect(nm(host(tree, 'notif-sheet-notice')[0].props.style)).toEqual(nBefore);
});

it('(f) 닫히면 pending 변경·안내가 폐기된다(재오픈 = 둘 다 체크·안내 없음)', async () => {
  const p = props({ variant: 'consent' });
  const tree = render(<NotificationSheet {...p} />);
  await tap(tree, 'consent-privacy'); // 해제
  await tap(tree, 'notif-sheet-confirm'); // 안내 표시
  expect(boxOn(tree, 'privacy')).toBe(false);
  expect(noticeShown(tree)).toBe(true);
  act(() => { tree.update(<NotificationSheet {...p} open={false} />); });
  act(() => { tree.update(<NotificationSheet {...p} open />); });
  expect(boxOn(tree, 'privacy')).toBe(true);
  expect(boxOn(tree, 'receive')).toBe(true);
  expect(noticeShown(tree)).toBe(false);
});

// ───────────── KB-553: 시트 모션(슬라이드·드래그 닫힘) ─────────────
const SHEET_SRC = () => require('fs').readFileSync('src/features/push/NotificationSheet.tsx', 'utf8') as string;
const frame = (st: unknown) => {
  const f = StyleSheet.flatten(st as never) as Record<string, unknown>;
  return { pt: f.paddingTop, pb: f.paddingBottom, ph: f.paddingHorizontal, rl: f.borderTopLeftRadius, rr: f.borderTopRightRadius, gap: f.gap };
};

it('(g) KB-553 소스 잠금: Modal fade(딤만 — slide는 딤까지 밀어 올림) + 시트 슬라이드는 훅 animateIn · Modal 직계 GestureHandlerRootView', () => {
  const src = SHEET_SRC();
  expect(src).toContain('animationType="fade"');
  expect(src).not.toContain('animationType="slide"');
  expect(src).toContain('animateIn: true');
  expect(src).toMatch(/<Modal[^>]*>\s*(\{\/\*[\s\S]*?\*\/\}\s*)?<GestureHandlerRootView/);
});

it('(j) 프레임 불변(P-151, FR-009): 시트 컨테이너 메트릭이 open 전환·체크 전후 동일, 핸들 36×4 1개', async () => {
  const p = props({ variant: 'consent' });
  const tree = render(<NotificationSheet {...p} open={false} />);
  act(() => { tree.update(<NotificationSheet {...p} open />); });
  const before = frame(host(tree, 'notif-sheet-consent')[0].props.style);
  expect(before).toEqual({ pt: 10, pb: 34, ph: 20, rl: 24, rr: 24, gap: 12 });
  await tap(tree, 'consent-privacy');
  expect(frame(host(tree, 'notif-sheet-consent')[0].props.style)).toEqual(before);
  const handles = tree.root.findAll((n) => {
    if (typeof n.type !== 'string') return false;
    const f = StyleSheet.flatten(n.props?.style as never) as { width?: number; height?: number } | undefined;
    return f?.width === 36 && f?.height === 4;
  });
  expect(handles).toHaveLength(1);
});

type PanEvent = { translationY: number; velocityY: number };
type PanH = { onUpdate?: (e: PanEvent) => void; onFinalize?: (e: PanEvent, success: boolean) => void };
const lastPan = () => (require('react-native-gesture-handler') as { __getLastPan: () => { handlers: PanH } | null }).__getLastPan()!.handlers;

it('(h) 드래그 배선(FR-003/FR-006): 임계 미만 → onClose 0 · 이동 90 → 1회 · 재발화 무시 · 취소(success=false) → 0', () => {
  const p1 = props({ variant: 'consent' });
  render(<NotificationSheet {...p1} />);
  const h1 = lastPan();
  expect(typeof h1.onFinalize).toBe('function');
  h1.onUpdate?.({ translationY: 40, velocityY: 0 });
  h1.onFinalize?.({ translationY: 40, velocityY: 100 }, true);
  expect(p1.onClose).not.toHaveBeenCalled();

  const p2 = props();
  render(<NotificationSheet {...p2} />);
  const h2 = lastPan();
  h2.onFinalize?.({ translationY: 90, velocityY: 0 }, true);
  expect(p2.onClose).toHaveBeenCalledTimes(1);
  h2.onFinalize?.({ translationY: 200, velocityY: 900 }, true); // 단일 발사
  expect(p2.onClose).toHaveBeenCalledTimes(1);

  const p3 = props();
  render(<NotificationSheet {...p3} />);
  lastPan().onFinalize?.({ translationY: 150, velocityY: 900 }, false); // OS 인터럽트 = 복귀
  expect(p3.onClose).not.toHaveBeenCalled();
});

it('(i) 제스처 영역 = 시트 전체(9/14 종한 — 본문 스크롤 없어 P-337 한정 사유 없음): 스크림은 밖, 시트 내부 탭은 (b)(c)(d)로 동작 보증', () => {
  const tree = render(<NotificationSheet {...props({ variant: 'consent' })} />);
  const area = host(tree, 'notif-sheet-gesture');
  expect(area).toHaveLength(1);
  const inside = (id: string) => area[0].findAll((n) => n.props?.testID === id && typeof n.type === 'string');
  expect(inside('notif-sheet-consent')).toHaveLength(1); // 시트 컨테이너가 제스처 영역 직계
  for (const id of ['notif-sheet-grab', 'consent-privacy', 'consent-privacy-full', 'notif-sheet-confirm', 'notif-sheet-later']) {
    expect({ id, inside: inside(id).length }).toEqual({ id, inside: 1 });
  }
  expect(inside('notif-sheet-backdrop')).toHaveLength(0); // 스크림은 드래그 대상 아님(탭 닫힘만)
});

it('(k) 소스 잠금: 훅에 open 전달(재오픈 리셋, FR-007) · dimStyle/sheetStyle/onSheetLayout 배선(FR-004/FR-008)', () => {
  const src = SHEET_SRC();
  expect(src).toContain('useSheetSwipeDismiss(onClose, open, { animateIn: true })');
  expect(src).toContain('swipe.dismiss(');
  expect(src).toContain('swipe.dimStyle');
  expect(src).toContain('swipe.sheetStyle');
  expect(src).toContain('onLayout={swipe.onSheetLayout}');
});

const modalVisible = (tree: ReactTestRenderer) => tree.root.findAllByType(Modal)[0].props.visible as boolean;
const timing = () => (require('react-native-reanimated') as { withTiming: jest.Mock }).withTiming;
const exitCalls = () => timing().mock.calls.filter((c: unknown[]) => (c[1] as { duration?: number } | undefined)?.duration === 180);
const enterCalls = () => timing().mock.calls.filter((c: unknown[]) => (c[1] as { duration?: number } | undefined)?.duration === 240);

it('(l) 닫힘 = 시트 슬라이드 다운(180ms) 후 Modal 숨김 — 버튼/스크림 경로는 퇴장 1회, 드래그로 이미 내려간 뒤엔 즉시', async () => {
  // 버튼·스크림 경로: onClose → 호출부 open=false → 퇴장 애니메이션 → visible=false
  const p = props({ variant: 'consent' });
  const tree = render(<NotificationSheet {...p} />);
  expect(modalVisible(tree)).toBe(true);
  await tap(tree, 'notif-sheet-later');
  expect(p.onClose).toHaveBeenCalledTimes(1);
  expect(modalVisible(tree)).toBe(true); // 호출부가 open을 내리기 전까지 유지
  expect(enterCalls()).toHaveLength(1); // 등장 = 훅 animateIn(240ms 직선)
  act(() => { tree.update(<NotificationSheet {...p} open={false} />); });
  expect(exitCalls()).toHaveLength(1); // 퇴장 180ms 1회
  expect(modalVisible(tree)).toBe(false);
  // 재오픈 = 다시 보임 + 등장 애니메이션 재실행
  act(() => { tree.update(<NotificationSheet {...p} open />); });
  expect(modalVisible(tree)).toBe(true);
  expect(enterCalls()).toHaveLength(2);

  // 드래그 경로: 훅이 이미 내렸으므로(withTiming 1회) open=false에 추가 애니메이션 없이 즉시 숨김
  timing().mockClear();
  const p2 = props();
  const t2 = render(<NotificationSheet {...p2} />);
  lastPan().onFinalize?.({ translationY: 90, velocityY: 0 }, true);
  expect(p2.onClose).toHaveBeenCalledTimes(1);
  expect(exitCalls()).toHaveLength(1);
  act(() => { t2.update(<NotificationSheet {...p2} open={false} />); });
  expect(exitCalls()).toHaveLength(1); // 추가 퇴장 애니메이션 0 — 즉시 숨김
  expect(modalVisible(t2)).toBe(false);
});

it('(m) Codex #150: 퇴장 중(open=false·Modal 유지)엔 루트 pointerEvents none — 확인·스크림 무반응 · VoiceOver 안내 · 안내 비표시 시 a11y 트리 제외', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  const p = props({ variant: 'consent' });
  const tree = render(<NotificationSheet {...p} />);
  const root = () => host(tree, 'notif-sheet-root')[0];
  expect(root().props.pointerEvents).toBe('auto');
  const notice = () => host(tree, 'notif-sheet-notice')[0];
  expect(notice().props.accessibilityElementsHidden).toBe(true);
  await tap(tree, 'consent-privacy');
  await tap(tree, 'notif-sheet-confirm');
  expect(announce).toHaveBeenCalledWith('push.consentBothRequired');
  expect(notice().props.accessibilityElementsHidden).toBe(false);
  // 닫힘 시작(호출부 open=false) — 퇴장 완료를 지연시켜 "Modal은 아직 보이고 조작만 막힌" 중간 상태를 본다
  let exitCb: ((f: boolean) => void) | undefined;
  timing().mockImplementationOnce((v: unknown, _c?: unknown, cb?: (f: boolean) => void) => { exitCb = cb; return v; });
  act(() => { tree.update(<NotificationSheet {...p} open={false} />); });
  expect(modalVisible(tree)).toBe(true); // 퇴장 중 = 아직 보임
  expect(root().props.pointerEvents).toBe('none'); // 그러나 무반응
  act(() => { exitCb!(true); });
  expect(modalVisible(tree)).toBe(false); // 완료 후 내려감
  announce.mockRestore();
});

it('(n) Codex #150 P2: 나중에·스크림·안드 백버튼은 훅 dismiss 경유 — 닫힘 진행 중 재입력에도 onClose 1회', async () => {
  const p = props();
  const tree = render(<NotificationSheet {...p} />);
  // 등장(animateIn) withTiming이 먼저 소비되므로 렌더 뒤에 퇴장 애니메이션을 붙잡아 "진행 중" 상태를 만든다
  let exitCb: ((f: boolean) => void) | undefined;
  timing().mockImplementationOnce((v: unknown, _c?: unknown, cb?: (f: boolean) => void) => { exitCb = cb; return v; });
  const modal = tree.root.findAllByType(Modal)[0];
  act(() => { modal.props.onRequestClose(); }); // 안드 백버튼 → 퇴장 시작(진행 중)
  expect(p.onClose).not.toHaveBeenCalled();
  act(() => { modal.props.onRequestClose(); }); // 진행 중 재입력 → 무시
  await tap(tree, 'notif-sheet-later'); // 진행 중 탭 → 무시
  await tap(tree, 'notif-sheet-backdrop');
  act(() => { exitCb!(true); }); // 완료
  expect(p.onClose).toHaveBeenCalledTimes(1);
  // 스와이프 퇴장 진행 중 백버튼도 동일하게 1회
  timing().mockClear();
  const p2 = props();
  const t2 = render(<NotificationSheet {...p2} />);
  timing().mockImplementationOnce((v: unknown, _c?: unknown, cb?: (f: boolean) => void) => { exitCb = cb; return v; });
  lastPan().onFinalize?.({ translationY: 120, velocityY: 0 }, true);
  act(() => { t2.root.findAllByType(Modal)[0].props.onRequestClose(); });
  act(() => { exitCb!(true); });
  expect(p2.onClose).toHaveBeenCalledTimes(1);
});
