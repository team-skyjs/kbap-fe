/* eslint-disable import/first, @typescript-eslint/no-require-imports --
   jest 구조상 불가피: 대상의 import는 jest.mock 선언 **뒤**여야 목이 걸린다(팩토리 호이스팅). 레포 관례 동일. */
/**
 * KB-699(P-440) — 리뷰로 무제한이 됐는데 홈 도착 시 폭죽 없이 뱃지가 사라짐(QA 실측). 두 순서를 수정 전 red로 고정.
 * (하네스 = homeQuotaBadge680 그대로 + me 빈 렌더 목)
 * KB-680(P-432) — 홈 카운트다운 뱃지(불꽃 "무료 스캔 N회 남음") 프로토타입.
 * 스펙 = spec specs/001-personalized-menu-mvp/countdown-badge-2026-10-02.md.
 */
import * as React from 'react';
import { AccessibilityInfo } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockSpring = jest.fn((v: unknown) => v);
let mockReduced = false; // 동작 줄이기 — 컴포넌트는 useMotionState(AccessibilityInfo) 한 벌로 판정
let mockFocused = true; // 홈 포커스 — useFocusEffect 목이 blur 시 cleanup을 돌린다
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (f: () => unknown) => f(),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => mockSpring(v),
    withRepeat: (v: unknown) => v,
    withSequence: (...vals: unknown[]) => vals[vals.length - 1],
    cancelAnimation: () => {},
  };
});
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
import { _resetMotionMemoryForTest } from '@/lib/useMotionPaused';
import { CELEBRATE_END_MS } from '@/components/CountdownBadge';

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
  _resetMotionMemoryForTest();
  mockMeEmpty = false;
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


afterEach(() => jest.useRealTimers());

it('순서 ①: 쿼터 0 → me 재조회 중 빈 값(data undefined) → 무제한 = 폭죽 1회 뒤 사라짐', async () => {
  jest.useFakeTimers();
  mockQuota = Q(0);
  const t = render();
  await flush();
  expect(shown(t)).toBe(true);
  mockMeEmpty = true; // 리뷰 등록 → me 무효화 → 재조회 중 빈 렌더
  rerender(t);
  mockMeEmpty = false;
  mockQuota = Q('unlimited', true);
  rerender(t);
  expect(shown(t)).toBe(true); // 축하 중(마지막 숫자 0)
  expect(valueText(t)).toBe(0);
  act(() => jest.advanceTimersByTime(CELEBRATE_END_MS));
  expect(shown(t)).toBe(false);
});

it('순서 ②: 홈이 가려진 채 무제한 → (홈 트리 재마운트 — 홈 재조회 에러 블록 등) → 홈 복귀 = 폭죽 1회 뒤 사라짐', async () => {
  jest.useFakeTimers();
  mockQuota = Q(0);
  const t = render();
  await flush();
  mockFocused = false; // 리뷰 작성 화면으로
  rerender(t);
  mockQuota = Q('unlimited', true); // 제출 → me 재조회
  rerender(t);
  act(() => t.unmount()); // 홈 트리가 바뀌어 뱃지가 내려감(홈 재조회 에러 블록 등)
  let t2!: ReactTestRenderer;
  act(() => {
    t2 = renderer.create(<HomeQuotaBadge top={100} />);
  });
  mountedTrees.push(t2);
  mockFocused = true; // 완료 → Done → 홈
  act(() => t2.update(<HomeQuotaBadge top={100} />));
  await flush();
  expect(shown(t2)).toBe(true); // 마지막 숫자를 든 채 폭죽
  act(() => jest.advanceTimersByTime(CELEBRATE_END_MS));
  expect(shown(t2)).toBe(false);
});

// ── #229 Codex P2 · 공부 지적 — 축하의 주인 회원(끝·취소 때 지울 기억은 "지금 me"가 아니라 축하 주인의 것)
it('③ 축하가 끝나는 순간 me가 비어 있어도 그 회원의 기억을 지운다 — me 복귀 시 폭죽 재생 0', async () => {
  jest.useFakeTimers();
  mockQuota = Q(2);
  const t = render();
  await flush();
  mockQuota = Q('unlimited', true);
  rerender(t);
  expect(shown(t)).toBe(true); // 축하 중
  mockMeEmpty = true; // 끝나기 직전 재조회 빈 렌더
  rerender(t);
  act(() => jest.advanceTimersByTime(CELEBRATE_END_MS));
  expect(shown(t)).toBe(false);
  mockMeEmpty = false; // 같은 회원 복귀(여전히 해금)
  rerender(t);
  expect(shown(t)).toBe(false);
});

it('④ 축하 보류 중 로그아웃(게스트) = 이전 회원의 뱃지·폭죽 0 · 같은 회원 재로그인(해금)에도 재축하 0', async () => {
  mockQuota = Q(2);
  const t = render();
  await flush();
  mockFocused = false; // 리뷰 작성 화면 — 홈 가려짐(축하 보류)
  rerender(t);
  mockQuota = Q('unlimited', true);
  rerender(t);
  expect(shown(t)).toBe(true); // 보류된 축하(마지막 숫자)
  mockGuest = true; // 홈을 보기 전에 로그아웃
  rerender(t);
  expect(shown(t)).toBe(false);
  mockFocused = true;
  rerender(t);
  expect(shown(t)).toBe(false); // 게스트 홈 — 폭죽 0
  mockGuest = false; // 같은 회원 재로그인(해금 상태)
  rerender(t);
  expect(shown(t)).toBe(false); // 기억이 지워져 재축하 0
});

it('⑤ 축하 보류 중 계정 전환(m1 → m2) = 취소 + m1 기억 삭제 — m1이 해금된 채 돌아와도 재축하 0', async () => {
  mockQuota = Q(2);
  const t = render();
  await flush();
  mockFocused = false;
  rerender(t);
  mockQuota = Q('unlimited', true);
  rerender(t);
  expect(shown(t)).toBe(true);
  mockMemberId = 'm2'; // 다른 회원(해금, 숫자 기억 없음)
  rerender(t);
  expect(shown(t)).toBe(false);
  mockMemberId = 'm1';
  mockFocused = true;
  rerender(t);
  expect(shown(t)).toBe(false);
});
