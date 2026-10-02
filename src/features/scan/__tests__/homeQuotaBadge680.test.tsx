/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-680(P-432) — 홈 카운트다운 뱃지(불꽃 "무료 스캔 N회 남음") 프로토타입.
 * 스펙 = spec specs/001-personalized-menu-mvp/countdown-badge-2026-10-02.md.
 */
import * as React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockSpring = jest.fn((v: unknown) => v);
let mockReduced = false; // 동작 줄이기 — 컴포넌트는 useMotionState(AccessibilityInfo) 한 벌로 판정
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

import { HomeQuotaBadge, quotaBadgeModel, BADGE_RIGHT, _resetQuotaCelebrationMemoryForTest } from '../HomeQuotaBadge';
import { CountdownBadge, BADGE_H, BADGE_W, CELEBRATE_END_MS } from '@/components/CountdownBadge';

const Q = (remaining: number | 'unlimited', unlocked = false) => ({ count: 0, limit: 3, unlocked, remaining });

// KB-699: 뱃지는 세션 저장소를 구독한다 — 앞 테스트의 트리가 남아 있으면 저장소 통지에 재렌더돼 목 카운트가 섞인다 → 매 테스트 뒤 언마운트
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
function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<HomeQuotaBadge top={100} />);
  });
  mountedTrees.push(tree);
  return tree;
}
const rerender = (t: ReactTestRenderer) => act(() => t.update(<HomeQuotaBadge top={100} />));
/** 동작 줄이기 조회(Promise) 반영 — 확정 전엔 paused(보수) */
const flush = () => act(async () => {});
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type !== 'string');
const shown = (t: ReactTestRenderer) => byId(t, 'home-quota-badge').length > 0;
const valueText = (t: ReactTestRenderer) => byId(t, 'countdown-badge-value')[0]?.props.children;

beforeEach(() => {
  _resetQuotaCelebrationMemoryForTest(); // KB-699: 세션 메모리는 테스트 간에 비운다
  mockQuota = null;
  mockMemberId = 'm1';
  mockGuest = false;
  mockReduced = false;
  mockFocused = true;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(mockReduced));
  mockFlag.on = true;
  mockSpring.mockClear();
  mockPicker.mockClear();
  mockPush.mockClear();
});

describe('quotaBadgeModel — 쿼터(서버 정본) → 뱃지 값', () => {
  it.each([
    [Q(3), false, { value: 3, state: 'active' }],
    [Q(1), false, { value: 1, state: 'active' }],
    [Q(0), false, { value: 0, state: 'empty' }],
    [Q('unlimited', true), false, null],
    [Q('unlimited'), false, null],
    [Q(2, true), false, null], // 해금이면 숫자가 남아 있어도 무제한
    [null, false, null], // 구서버 — 판별 불가
    [undefined, false, null],
    [Q(3), true, null], // 게스트
  ])('%j guest=%s → %j', (q, guest, want) => {
    expect(quotaBadgeModel(q as never, guest)).toEqual(want);
  });
});

describe('홈 뱃지 렌더', () => {
  it('3회 · 1회 = 켜진 불꽃 + **숫자만**(KB-706 — 단위 글자 없음, 접근성 문구는 그대로)', () => {
    mockQuota = Q(3);
    const t = render();
    expect(valueText(t)).toBe(3);
    const json = JSON.stringify(t.toJSON());
    expect(json).toContain('"flame-active"');
    expect(json).not.toContain('scan.badgeUnit');
    const badge = t.root.findAll((n) => n.props?.testID === 'countdown-badge' && n.props?.accessibilityLabel != null)[0];
    expect(badge.props.accessibilityLabel).toBe('scan.freeLeft:3');
    expect(badge.findAll((n) => typeof n.props?.children === 'number' || typeof n.props?.children === 'string').filter((n) => typeof n.type === 'string').length).toBe(1); // 글자 = 숫자 하나
    mockQuota = Q(1);
    rerender(t);
    expect(valueText(t)).toBe(1);
  });

  it('0회 = 꺼진 불꽃 + 0으로 남는다(숨김 아님)', () => {
    mockQuota = Q(0);
    const t = render();
    expect(shown(t)).toBe(true);
    expect(valueText(t)).toBe(0);
    expect(JSON.stringify(t.toJSON())).toContain('"flame-empty"');
  });

  it.each([
    ['무제한', () => (mockQuota = Q('unlimited', true))],
    ['구서버(scanQuota null)', () => (mockQuota = null)],
    ['게스트', () => ((mockQuota = Q(3)), (mockGuest = true))],
    ['플래그 off(prod)', () => ((mockQuota = Q(3)), (mockFlag.on = false))],
  ])('%s = 숨김', (_n, setup) => {
    setup();
    expect(shown(render())).toBe(false);
  });
});

describe('탭 → 안내 시트 → 리뷰 쓰기(스캔 잠금과 같은 픽커 흐름)', () => {
  it('남은 횟수 문구 · 리뷰 쓰기 = 시트 dismiss 뒤 픽커(iOS 연쇄 race 방지) · 음식 선택 → 리뷰 작성 화면', () => {
    mockQuota = Q(2);
    const t = render();
    act(() => byId(t, 'countdown-badge')[0].props.onPress());
    expect(t.root.findByProps({ testID: 'quota-sheet-title' }).props.children).toBe('scan.freeLeft:2');
    act(() => t.root.findByProps({ testID: 'quota-sheet-review' }).props.onPress());
    expect(mockPicker).not.toHaveBeenCalled(); // 아직 — 시트가 내려가는 중(같은 커밋 연쇄 금지)
    const modal = t.root.findAll((n) => typeof n.props?.onDismiss === 'function')[0];
    act(() => modal.props.onDismiss());
    const last = mockPicker.mock.calls.at(-1)![0];
    expect(last.kind).toBe('food');
    act(() => last.onToggleFood({ foodId: '7' }));
    expect(mockPush).toHaveBeenCalledWith('/food/7/review');
  });

  it.each([
    ['세션 만료(게스트)', () => (mockGuest = true)],
    ['해금(무제한)', () => (mockQuota = Q('unlimited', true))],
    ['판별 불가(null)', () => (mockQuota = null)],
  ])('Codex #221 P2: 시트가 열린 채 자격 소멸(%s) → 시트 닫힘', (_n, lose) => {
    mockQuota = Q(2);
    const t = render();
    act(() => byId(t, 'countdown-badge')[0].props.onPress());
    const modalVisible = () => t.root.findAll((n) => typeof n.props?.onDismiss === 'function' && 'visible' in n.props)[0].props.visible;
    expect(modalVisible()).toBe(true);
    lose();
    rerender(t);
    expect(modalVisible()).toBe(false);
    expect(mockPicker).not.toHaveBeenCalled(); // 닫힘이 픽커를 열지 않는다(리뷰 쓰기를 안 눌렀으면)
  });

  it('0회 시트 제목 = 기존 소진 문구(scan.quotaTitle)', () => {
    mockQuota = Q(0);
    const t = render();
    act(() => byId(t, 'countdown-badge')[0].props.onPress());
    expect(t.root.findByProps({ testID: 'quota-sheet-title' }).props.children).toBe('scan.quotaTitle');
  });
});

describe('모션 트리거', () => {
  afterEach(() => jest.useRealTimers());

  it('값 감소 = 숫자 팝 1회 · 증가·재렌더는 무반응', async () => {
    mockQuota = Q(3);
    const t = render();
    await flush();
    rerender(t);
    expect(mockSpring).not.toHaveBeenCalled();
    mockQuota = Q(2);
    rerender(t);
    expect(mockSpring).toHaveBeenCalledTimes(1);
    mockQuota = Q(3);
    rerender(t);
    expect(mockSpring).toHaveBeenCalledTimes(1);
  });

  it('홈이 가려진 동안(스캔 화면) 줄면 팝 보류 → 보일 때 1회', async () => {
    mockQuota = Q(3);
    const t = render();
    await flush();
    mockFocused = false;
    rerender(t);
    mockQuota = Q(2);
    rerender(t);
    expect(mockSpring).not.toHaveBeenCalled();
    mockFocused = true;
    rerender(t);
    expect(mockSpring).toHaveBeenCalledTimes(1);
    rerender(t);
    expect(mockSpring).toHaveBeenCalledTimes(1);
  });

  it('숫자 → 해금(리뷰 작성 후) = 마지막 숫자로 폭죽 1회 → JS 타이머 뒤 사라짐', async () => {
    jest.useFakeTimers();
    mockQuota = Q(1);
    const t = render();
    await flush();
    mockQuota = Q('unlimited', true);
    rerender(t);
    expect(shown(t)).toBe(true); // 축하 중
    expect(valueText(t)).toBe(1);
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS - 1));
    expect(shown(t)).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(shown(t)).toBe(false);
    rerender(t);
    expect(shown(t)).toBe(false); // 재트리거 0
  });

  it('공부 #221 지적 1: 홈이 가려진 채 해금 → 폭죽 시작 안 함(숫자 든 채 대기) → 홈이 보이면 1회', async () => {
    jest.useFakeTimers();
    mockQuota = Q(1);
    const t = render();
    await flush();
    mockFocused = false; // 리뷰 작성 화면으로
    rerender(t);
    mockQuota = Q('unlimited', true); // 제출 성공 → me 재조회(홈은 뒤에서)
    rerender(t);
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS * 3));
    expect(shown(t)).toBe(true);
    expect(valueText(t)).toBe(1);
    expect(byId(t, 'countdown-badge')[0].findAll((n) => n.props?.style && JSON.stringify(n.props.style).includes('"borderRadius":3')).length).toBe(0); // 파티클 미렌더
    mockFocused = true; // 홈 복귀
    rerender(t);
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS - 1));
    expect(shown(t)).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(shown(t)).toBe(false);
  });

  it('공부 재확인 ①: 가려진 채 해금 대기 중 다시 숫자로 돌아오면 → 축하 취소, 복귀 시 폭죽 없이 숫자 뱃지(눌림 가능)', async () => {
    jest.useFakeTimers();
    mockQuota = Q(1);
    const t = render();
    await flush();
    mockFocused = false;
    rerender(t);
    mockQuota = Q('unlimited', true); // 해금 → 대기
    rerender(t);
    mockQuota = Q(1); // 되돌려진 해금(재조회 정정)
    rerender(t);
    mockFocused = true;
    rerender(t);
    // 복귀 직후(폭죽이 났다면 재생 중일 시점) — 축하 아님: 파티클 0 · 눌림 가능
    const btnEl = byId(t, 'countdown-badge')[0];
    expect(btnEl.props.disabled).toBe(false);
    expect(btnEl.findAll((n) => n.props?.style && JSON.stringify(n.props.style).includes('"borderRadius":3')).length).toBe(0);
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS * 2));
    expect(shown(t)).toBe(true);
    expect(valueText(t)).toBe(1);
  });

  it('공부 재확인 ②: 동작 줄이기 조회 실패(미확인 고착) + 화면 보임 → 해금 시 폭죽 없이 즉시 종료(대기 고착 0)', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockImplementation(() => Promise.reject(new Error('unavailable')));
    mockQuota = Q(1);
    const t = render();
    await flush();
    mockQuota = Q('unlimited', true);
    rerender(t);
    expect(shown(t)).toBe(false);
  });

  it('공부 메모 ②: remaining만 unlimited(누락·음수 → 판별 불가)이고 unlocked 아님 = 축하 아님, 바로 숨김', async () => {
    mockQuota = Q(1);
    const t = render();
    await flush();
    mockQuota = Q('unlimited', false);
    rerender(t);
    expect(shown(t)).toBe(false);
  });

  it('계정 전환(A 숫자 → B 해금, 게스트 렌더 없이) = 축하 아님', async () => {
    mockQuota = Q(1);
    const t = render();
    await flush();
    mockMemberId = 'm2';
    mockQuota = Q('unlimited', true);
    rerender(t);
    expect(shown(t)).toBe(false);
  });

  it('숫자 → 게스트·null(판별 불가)은 축하가 아니다 — 바로 숨김', async () => {
    mockQuota = Q(1);
    const t = render();
    await flush();
    mockQuota = null;
    rerender(t);
    expect(shown(t)).toBe(false);
  });

  it('동작 줄이기 = 폭죽 없이 즉시 종료 · 숫자 팝 없음', async () => {
    mockReduced = true;
    mockQuota = Q(2);
    const t = render();
    await flush();
    mockQuota = Q(1);
    rerender(t);
    expect(mockSpring).not.toHaveBeenCalled();
    mockQuota = Q('unlimited', true);
    rerender(t);
    expect(shown(t)).toBe(false); // 타이머 없이 즉시
  });
});

describe('축하 종료 타이머 정리(언마운트·재트리거·동작 줄이기)', () => {
  const badge = (celebrate: boolean, end: () => void) => <CountdownBadge value={1} unitLabel="회" state="active" onPress={() => {}} celebrate={celebrate} onCelebrateEnd={end} />;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('언마운트 = 타이머 해제(종료 콜백 0)', async () => {
    const end = jest.fn();
    let t!: ReactTestRenderer;
    act(() => {
      t = renderer.create(badge(false, end));
    });
    await flush(); // 동작 줄이기 확정(false) 뒤에 축하 — 실제 흐름도 전이는 마운트 후
    act(() => t.update(badge(true, end)));
    act(() => t.unmount());
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS * 2));
    expect(end).not.toHaveBeenCalled();
  });

  it('재트리거(꺼졌다 다시 켜짐) = 새 타이머 1개 — 옛 타이머는 발화 안 함', async () => {
    const end = jest.fn();
    let t!: ReactTestRenderer;
    act(() => {
      t = renderer.create(badge(false, end));
    });
    await flush(); // 동작 줄이기 확정(false) 뒤에 축하 — 실제 흐름도 전이는 마운트 후
    act(() => t.update(badge(true, end)));
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS - 100));
    act(() => t.update(badge(false, end)));
    act(() => t.update(badge(true, end)));
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS - 1));
    expect(end).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('동작 줄이기 = 즉시 1회 · 종료 타이머 없음', async () => {
    mockReduced = true;
    const end = jest.fn();
    let t!: ReactTestRenderer;
    act(() => {
      t = renderer.create(badge(false, end));
    });
    await flush();
    act(() => t.update(badge(true, end)));
    expect(end).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS * 2));
    expect(end).toHaveBeenCalledTimes(1); // 종료 타이머 없음(두 번째 호출 0)
  });

  it('blur·background 중엔 종료 타이머 해제 → 다시 보이면 처음부터', async () => {
    const end = jest.fn();
    let t!: ReactTestRenderer;
    act(() => {
      t = renderer.create(badge(false, end));
    });
    await flush(); // 동작 줄이기 확정(false) 뒤에 축하 — 실제 흐름도 전이는 마운트 후
    act(() => t.update(badge(true, end)));
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS - 100));
    mockFocused = false;
    act(() => t.update(badge(true, end)));
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS * 2));
    expect(end).not.toHaveBeenCalled();
    mockFocused = true;
    act(() => t.update(badge(true, end)));
    act(() => jest.advanceTimersByTime(CELEBRATE_END_MS));
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('소스 잠금 — 워클릿→JS 경계 0: UI 스레드 코드(불꽃 일렁임)는 flameGeometry의 \'worklet\' 함수만 · 끌기 콜백은 JS 스레드(.runOnJS(true)) · 애니메이션 완료 콜백 없음', () => {
    const fs = require('fs') as typeof import('fs');
    const strip = (f: string) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const f of ['src/components/CountdownBadge.tsx', 'src/components/FlameShape.tsx', 'src/features/scan/HomeQuotaBadge.tsx', 'src/components/flameGeometry.ts']) {
      const code = strip(f);
      expect(code).not.toMatch(/(?<!\.)runOnJS\(|runOnUI|scheduleOnRN/); // 워클릿 → JS 호출 0(`.runOnJS(true)` = RNGH 콜백 JS 스레드 설정은 허용)
      expect(code).not.toMatch(/with(Timing|Spring)\([^()]*(\([^()]*\)[^()]*)*,[^()]*(\{[^{}]*\})[^()]*,/); // 3번째 인자(콜백) 없음
    }
    // 끌기 = RNGH 콜백을 JS 스레드로(레포 제스처 관례 P-131 — 워클릿 경계 없음)
    expect(strip('src/features/scan/HomeQuotaBadge.tsx')).toMatch(/Gesture\.Pan\(\)\s*\.runOnJS\(true\)/);
    // useAnimatedProps 안에서 부르는 함수는 전부 'worklet'(P-065 — jest는 워클릿 경계를 못 잡는다)
    const geo = fs.readFileSync('src/components/flameGeometry.ts', 'utf8');
    for (const fn of ['lerpFrames', 'toPathD', 'sparkD', 'sparkFrame']) {
      expect(geo).toMatch(new RegExp(`function ${fn}\\([^)]*\\)[^\\n]*\\{\\n\\s*'worklet';`)); // 본문 첫 줄
    }
    expect(strip('src/components/CountdownBadge.tsx')).not.toMatch(/'worklet'/);
    expect(strip('src/features/scan/HomeQuotaBadge.tsx')).not.toMatch(/'worklet'/);
  });
});

describe('프레임 불변 · 홈 하단 미겹침', () => {
  const frame = (el: React.ReactElement) => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(el);
    });
    const s = StyleSheet.flatten(tree.root.findAll((n) => n.props?.testID === 'countdown-badge' && n.props.style)[0].props.style);
    return { w: s.width, h: s.height };
  };
  it('active/empty · 짧은/긴 단위 · 두 자리 숫자 = 같은 크기(BADGE_W×BADGE_H)', () => {
    const base = frame(<CountdownBadge value={3} unitLabel="회" state="active" onPress={() => {}} />);
    expect(base).toEqual({ w: BADGE_W, h: BADGE_H });
    expect(frame(<CountdownBadge value={0} unitLabel="бесплатных сканирований" state="empty" onPress={() => {}} />)).toEqual(base);
    expect(frame(<CountdownBadge value={10} unitLabel="escaneos" state="active" onPress={() => {}} />)).toEqual(base);
  });

  it('공부 #221 지적 2: 세 자리 값 = 한 줄 + 축소 맞춤(잘림 대신 축소) · 프레임 동일', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(<CountdownBadge value={999} unitLabel="scans" state="active" onPress={() => {}} />);
    });
    const num = tree.root.findAll((n) => n.props?.testID === 'countdown-badge-value' && typeof n.type !== 'string')[0];
    expect(num.props.children).toBe(999);
    expect(num.props.numberOfLines).toBe(1);
    expect(num.props.adjustsFontSizeToFit).toBe(true);
    expect(frame(<CountdownBadge value={999} unitLabel="scans" state="active" onPress={() => {}} />)).toEqual({ w: BADGE_W, h: BADGE_H });
  });

  it('KB-701 위치 — top = 홈이 측정해 내려 준 값 그대로 · right 20(스캔 버튼 오른쪽 끝) · top null(측정 전) = 그리지 않음', () => {
    mockQuota = Q(2);
    const t = render();
    const float = () => t.root.findAll((n) => n.props?.testID === 'home-quota-badge' && typeof n.type === 'string');
    expect(StyleSheet.flatten(float()[0].props.style)).toEqual(expect.objectContaining({ position: 'absolute', top: 100, right: 20 }));
    expect(BADGE_RIGHT).toBe(20);
    act(() => t.update(<HomeQuotaBadge top={null} />));
    expect(float()).toHaveLength(0);
    act(() => t.update(<HomeQuotaBadge top={140} />));
    expect(StyleSheet.flatten(float()[0].props.style)).toEqual(expect.objectContaining({ top: 140 }));
  });

  it('KB-706 색·구성 — 스펙 실측값 그대로(뱃지 전용 상수 한 곳) · 흰 테두리 없음 · 바깥/안쪽 = 봉우리 둘(M + C×6) · 꺼진 불꽃 = 기존 회색 토큰', () => {
    const geo = require('@/components/flameGeometry') as typeof import('@/components/flameGeometry');
    expect(geo.FLAME_COLORS.outer).toEqual(['#FEDC33', '#FBAF27', '#F57F18', '#F57C0E']);
    expect(geo.FLAME_COLORS.innerPeak).toEqual(['#F47233', '#F57638']);
    expect(geo.FLAME_COLORS.innerMid).toBe('#F68A30');
    expect(geo.FLAME_COLORS.innerBottom).toBe('#F7AC20');
    expect(geo.FLAME_COLORS.glow).toEqual(['#FDDC13', '#FAD014']);
    const shape = require('fs').readFileSync('src/components/FlameShape.tsx', 'utf8') as string;
    expect(shape).not.toMatch(/stroke=/); // 흰 테두리 제거(레퍼런스에 없음)
    expect(shape).toContain('C.ink3'); // 꺼진 불꽃 바깥
    expect(shape).toContain('C.ink2'); // 꺼진 불꽃 안쪽(한 단계 다른 회색)
    for (const d of [geo.OUTER_REST_D, geo.INNER_REST_D]) {
      expect(d.startsWith('M')).toBe(true);
      expect((d.match(/C/g) ?? []).length).toBe(6);
    }
    // 키프레임 = 같은 명령 구조(보간 가능) · 첫/끝 = rest(끊김 없는 반복)
    for (const frames of [geo.OUTER_FRAMES, geo.INNER_FRAMES]) {
      expect(new Set(frames.map((f) => f.length)).size).toBe(1);
      expect(frames[frames.length - 1]).toEqual(frames[0]);
    }
    expect(geo.FLAME_TIMES[0]).toBe(0);
    expect(geo.FLAME_TIMES[geo.FLAME_TIMES.length - 1]).toBe(1);
  });
});

describe('플래그 countdownBadge = 진단 채널만(teamtest on / production·preview off)', () => {
  const flagOn = (channel: string | null) => {
    let v: unknown;
    jest.isolateModules(() => {
      jest.doMock('expo-updates', () => ({ channel }));
      v = (jest.requireActual('@/lib/flags') as { FLAGS: { countdownBadge: boolean } }).FLAGS.countdownBadge;
    });
    return v;
  };
  it.each([
    ['production', false],
    ['preview', false],
    ['teamtest', true],
    ['teamtest-prod', true],
    [null, true], // 로컬·jest
  ])('%s → %s', (ch, want) => {
    expect(flagOn(ch)).toBe(want);
  });
});

describe('i18n — freeLeft·badgeUnit 10로케일', () => {
  const fs = require('fs') as typeof import('fs');
  const LOCALES = ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'vi', 'id', 'th', 'ru', 'es'];
  it.each(LOCALES)('%s — other 형 존재 · {{count}} 포함 · 이모지 0', (l) => {
    const scan = JSON.parse(fs.readFileSync(`src/lib/i18n/${l}.json`, 'utf8')).scan as Record<string, string>;
    expect(scan.freeLeft_other).toContain('{{count}}');
    expect(scan.badgeUnit_other?.trim()).toBeTruthy();
    for (const [k, v] of Object.entries(scan)) if (/^(freeLeft|badgeUnit)_/.test(k)) expect(/\p{Extended_Pictographic}/u.test(v)).toBe(false);
    if (['en', 'es', 'ru'].includes(l)) expect(scan.freeLeft_one).toBeTruthy();
    if (l === 'ru') expect([scan.freeLeft_few, scan.freeLeft_many, scan.badgeUnit_few, scan.badgeUnit_many].every(Boolean)).toBe(true);
  });
});
