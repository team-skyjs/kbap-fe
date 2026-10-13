/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/** KB-739 /review 5 → **KB-759 뒤집음**: 제한 도달 시트의 2택(UnlockActions)은 남은 무료 횟수와 무관하게 상시(1~3이어도 리뷰 쓰기 + 광고 보고 풀기).
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
const mockUnlock = jest.fn();
let mockCanWatch = true;
jest.mock('@/features/ads/RewardedUnlock', () => ({ useCanWatchAd: () => mockCanWatch, UnlockActions: (p: Record<string, unknown>) => { mockUnlock(p); const { View } = jest.requireActual<typeof import('react-native')>('react-native'); return <View testID="unlock-actions" />; } }));

import { HomeQuotaBadge } from '../HomeQuotaBadge';

const Q = (remaining: number | 'unlimited', unlocked = false) => ({ count: 0, limit: 3, unlocked, remaining });
const trees: ReactTestRenderer[] = [];
afterEach(() => { while (trees.length) act(() => trees.pop()!.unmount()); });
beforeEach(() => { jest.clearAllMocks(); mockGuest = false; mockFlag.on = true; _setBadgePosCacheForTest(null); });
const layoutBadge = (t: ReactTestRenderer) => {
  const layer = t.root.findAll((n) => typeof n.props?.onLayout === 'function' && n.props?.pointerEvents === 'box-none' && typeof n.type === 'string')[0];
  act(() => layer.props.onLayout({ nativeEvent: { layout: { width: 390, height: 700 } } }));
};
const render = () => { let t!: ReactTestRenderer; act(() => { t = renderer.create(<HomeQuotaBadge top={100} />); }); trees.push(t); layoutBadge(t); return t; };
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type !== 'string');
const hostId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');

it('KB-759: 남은 무료 횟수 1~3 = 시트에 2택(UnlockActions) 상시 · 본문 = 리뷰/광고 양쪽 안내 키', () => {
  for (const n of [1, 2, 3]) {
    mockQuota = Q(n);
    const t = render();
    act(() => byId(t, 'countdown-badge')[0].props.onPress());
    expect(t.root.findByProps({ testID: 'quota-sheet-title' }).props.children).toBe(`scan.freeLeft:${n}`);
    expect(hostId(t, 'unlock-actions')).toHaveLength(1);
    expect(mockUnlock).toHaveBeenCalled();
    expect(JSON.stringify(t.toJSON())).toContain('scan.quotaBodyUnlock');
    expect(JSON.stringify(t.toJSON())).not.toContain('"scan.quotaBody"');
    act(() => t.unmount()); trees.pop();
  }
});

it('#252 /review 4: 광고 버튼이 없으면(구서버·SDK 없음·게스트 — useCanWatchAd false) 본문은 기존 리뷰 전용 quotaBody', () => {
  mockCanWatch = false;
  try {
    mockQuota = Q(2);
    const t = render();
    act(() => byId(t, 'countdown-badge')[0].props.onPress());
    expect(JSON.stringify(t.toJSON())).toContain('"scan.quotaBody"');
    expect(JSON.stringify(t.toJSON())).not.toContain('scan.quotaBodyUnlock');
  } finally { mockCanWatch = true; }
});

it('남은 무료 횟수 0 = 2택(UnlockActions) · 해제 콜백 = 시트 닫기', () => {
  mockQuota = Q(0);
  const t = render();
  act(() => byId(t, 'countdown-badge')[0].props.onPress());
  expect(t.root.findByProps({ testID: 'quota-sheet-title' }).props.children).toBe('scan.quotaTitle');
  expect(hostId(t, 'unlock-actions')).toHaveLength(1);
  expect(mockUnlock).toHaveBeenCalled();
  const p = mockUnlock.mock.calls.at(-1)![0] as { onUnlocked: () => void; onWriteReview: () => void };
  expect(typeof p.onWriteReview).toBe('function');
  act(() => p.onUnlocked());
  expect(t.root.findAll((n) => typeof n.props?.onRequestClose === 'function' && n.props?.visible === true)).toHaveLength(0); // 시트 닫힘
});
