/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-680(P-432) — 홈 카운트다운 뱃지(불꽃 "무료 스캔 N회 남음") 프로토타입.
 * 스펙 = spec specs/001-personalized-menu-mvp/countdown-badge-2026-10-02.md.
 */
import * as React from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockTimingCbs: ((finished: boolean) => void)[] = [];
const mockSpring = jest.fn((v: unknown) => v);
let mockReduced = false;
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (f: () => unknown) => f(),
    useReducedMotion: () => mockReduced,
    withTiming: (v: unknown, _c?: unknown, cb?: (f: boolean) => void) => {
      if (cb) mockTimingCbs.push(cb);
      return v;
    },
    withSpring: (v: unknown) => mockSpring(v),
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
    runOnJS: (f: (...a: unknown[]) => unknown) => f,
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react') as typeof import('react');
    useEffect(cb, [cb]);
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
jest.mock('@/lib/data/useMe', () => ({ useMe: () => ({ data: { scanQuota: mockQuota } }) }));
let mockGuest = false;
jest.mock('@/lib/auth/useSession', () => ({ useIsGuest: () => mockGuest, useSession: () => null }));
const mockPicker = jest.fn((_p: { kind: string | null; onToggleFood: (f: { foodId: string }) => void }) => null);
jest.mock('@/app/community/compose', () => ({ TagPickerSheet: (p: { kind: string | null; onToggleFood: (f: { foodId: string }) => void }) => mockPicker(p) }));
const mockFlag = { on: true };
jest.mock('@/lib/flags', () => {
  const a = jest.requireActual('@/lib/flags') as { FLAGS: Record<string, unknown> };
  return { ...a, FLAGS: new Proxy(a.FLAGS, { get: (t, k) => (k === 'countdownBadge' ? mockFlag.on : t[k as string]) }) };
});

import { HomeQuotaBadge, quotaBadgeModel, BADGE_BOTTOM } from '../HomeQuotaBadge';
import { CountdownBadge, BADGE_H, BADGE_W } from '@/components/CountdownBadge';

const Q = (remaining: number | 'unlimited', unlocked = false) => ({ count: 0, limit: 3, unlocked, remaining });

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<HomeQuotaBadge />);
  });
  return tree;
}
const rerender = (t: ReactTestRenderer) => act(() => t.update(<HomeQuotaBadge />));
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props?.testID === id && typeof n.type !== 'string');
const shown = (t: ReactTestRenderer) => byId(t, 'home-quota-badge').length > 0;
const valueText = (t: ReactTestRenderer) => byId(t, 'countdown-badge-value')[0]?.props.children;

beforeEach(() => {
  mockQuota = null;
  mockGuest = false;
  mockReduced = false;
  mockFlag.on = true;
  mockTimingCbs.length = 0;
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
  it('3회 · 1회 = 켜진 불꽃 + 숫자 + 복수형 단위', () => {
    mockQuota = Q(3);
    const t = render();
    expect(valueText(t)).toBe(3);
    expect(JSON.stringify(t.toJSON())).toContain('"flame-active"');
    expect(JSON.stringify(t.toJSON())).toContain('scan.badgeUnit:3');
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

  it('0회 시트 제목 = 기존 소진 문구(scan.quotaTitle)', () => {
    mockQuota = Q(0);
    const t = render();
    act(() => byId(t, 'countdown-badge')[0].props.onPress());
    expect(t.root.findByProps({ testID: 'quota-sheet-title' }).props.children).toBe('scan.quotaTitle');
  });
});

describe('모션 트리거', () => {
  it('값 감소 = 숫자 팝 1회 · 증가·재렌더는 무반응', () => {
    mockQuota = Q(3);
    const t = render();
    rerender(t);
    expect(mockSpring).not.toHaveBeenCalled();
    mockQuota = Q(2);
    rerender(t);
    expect(mockSpring).toHaveBeenCalledTimes(1);
    mockQuota = Q(3);
    rerender(t);
    expect(mockSpring).toHaveBeenCalledTimes(1);
  });

  it('숫자 → 무제한(리뷰 작성 후) = 마지막 숫자로 폭죽 1회 → 끝나면 사라짐', () => {
    mockQuota = Q(1);
    const t = render();
    mockQuota = Q('unlimited', true);
    rerender(t);
    expect(shown(t)).toBe(true); // 축하 중
    expect(valueText(t)).toBe(1);
    expect(mockTimingCbs.length).toBe(1);
    act(() => mockTimingCbs[0](true));
    expect(shown(t)).toBe(false);
    rerender(t);
    expect(shown(t)).toBe(false); // 재트리거 0
  });

  it('숫자 → 게스트·null(판별 불가)은 축하가 아니다 — 바로 숨김', () => {
    mockQuota = Q(1);
    const t = render();
    mockQuota = null;
    rerender(t);
    expect(shown(t)).toBe(false);
    expect(mockTimingCbs.length).toBe(0);
  });

  it('동작 줄이기 = 폭죽 없이 즉시 종료 · 숫자 팝 없음', () => {
    mockReduced = true;
    mockQuota = Q(2);
    const t = render();
    mockQuota = Q(1);
    rerender(t);
    expect(mockSpring).not.toHaveBeenCalled();
    mockQuota = Q('unlimited', true);
    rerender(t);
    expect(shown(t)).toBe(false);
    expect(mockTimingCbs.length).toBe(0);
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

  it('뱃지 윗변(bottom+높이) ≤ 홈 리스트 하단 여백 — 마지막 콘텐츠(면책)를 스크롤로 꺼낼 수 있다', () => {
    const src = require('fs').readFileSync('src/app/(tabs)/index.tsx', 'utf8') as string;
    const pad = Number(/contentContainerStyle=\{\{ paddingTop: headerH, paddingBottom: (\d+) \}\}/.exec(src)![1]);
    expect(BADGE_BOTTOM + BADGE_H).toBeLessThanOrEqual(pad);
    expect(src).toContain('<HomeQuotaBadge />');
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
