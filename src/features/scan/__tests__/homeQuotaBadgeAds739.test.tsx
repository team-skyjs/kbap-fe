/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/** KB-765(D-23 E2) — 홈 스캔 한도 안내 = 가운데 다이얼로그(바텀시트 표면 교체). KB-759 규칙 유지: 2택(리뷰 / 광고 n/3)은 남은 무료 횟수와 무관하게 상시,
 * 광고 타일은 광고가 실제로 있을 때만(useAdUnlockSource). 두 타일 = 같은 스타일 · 진행 막대 n/3 · 나중에·뒤로가기·딤 = 닫기 · 해제 = 닫기.
 * (이전: KB-739 /review 5 → KB-759 시트 2택 상시)
 * 하네스는 homeQuotaBadge680과 동일(아래 목 블록 복제).
 *
 * 원본 주석:
 * KB-680(P-432) — 홈 카운트다운 뱃지(불꽃 "무료 스캔 N회 남음") 프로토타입.
 * 스펙 = spec specs/001-personalized-menu-mvp/countdown-badge-2026-10-02.md.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockSpring = jest.fn((v: unknown) => v);
let mockFocused = true; // 홈 포커스 — useFocusEffect 목이 blur 시 cleanup을 돌린다
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => {
      const sv = { value: v, get: () => sv.value, set: (n: unknown) => { sv.value = n; } }; // KB-706: 컴파일러 호환 .get/.set
      return sv;
    },
    useAnimatedStyle: (f: () => unknown) => f(),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => mockSpring(v),
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    useAnimatedProps: (f: () => unknown) => f(), // KB-706 불꽃 일렁임
    Easing: { linear: (x: number) => x, ease: (x: number) => x, inOut: (f: unknown) => f },
  };
});
// KB-706: 끌어 놓기 — GestureDetector는 자식 그대로, Pan 콜백은 기록(테스트가 직접 몬다)
jest.mock('react-native-gesture-handler', () => require('@/__tests__/helpers/gestureHandlerMock'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => (() => void) | void) => {
    const { useEffect } = jest.requireActual('react') as typeof import('react');
    const f = mockFocused;
    useEffect(() => (f ? cb() : undefined), [cb, f]);
  },
}));
const mockPush = jest.fn();
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { count?: number }) => (o?.count != null ? `${k}:${o.count}` : k), i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k, getFixedT: () => (k: string) => k } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
let mockQuota: unknown = null;
let mockMemberId = 'm1';
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { id: mockMemberId, scanQuota: mockQuota } }) }));
let mockGuest = false;
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockGuest, useSession: () => null }));
const mockPicker = jest.fn((_p: { kind: string | null; onToggleFood: (f: { foodId: string }) => void }) => null);
jest.mock('@/app/community/compose', () => ({ TagPickerSheet: (p: { kind: string | null; onToggleFood: (f: { foodId: string }) => void }) => mockPicker(p) }));
const mockFlag = { on: true };
jest.mock('@/lib/flags', () => {
  const a = jest.requireActual('@/lib/flags') as { FLAGS: Record<string, unknown> };
  return { ...a, FLAGS: new Proxy(a.FLAGS, { get: (t, k) => (k === 'countdownBadge' ? mockFlag.on : t[k as string]) }) };
});

import { _setBadgePosCacheForTest } from '../badgePosition';
// 광고 타일 원천·상태 기계 목 — 다이얼로그가 그리는 것만 본다(상태 기계 자체는 adsPlacements739가 실제 훅으로 검증)
type MockR = { watched: number; total: number; busy: boolean; loaded: boolean; retryPending: boolean; pressable: boolean; failure: string | null; press: jest.Mock };
let mockAdSource: { sdk: object; rewards: object } | null = { sdk: {}, rewards: { count: 1, forUnlock: 3, remaining: 2 } };
const mockR: MockR = { watched: 1, total: 3, busy: false, loaded: true, retryPending: false, pressable: true, failure: null, press: jest.fn() };
const mockTileProps = jest.fn();
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ ...jest.requireActual('@/lib/analytics'), track: (...a: unknown[]) => mockTrack(...a) }));
jest.mock('@/features/ads/RewardedUnlock', () => ({
  useAdUnlockSource: () => mockAdSource,
  RewardedTile: (p: { render: (r: MockR) => unknown; onUnlocked: () => void; onClose: () => void }) => { mockTileProps(p); return p.render(mockR); },
}));

import { HomeQuotaBadge } from '../HomeQuotaBadge';

const Q = (remaining: number | 'unlimited', unlocked = false) => ({ count: 0, limit: 3, unlocked, remaining });
const trees: ReactTestRenderer[] = [];
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => {
  jest.clearAllMocks(); mockGuest = false; mockFlag.on = true; _setBadgePosCacheForTest(null);
  mockAdSource = { sdk: {}, rewards: { count: 1, forUnlock: 3, remaining: 2 } };
  Object.assign(mockR, { watched: 1, total: 3, busy: false, loaded: true, retryPending: false, pressable: true, failure: null });
});
const layoutBadge = (t: ReactTestRenderer) => {
  const layer = t.root.findAll((n) => typeof n.props?.onLayout === 'function' && n.props?.pointerEvents === 'box-none' && typeof n.type === 'string')[0];
  act(() => layer.props.onLayout({ nativeEvent: { layout: { width: 390, height: 700 } } }));
};
const render = () => { let t!: ReactTestRenderer; act(() => { t = renderer.create(<HomeQuotaBadge top={100} />); }); trees.push(t); layoutBadge(t); return t; };
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type !== 'string');
const hostId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');

const open = (t: ReactTestRenderer) => act(() => byId(t, 'countdown-badge')[0].props.onPress());
const dialogVisible = (t: ReactTestRenderer) => t.root.findAll((n) => typeof n.props?.onRequestClose === 'function' && 'visible' in n.props)[0].props.visible as boolean;
const flatStyle = (n: { props: { style?: unknown } }, pressed = false) => {
  const st = typeof n.props.style === 'function' ? (n.props.style as (s: { pressed: boolean }) => unknown)({ pressed }) : n.props.style;
  return Object.assign({}, ...([st].flat(Infinity as 1).filter(Boolean) as object[])) as Record<string, unknown>;
};
const json = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
// 타일 = 그 testID를 가진 Pressable(함수 스타일) — Tile 래퍼·내부 호스트와 구분
const tiles = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.props?.style === 'function');

it('KB-765: 뱃지 탭 = 가운데 다이얼로그(바텀시트 아님) — 남은 1~3 제목 "n회 남음" · 0 = "모두 사용" · 2택 상시', () => {
  for (const n of [0, 1, 2, 3]) {
    mockQuota = Q(n);
    const t = render();
    expect(dialogVisible(t)).toBe(false);
    open(t);
    expect(dialogVisible(t)).toBe(true);
    expect(hostId(t, 'quota-dialog')).toHaveLength(1);
    expect(t.root.findByProps({ testID: 'quota-sheet-title' }).props.children).toBe(n > 0 ? `scan.freeLeft:${n}` : 'scan.quotaTitle');
    expect(tiles(t, 'quota-sheet-review')).toHaveLength(1);
    expect(tiles(t, 'quota-watch-ad')).toHaveLength(1);
    expect(json(t)).toContain('scan.quotaDialogBody');
    act(() => t.unmount()); trees.pop();
  }
});

it('KB-765: 두 옵션 = 같은 스타일(흰 바탕 · primary 1.5 테두리 · 같은 반경·최소 72h) · 아이콘 원 같은 바탕', () => {
  mockQuota = Q(0);
  const t = render();
  open(t);
  const [review] = tiles(t, 'quota-sheet-review');
  const [ad] = tiles(t, 'quota-watch-ad');
  const pick = (st: Record<string, unknown>) => ({ bg: st.backgroundColor, bw: st.borderWidth, bc: st.borderColor, r: st.borderRadius, minH: st.minHeight, flex: st.flex });
  expect(pick(flatStyle(review))).toEqual(pick(flatStyle(ad)));
  expect(pick(flatStyle(review))).toMatchObject({ bg: '#FFFFFF', bw: 1.5, bc: '#FF7134', minH: 72 });
  const circle = (n: typeof review) => n.findAll((x) => typeof x.type === 'string' && flatStyle(x).width === 44 && flatStyle(x).borderRadius === 22)[0];
  expect(flatStyle(circle(review)).backgroundColor).toBe(flatStyle(circle(ad)).backgroundColor);
});

it('KB-765: 광고 진행 막대 = n/3 칸(완료 primary · 남음 gray-200) + "n/3 시청 완료" 문구', () => {
  mockQuota = Q(0);
  for (const watched of [0, 1, 2]) {
    mockR.watched = watched;
    const t = render();
    open(t);
    expect(hostId(t, 'quota-ad-seg-done')).toHaveLength(watched);
    expect(hostId(t, 'quota-ad-seg-todo')).toHaveLength(3 - watched);
    if (watched > 0) expect(flatStyle(hostId(t, 'quota-ad-seg-done')[0]).backgroundColor).toBe('#FF7134');
    expect(flatStyle(hostId(t, 'quota-ad-seg-todo')[0]).backgroundColor).toBe('#EAEBEE');
    expect(json(t)).toContain('scan.quotaTileAdProgress');
    act(() => t.unmount()); trees.pop();
  }
});

it('KB-765: 나중에 · 뒤로가기(onRequestClose) · 딤 탭 = 같은 닫기', () => {
  mockQuota = Q(0);
  const t = render();
  for (const close of [
    () => byId(t, 'quota-sheet-later')[0].props.onPress(),
    () => t.root.findAll((n) => typeof n.props?.onRequestClose === 'function')[0].props.onRequestClose(),
    () => byId(t, 'quota-dialog-dim')[0].props.onPress(),
  ]) {
    open(t);
    expect(dialogVisible(t)).toBe(true);
    act(close);
    expect(dialogVisible(t)).toBe(false);
  }
});

it('KB-765: 광고 타일 탭 = 상태 기계 press · 해제(onUnlocked) = 닫힘 · 준비 안 됨 = 탭 무동작(busy)', () => {
  mockQuota = Q(0);
  const t = render();
  open(t);
  act(() => tiles(t, 'quota-watch-ad')[0].props.onPress());
  expect(mockR.press).toHaveBeenCalledTimes(1);
  const p = mockTileProps.mock.calls.at(-1)![0] as { onUnlocked: () => void };
  act(() => p.onUnlocked());
  expect(dialogVisible(t)).toBe(false);
  Object.assign(mockR, { loaded: false, pressable: false });
  mockR.press.mockClear();
  open(t);
  const ad = tiles(t, 'quota-watch-ad')[0];
  expect(ad.props.accessibilityState).toMatchObject({ busy: true });
  expect(ad.props.onPress).toBeUndefined();
});

it('KB-765: 네트워크 실패 = 부제 "다시 시도"(같은 키 재신고) · 429 상한 = "오늘은 여기까지" 안내', () => {
  mockQuota = Q(0);
  Object.assign(mockR, { retryPending: true, failure: 'network', pressable: true });
  let t = render();
  open(t);
  expect(json(t)).toContain('common.tryAgain');
  expect(hostId(t, 'quota-ad-error')).toHaveLength(1);
  act(() => t.unmount()); trees.pop();
  Object.assign(mockR, { retryPending: false, failure: 'limit', pressable: false, loaded: true });
  t = render();
  open(t);
  expect(hostId(t, 'quota-ad-limit')).toHaveLength(1);
});

it('KB-759 규칙 유지: 광고가 없으면(게스트·구서버·SDK 없음 — useAdUnlockSource null) 리뷰 타일만 + 본문 = 리뷰 전용 quotaBody', () => {
  mockAdSource = null;
  mockQuota = Q(2);
  const t = render();
  open(t);
  expect(tiles(t, 'quota-sheet-review')).toHaveLength(1);
  expect(tiles(t, 'quota-watch-ad')).toHaveLength(0);
  expect(json(t)).toContain('"scan.quotaBody"');
  expect(json(t)).not.toContain('scan.quotaDialogBody');
});

it('KB-765: 히어로 = 홈 불꽃 뱃지 0회 회색 그대로(CountdownBadge 재사용) · 장식용(버튼 역할 0)', () => {
  mockQuota = Q(0);
  const t = render();
  open(t);
  const hero = hostId(t, 'quota-dialog-flame')[0];
  expect(hero).toBeDefined();
  expect(hero.props.accessibilityRole).toBeUndefined();
  expect(hero.props.accessible).toBe(false);
  expect(hostId(t, 'flame-empty').length).toBeGreaterThan(0);
});

it('KB-765 계측: 열기 = scan_quota_dialog_view {remaining} 1회 · 선택 = scan_quota_dialog_select {option: review|ad|later} · 뒤로가기·딤 = later', () => {
  mockQuota = Q(2);
  const t = render();
  open(t);
  expect(mockTrack).toHaveBeenCalledWith('scan_quota_dialog_view', { remaining: 2 });
  expect(mockTrack.mock.calls.filter(([e]) => e === 'scan_quota_dialog_view')).toHaveLength(1);
  act(() => tiles(t, 'quota-watch-ad')[0].props.onPress());
  expect(mockTrack).toHaveBeenLastCalledWith('scan_quota_dialog_select', { option: 'ad' });
  act(() => tiles(t, 'quota-sheet-review')[0].props.onPress());
  expect(mockTrack).toHaveBeenLastCalledWith('scan_quota_dialog_select', { option: 'review' });
  for (const close of [
    () => byId(t, 'quota-sheet-later')[0].props.onPress(),
    () => t.root.findAll((n) => typeof n.props?.onRequestClose === 'function')[0].props.onRequestClose(),
    () => byId(t, 'quota-dialog-dim')[0].props.onPress(),
  ]) {
    open(t);
    mockTrack.mockClear();
    act(close);
    expect(mockTrack).toHaveBeenCalledWith('scan_quota_dialog_select', { option: 'later' });
    expect(dialogVisible(t)).toBe(false);
  }
});

it('KB-765 QA: 다이얼로그가 열린 동안 홈 뱃지는 숨김(투명도 0 · 터치 0 · 마운트·자리 유지) — 히어로와 불꽃 두 개 방지 · 닫으면 다시 보임', () => {
  mockQuota = Q(0);
  const t = render();
  const badge = () => hostId(t, 'home-quota-badge')[0];
  // 다이얼로그 숨김 = 단독 { opacity: 0 } 스타일 조각(배치 전 투명은 floatStyle 몫 — #234, 별개)
  const hidden = () => [badge().props.style].flat(Infinity as 1).some((x) => !!x && typeof x === 'object' && Object.keys(x).length === 1 && (x as { opacity?: number }).opacity === 0);
  expect(hidden()).toBe(false);
  open(t);
  expect(badge()).toBeDefined();
  expect(hidden()).toBe(true);
  expect(badge().props.pointerEvents).toBe('none');
  act(() => byId(t, 'quota-sheet-later')[0].props.onPress());
  expect(hidden()).toBe(false);
  expect(badge().props.pointerEvents).toBe('auto');
});
