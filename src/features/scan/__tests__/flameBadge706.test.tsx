/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-706(P-445) 불꽃 뱃지 2차 — 계속 일렁임(정지 조건) · 끌어 놓기 → 가장자리 스냅 → 저장 → 재마운트 복원(범위 밖 보정) · 탭/끌기 구분.
 * (하네스 = badgeFireworksLost699 그대로 + withRepeat 계수 + 제스처 목(Pan 콜백을 직접 몬다))
 * 실기 제스처·워클릿은 jest가 못 돈다 — 발행 전 실기 확인 대상(CLAUDE.md P-065).
 */
import * as React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockRepeat = jest.fn((v: unknown) => v);
const mockSpring = jest.fn((v: unknown) => v);
let mockReduced = false; // 동작 줄이기 — 컴포넌트는 useMotionState(AccessibilityInfo) 한 벌로 판정
let mockFocused = true; // 홈 포커스 — useFocusEffect 목이 blur 시 cleanup을 돌린다
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    // 끌기 테스트: 공유값이 렌더 사이에 유지돼야 한다(실물처럼) — ref로
    useSharedValue: (v: unknown) =>
      (jest.requireActual('react') as typeof import('react')).useRef(
        (() => {
          const sv = { value: v, get: () => sv.value, set: (n: unknown) => { sv.value = n; } };
          return sv;
        })(),
      ).current,
    useAnimatedStyle: (f: () => unknown) => f(),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => mockSpring(v),
    withRepeat: (v: unknown) => mockRepeat(v),
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    useAnimatedProps: (f: () => unknown) => f(), // KB-706 불꽃 일렁임
    Easing: { linear: (x: number) => x },
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
let mockMeEmpty = false; // KB-699: 재조회 중 me가 잠깐 비는 렌더(data undefined)
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: mockMeEmpty ? undefined : { id: mockMemberId, scanQuota: mockQuota } }) }));
let mockGuest = false;
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockGuest, useSession: () => null }));
const mockPicker = jest.fn((_p: { kind: string | null; onToggleFood: (f: { foodId: string }) => void }) => null);
jest.mock('@/app/community/compose', () => ({ TagPickerSheet: (p: { kind: string | null; onToggleFood: (f: { foodId: string }) => void }) => mockPicker(p) }));
const mockFlag = { on: true };
jest.mock('@/lib/flags', () => {
  const a = jest.requireActual('@/lib/flags') as { FLAGS: Record<string, unknown> };
  return { ...a, FLAGS: new Proxy(a.FLAGS, { get: (t, k) => (k === 'countdownBadge' ? mockFlag.on : t[k as string]) }) };
});

import { HomeQuotaBadge, _resetQuotaCelebrationMemoryForTest } from '../HomeQuotaBadge';
import { BADGE_DRAWN_ABOVE, BADGE_H, BADGE_W, FLAME_SCALE } from '@/components/CountdownBadge';
import { BADGE_POS_KEY, _setBadgePosCacheForTest, badgeBounds, clampTop, edgeX, nearestSide, parseBadgePos } from '../badgePosition';
import { FLAME_VIEWBOX, OUTER_FRAMES, OUTER_REST_D, flameDrawnTopUnit } from '@/components/flameGeometry';
import { FAB_OVERHANG } from '@/components/TabBar';

const { pans } = require('@/__tests__/helpers/gestureHandlerMock') as typeof import('@/__tests__/helpers/gestureHandlerMock');
const Q = (remaining: number | 'unlimited', unlocked = false) => ({ count: 0, limit: 3, unlocked, remaining });
const AREA = { w: 390, h: 700 };
const HEADER = 100;
const ANCHOR = 160; // 측정 앵커 = 검색 줄 아래 끝(156) + BADGE_GAP
const ROW_BOTTOM = ANCHOR - 4;
/** #234: 위 한계 = 검색 줄 아래 끝 + 4 + 불꽃이 상자 위로 그려지는 높이 — 기본 자리도 여기 */
const MIN_TOP = ROW_BOTTOM + 4 + BADGE_DRAWN_ABOVE;

const mountedTrees: ReactTestRenderer[] = [];
afterEach(() => {
  while (mountedTrees.length) {
    const tr = mountedTrees.pop()!;
    try {
      act(() => tr.unmount());
    } catch {
      /* 이미 언마운트 */
    }
  }
});
const el = () => <HomeQuotaBadge top={ANCHOR} headerH={HEADER} />;
function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el());
  });
  mountedTrees.push(tree);
  return tree;
}
const rerender = (t: ReactTestRenderer) => act(() => t.update(el()));
const flush = async () => {
  await act(async () => {});
  await act(async () => {}); // 저장소 읽기(목 Promise 체인)까지
};
const host = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type === 'string');
/** 홈 영역 측정(레이어 onLayout) */
const layout = (t: ReactTestRenderer) => {
  const layer = t.root.findAll((n) => typeof n.props?.onLayout === 'function' && n.props?.pointerEvents === 'box-none' && typeof n.type === 'string')[0];
  act(() => layer.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: AREA.w, height: AREA.h } } }));
};
/** 목의 useAnimatedStyle은 렌더 때 계산 — 공유값을 쓴 effect 뒤 한 번 다시 그려 읽는다 */
const place = (t: ReactTestRenderer) => {
  rerender(t);
  const st = StyleSheet.flatten(host(t, 'home-quota-badge')[0].props.style) as { transform?: { translateX?: number; translateY?: number }[]; top?: number; right?: number };
  const tr = st.transform ?? [];
  return { x: tr.find((o) => 'translateX' in o)?.translateX, y: tr.find((o) => 'translateY' in o)?.translateY, top: st.top, right: st.right };
};
const lastPan = () => pans[pans.length - 1];
function drag(t: ReactTestRenderer, dx: number, dy: number) {
  const p = lastPan();
  act(() => p.handlers.onStart?.());
  act(() => p.handlers.onUpdate?.({ translationX: dx, translationY: dy }));
  act(() => p.handlers.onEnd?.({}, true)); // 정상 놓기(success)
  act(() => p.handlers.onFinalize?.());
  void t;
}
/** FlameShape가 넘긴 Path(컴포넌트 노드 — animatedProps는 네이티브 호스트까지 안 내려간다) */
const outer = (t: ReactTestRenderer) => t.root.findAll((n) => n.props?.testID === 'flame-outer' && typeof n.type !== 'string')[0];

beforeEach(async () => {
  _setBadgePosCacheForTest(undefined); // KB-706: 뱃지 위치 세션 캐시 — 읽기 전부터(상태 기계 검증)
  _resetQuotaCelebrationMemoryForTest();
  mockMeEmpty = false;
  mockQuota = Q(2);
  mockMemberId = 'm1';
  mockGuest = false;
  mockReduced = false;
  mockFocused = true;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(mockReduced));
  mockFlag.on = true;
  mockSpring.mockClear();
  mockRepeat.mockClear();
  mockPicker.mockClear();
  mockPush.mockClear();
  pans.length = 0;
  await AsyncStorage.clear();
});

describe('계속 일렁임 — 펄스 대체 · 정지 조건', () => {
  it('보임 + 동작 줄이기 꺼짐 확인 = 일렁임 루프 시작(키프레임 path · 불티) · 미확인 동안은 정지', async () => {
    const t = render();
    expect(mockRepeat).not.toHaveBeenCalled(); // 미확인(조회 전) = 움직임 금지(#229) · 저장 위치 읽기 전 = 아직 안 그림(#234 공부)
    expect(host(t, 'home-quota-badge')).toHaveLength(0);
    await flush();
    expect(mockRepeat).toHaveBeenCalledTimes(1);
    expect(outer(t).props.animatedProps).toBeDefined(); // 일렁임 = animatedProps(d)
    expect(t.root.findAll((n) => n.props?.testID === 'flame-spark').length).toBeGreaterThan(0);
  });

  it('동작 줄이기 켜짐 = 가라앉은 모양 정지(루프 0 · 불티 0)', async () => {
    mockReduced = true;
    const t = render();
    await flush();
    expect(mockRepeat).not.toHaveBeenCalled();
    expect(outer(t).props.d).toBe(OUTER_REST_D);
    expect(t.root.findAll((n) => n.props?.testID === 'flame-spark')).toHaveLength(0);
  });

  it('홈이 가려지면 정지(가라앉은 모양) · 다시 보이면 재개', async () => {
    const t = render();
    await flush();
    expect(outer(t).props.animatedProps).toBeDefined();
    mockFocused = false; // 리뷰 작성 화면 등으로
    rerender(t);
    expect(outer(t).props.animatedProps).toBeUndefined();
    expect(outer(t).props.d).toBe(OUTER_REST_D);
    mockRepeat.mockClear();
    mockFocused = true;
    rerender(t);
    expect(mockRepeat).toHaveBeenCalledTimes(1);
  });

  it('꺼진 불꽃(0회) = 회색 정지 — 루프 0 · 빛·불티 0', async () => {
    mockQuota = Q(0);
    const t = render();
    await flush();
    expect(mockRepeat).not.toHaveBeenCalled();
    expect(t.root.findAll((n) => n.props?.testID === 'flame-empty').length).toBeGreaterThan(0);
    expect(t.root.findAll((n) => n.props?.testID === 'flame-glow' || n.props?.testID === 'flame-spark')).toHaveLength(0);
  });
});

describe('끌어 놓기 — 가장자리 스냅 · 저장 · 복원', () => {
  it('측정 전 = 기본 자리(오른쪽 20 · 측정 앵커) · 측정 뒤 = 같은 자리(translate)', async () => {
    const t = render();
    await flush();
    expect(place(t)).toEqual(expect.objectContaining({ top: MIN_TOP, right: 20 }));
    layout(t);
    expect(place(t)).toEqual(expect.objectContaining({ x: AREA.w - 20 - BADGE_W, y: MIN_TOP }));
  });

  it('왼쪽으로 끌어 놓으면 왼쪽 가장자리(20)에 붙고 높이는 놓은 그대로 · 놓을 때 1회 저장', async () => {
    const t = render();
    await flush();
    layout(t);
    const setItem = AsyncStorage.setItem as jest.Mock; // 목 자체가 jest.fn(spyOn·restore 하면 구현이 지워진다)
    setItem.mockClear();
    drag(t, -250, 120);
    expect(place(t)).toEqual(expect.objectContaining({ x: 20, y: MIN_TOP + 120 })); // 시작 = 기본 자리(한계)
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(BADGE_POS_KEY, JSON.stringify({ side: 'left', top: MIN_TOP + 120 }));
  });

  it('재마운트(재실행) = 저장 자리 복원 · 범위 밖 저장값은 범위 안으로', async () => {
    await AsyncStorage.setItem(BADGE_POS_KEY, JSON.stringify({ side: 'left', top: 300 }));
    const t = render();
    await flush();
    layout(t);
    expect(place(t)).toEqual(expect.objectContaining({ x: 20, y: 300 }));
    act(() => t.unmount());
    mountedTrees.length = 0;
    _setBadgePosCacheForTest(undefined); // 앱 재실행 = 세션 캐시 없음 → 저장소에서 읽음
    await AsyncStorage.setItem(BADGE_POS_KEY, JSON.stringify({ side: 'right', top: 5000 })); // 큰 화면에서 저장 → 작은 화면
    const t2 = render();
    await flush();
    layout(t2);
    expect(place(t2)).toEqual(expect.objectContaining({ x: AREA.w - 20 - BADGE_W, y: AREA.h - BADGE_H - (FAB_OVERHANG + 8) }));
  });

  it('끄는 동안 위로는 검색 줄 아래 + 여백 + 불꽃 그림 높이까지만(#234 — 헤더 아래가 아님)', async () => {
    const t = render();
    await flush();
    layout(t);
    drag(t, 0, -1000);
    expect(place(t).y).toBe(MIN_TOP);
  });

  it('탭/끌기 구분 — 짧은 이동(8 미만)은 탭(시트) · 끌기 직후 들어온 탭은 시트를 안 연다', async () => {
    const t = render();
    await flush();
    layout(t);
    expect(lastPan().config.minDistance).toBe(8);
    expect(lastPan().config.runOnJS).toBe(true);
    const press = () => act(() => t.root.findAll((n) => n.props?.testID === 'countdown-badge' && typeof n.props.onPress === 'function')[0].props.onPress());
    const sheetOpen = () => t.root.findAll((n) => n.props?.testID === 'quota-sheet-title').length > 0;
    drag(t, 0, 50);
    press();
    expect(sheetOpen()).toBe(false); // 끌기 = 시트 안 열림
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350)); // 짧은 창(300ms)이 지난 뒤
    });
    press();
    expect(sheetOpen()).toBe(true); // 그냥 탭 = 시트
  });
});

describe('Codex #234 — 끝 콜백이 안 오는 경로 · 늦은 읽기', () => {
  it('① 끌기 취소(onEnd 없이 onFinalize만) = 지금 자리로 돌아가고 저장 0 · 탭 가드는 짧은 창 뒤 풀림', async () => {
    const t = render();
    await flush();
    layout(t);
    const setItem = AsyncStorage.setItem as jest.Mock;
    setItem.mockClear();
    const p = lastPan();
    act(() => p.handlers.onStart?.());
    act(() => p.handlers.onUpdate?.({ translationX: -250, translationY: 120 }));
    act(() => p.handlers.onFinalize?.()); // OS 끼어들기 — onEnd 없음
    expect(place(t)).toEqual(expect.objectContaining({ x: AREA.w - 20 - BADGE_W, y: MIN_TOP })); // 끌던 좌표에 멈춰 남지 않음
    expect(setItem).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    act(() => t.root.findAll((n) => n.props?.testID === 'countdown-badge' && typeof n.props.onPress === 'function')[0].props.onPress());
    expect(t.root.findAll((n) => n.props?.testID === 'quota-sheet-title').length).toBeGreaterThan(0);
  });

  it('② 사용자 이동이 읽기보다 먼저면 늦게 온 옛 저장값이 그 자리를 되돌리지 않는다(읽기 중엔 안 그려 실사용 경로는 막혔지만 방어 유지)', async () => {
    let resolveRead!: (v: string | null) => void;
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => new Promise<string | null>((r) => { resolveRead = r; }));
    const t = render();
    await flush();
    layout(t);
    expect(host(t, 'home-quota-badge')).toHaveLength(0); // 읽는 중 = 안 그림
    drag(t, -250, 120); // (제스처 콜백 직접 구동) 왼쪽으로 놓음 — 시작 위치 0 기준
    expect(place(t)).toEqual(expect.objectContaining({ x: 20, y: MIN_TOP }));
    await act(async () => {
      resolveRead(JSON.stringify({ side: 'right', top: 300 })); // 이전 실행의 옛 자리가 늦게 도착
    });
    expect(place(t)).toEqual(expect.objectContaining({ x: 20, y: MIN_TOP }));
  });
});

describe('#234 공부 — 저장값 읽기 상태 기계', () => {
  it('저장 자리가 있고 읽기가 측정보다 늦게 끝나도 기본 자리 프레임이 한 번도 안 그려진다 → 읽기 뒤 바로 저장 자리', async () => {
    let resolveRead!: (v: string | null) => void;
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => new Promise<string | null>((r) => { resolveRead = r; }));
    const t = render();
    const seen: string[] = [];
    const snap = () => {
      if (host(t, 'home-quota-badge').length) {
        const p = place(t);
        seen.push(`${p.x ?? 'r' + p.right},${p.y ?? p.top}`);
      }
    };
    snap();
    await flush();
    snap();
    layout(t);
    snap();
    await act(async () => {
      resolveRead(JSON.stringify({ side: 'left', top: 300 }));
    });
    snap();
    expect(seen).toEqual(['20,300']); // 기본 자리(r20,160 / 306,160)·translate(0,0) 0회
  });

  it('읽기 실패 = 기본 자리로 뜬다(읽는 중 상태에 갇혀 영영 안 뜨지 않음)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('io')));
    const t = render();
    await flush();
    layout(t);
    expect(place(t)).toEqual(expect.objectContaining({ x: AREA.w - 20 - BADGE_W, y: MIN_TOP }));
  });

  it('시스템이 가져가 끝난 끌기(onEnd success=false) = 취소와 같이 — 저장 0 · 제자리', async () => {
    const t = render();
    await flush();
    layout(t);
    const setItem = AsyncStorage.setItem as jest.Mock;
    setItem.mockClear();
    const p = lastPan();
    act(() => p.handlers.onStart?.());
    act(() => p.handlers.onUpdate?.({ translationX: -250, translationY: 120 }));
    act(() => p.handlers.onEnd?.({}, false));
    act(() => p.handlers.onFinalize?.());
    expect(setItem).not.toHaveBeenCalled();
    expect(place(t)).toEqual(expect.objectContaining({ x: AREA.w - 20 - BADGE_W, y: MIN_TOP }));
  });
});

describe('#234 QA — 위 한계 = 홈 검색 줄 아래(그려지는 영역 기준)', () => {
  it('한계 자리에서 불꽃이 가장 커진 프레임·불티까지 검색 줄 아래 끝 + 4 밑에 그려진다 · 기본 자리도 그 한계', async () => {
    // 상자 top이 한계일 때 불꽃 캔버스 위쪽 그림의 화면 y — 바깥 불꽃 키프레임 전부 + 불티(flameDrawnTopUnit)
    const flameTopPx = MIN_TOP + (72 - 2 - (136 - FLAME_VIEWBOX.y) * FLAME_SCALE); // 캔버스 top(상자 기준 -30) 의 화면 y
    const drawnY = (unit: number) => flameTopPx + (unit - FLAME_VIEWBOX.y) * FLAME_SCALE;
    for (const f of OUTER_FRAMES) for (let k = 1; k < f.length; k += 2) expect(drawnY(f[k])).toBeGreaterThanOrEqual(ROW_BOTTOM + 4);
    expect(drawnY(flameDrawnTopUnit())).toBeGreaterThanOrEqual(ROW_BOTTOM + 4);
    expect(BADGE_DRAWN_ABOVE).toBeGreaterThan(0);
    const t = render();
    await flush();
    layout(t);
    expect(place(t).y).toBe(MIN_TOP); // 기본 자리 = 한계(옛 기본 자리 ANCHOR는 검색 줄과 겹쳤다)
    expect(place(t).y).toBeGreaterThan(ANCHOR);
  });

  it('한계보다 위에 저장된 값(옛 빌드에서 헤더 바로 아래로 끌어 둔 자리)은 복원 때 한계로 보정', async () => {
    await AsyncStorage.setItem(BADGE_POS_KEY, JSON.stringify({ side: 'right', top: HEADER + 4 }));
    const t = render();
    await flush();
    layout(t);
    expect(place(t)).toEqual(expect.objectContaining({ x: AREA.w - 20 - BADGE_W, y: MIN_TOP }));
  });

  it('검색 줄 측정 전(앵커 없음)엔 헤더 아래가 한계', () => {
    expect(require('../badgePosition').badgeMinTop(null, HEADER)).toBe(HEADER + 4);
    expect(require('../badgePosition').badgeMinTop(ROW_BOTTOM, HEADER)).toBe(MIN_TOP);
  });
});

describe('위치 계산(순수)', () => {
  it('저장값 파싱 — 형식이 어긋나면 기본 자리(null)', () => {
    expect(parseBadgePos('{"side":"left","top":200}')).toEqual({ side: 'left', top: 200 });
    for (const bad of [null, '', 'x', '{"side":"up","top":1}', '{"side":"left","top":"1"}', '{"side":"left"}']) expect(parseBadgePos(bad)).toBeNull();
  });
  it('범위·가장자리·가까운 쪽', () => {
    const b = badgeBounds(700, 104);
    expect(b).toEqual({ min: 104, max: 700 - BADGE_H - (FAB_OVERHANG + 8) });
    expect(clampTop(0, b)).toBe(104);
    expect(clampTop(9999, b)).toBe(b.max);
    expect(edgeX('left', 390)).toBe(20);
    expect(edgeX('right', 390)).toBe(390 - 20 - BADGE_W);
    expect(nearestSide(100, 390)).toBe('left');
    expect(nearestSide(200, 390)).toBe('right');
  });
});
