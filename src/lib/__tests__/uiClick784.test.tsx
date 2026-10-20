/* eslint-disable import/first -- jest.mock 선언 뒤에 대상 모듈을 import(레포 테스트 관례) */
/**
 * KB-784 — ui_click·screen_view 규칙: target 정규화(PII 토큰 → :v) · 라우트 → screen · Pressable/Txt 자동 계측 · screen_view 1회.
 */
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  EVENTS: { ui_click: 'ui_click', screen_view: 'screen_view' },
  track: (...a: unknown[]) => mockTrack(...a),
}));
let mockSegments: string[] = [];
jest.mock('expo-router', () => ({ useSegments: () => mockSegments }));
jest.mock('@/lib/i18n/LocaleProvider', () => ({ useLocale: () => ({ script: 'latin' }) }));

import * as React from 'react';
import * as fs from 'fs';
import renderer, { act } from 'react-test-renderer';
import { normalizeTarget, screenFromSegments, setCurrentScreen } from '../uiClick';
import { useScreenTracking } from '../useScreenTracking';
import { handleDeeplink, markEntryResolved, markEntryResolvedAfterLeavingTabs, setDeeplinkGate, setDeeplinkReady, __resetDeeplinkForTest } from '../deeplink';
import { Pressable } from '@/components/Pressable';
import { Txt } from '@/components/Txt';
import { INGREDIENTS } from '@/lib/mocks/ingredients';
import { COUNTRIES } from '@/lib/onboarding/countries';

/** 화면 조회 Probe는 진입·보류 스토어를 구독한다 — 테스트 사이에 남으면 다음 테스트의 알림에 반응해 기록이 섞인다 */
const mounted: renderer.ReactTestRenderer[] = [];
afterEach(() => {
  while (mounted.length) act(() => mounted.pop()!.unmount());
});
beforeEach(() => {
  mockTrack.mockReset();
  setCurrentScreen('root');
});
const mount = (el: React.ReactElement) => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(el); });
  return t;
};

describe('normalizeTarget — 소문자 영단어만 원문, 나머지 :v', () => {
  it.each([
    ['profile-menu-saved', 'profile-menu-saved'],
    ['home-food-123', 'home-food-:v'],
    ['avoid-EGG', 'avoid-:v'],
    ['nat-US', 'nat-:v'],
    ['feed-flag-19', 'feed-flag-:v'],
    ['feed-flag-r_19', 'feed-flag-r_:v'], // 구분자 안쪽 소문자 조각은 남는다(규칙 그대로 — id는 숫자)
    ['order-item-photo-3-12', 'order-item-photo-:v'],
    ['home-chip-safe', 'home-chip-safe'],
    ['tab-scan', 'tab-scan'],
    ['place-pick-서울역', 'place-pick-:v'],
    ['  ', ':v'],
  ])('%s → %s', (raw, out) => {
    expect(normalizeTarget(raw)).toBe(out);
  });

  it('PII 전수: 회피 재료 코드·국가 코드가 testID에 실려도 target에 남지 않는다', () => {
    const leaks: string[] = [];
    for (const i of INGREDIENTS) if (normalizeTarget(`avoid-${i.code}`).includes(i.code)) leaks.push(i.code);
    for (const c of COUNTRIES) if (normalizeTarget(`nat-${c.code}`).includes(c.code)) leaks.push(c.code);
    expect(INGREDIENTS.length).toBeGreaterThan(50);
    expect(COUNTRIES.length).toBeGreaterThan(100);
    expect(leaks).toEqual([]);
  });
});

it('screenFromSegments — 라우트 패턴(id 값 없음), (tabs) 루트 = 홈', () => {
  expect(screenFromSegments([])).toBe('root');
  expect(screenFromSegments(['(tabs)'])).toBe('(tabs)/index');
  expect(screenFromSegments(['(tabs)', 'profile'])).toBe('(tabs)/profile');
  expect(screenFromSegments(['food', '[id]'])).toBe('food/[id]');
  expect(screenFromSegments(['profile', 'order', '[id]'])).toBe('profile/order/[id]');
});

it('useScreenTracking — 패턴이 바뀔 때만 1회 · 같은 패턴 재렌더 0 · ui_click의 screen 갱신', () => {
  __resetDeeplinkForTest(true); // 진입 정착된 앱
  function Probe() {
    useScreenTracking();
    return null;
  }
  mockSegments = ['(tabs)'];
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Probe />); });
  mounted.push(tree);
  mockSegments = ['(tabs)']; // 같은 패턴(포그라운드 복귀·재렌더)
  act(() => tree.update(<Probe />));
  mockSegments = ['food', '[id]'];
  act(() => tree.update(<Probe />));
  expect(mockTrack.mock.calls).toEqual([
    ['screen_view', { screen: '(tabs)/index' }],
    ['screen_view', { screen: 'food/[id]' }],
  ]);
  // 이후 클릭은 현재 화면으로
  const press = mount(<Pressable testID="detail-ask-owner" onPress={() => {}} />);
  act(() => press.root.findAll((n) => n.props.testID === 'detail-ask-owner' && n.type !== Pressable)[0].props.onPress({}));
  expect(mockTrack).toHaveBeenLastCalledWith('ui_click', { screen: 'food/[id]', target: 'detail-ask-owner' });
});

it('#280 Codex P2: 신규 설치 — 진입 정착 전 부팅 (tabs)/index는 기록 0, 로그인으로 교체 뒤 정착 순간 현재 화면(login) 1회', () => {
  __resetDeeplinkForTest(false);
  function Probe() {
    useScreenTracking();
    return null;
  }
  mockSegments = ['(tabs)'];
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Probe />); });
  mounted.push(tree);
  act(() => setDeeplinkReady(true)); // 탭이 먼저 포커스
  act(() => markEntryResolvedAfterLeavingTabs()); // /login 교체 직후(아직 탭 focused)
  mockSegments = ['login'];
  act(() => tree.update(<Probe />));
  expect(mockTrack).not.toHaveBeenCalled(); // 정착 전 — (tabs)/index도 login도 아직
  act(() => setDeeplinkReady(false)); // 탭 blur → 정착
  expect(mockTrack.mock.calls).toEqual([['screen_view', { screen: 'login' }]]);
  mockSegments = ['onboarding'];
  act(() => tree.update(<Probe />));
  expect(mockTrack).toHaveBeenLastCalledWith('screen_view', { screen: 'onboarding' });
  expect(mockTrack).toHaveBeenCalledTimes(2);
});

it('일반 부팅 — 스택 렌더 전 정착 → 첫 화면 바로 기록', () => {
  __resetDeeplinkForTest(false);
  markEntryResolved();
  function Probe() {
    useScreenTracking();
    return null;
  }
  mockSegments = ['(tabs)'];
  act(() => { mounted.push(renderer.create(<Probe />)); });
  expect(mockTrack.mock.calls).toEqual([['screen_view', { screen: '(tabs)/index' }]]);
});

it('KB-786(#280 P2): 콜드 스타트 딥링크 — 기본 루트(홈)는 기록 0, 이동 뒤 목적지가 첫 screen_view', () => {
  __resetDeeplinkForTest(false);
  handleDeeplink('kbap://food/7', 1); // 실행 URL — 보류
  markEntryResolved(); // 일반 부팅: 스택 전 정착
  function Probe() {
    useScreenTracking();
    return null;
  }
  mockSegments = ['(tabs)']; // 기본 루트가 먼저 그려짐
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Probe />); });
  mounted.push(tree);
  expect(mockTrack).not.toHaveBeenCalled(); // 보류 중 — 허수 홈 0
  act(() => setDeeplinkReady(true)); // 탭 포커스 → 보류 flush(이동은 큐에만)
  act(() => tree.update(<Probe />)); // #283 P2: 세그먼트가 아직 옛 경로 — 기록 0
  expect(mockTrack).not.toHaveBeenCalled();
  mockSegments = ['food', '[id]']; // 내비게이션 커밋 → 세그먼트 = 목적지
  act(() => tree.update(<Probe />));
  expect(mockTrack.mock.calls).toEqual([['screen_view', { screen: 'food/[id]' }]]);
});

it('#283 2R P2: 신규 설치 콜드 딥링크 — 로그인→온보딩 이동은 도착이 아님, flush 뒤 목적지가 첫 screen_view', () => {
  __resetDeeplinkForTest(false);
  handleDeeplink('kbap://food/7', 1);
  markEntryResolved();
  setDeeplinkGate(true); // 로그인 게이트
  function Probe() {
    useScreenTracking();
    return null;
  }
  mockSegments = ['login'];
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Probe />); });
  mounted.push(tree);
  mockSegments = ['onboarding'];
  act(() => tree.update(<Probe />));
  expect(mockTrack).not.toHaveBeenCalled(); // 게이트 통과 중 화면 변화 = 도착 아님
  mockSegments = ['(tabs)'];
  act(() => tree.update(<Probe />));
  expect(mockTrack).not.toHaveBeenCalled();
  jest.useFakeTimers();
  try {
    act(() => setDeeplinkGate(false));
    act(() => setDeeplinkReady(true)); // 탭 포커스 → flush(큐만)
    act(() => tree.update(<Probe />));
    expect(mockTrack).not.toHaveBeenCalled();
    mockSegments = ['food', '[id]'];
    act(() => tree.update(<Probe />));
    expect(mockTrack.mock.calls).toEqual([['screen_view', { screen: 'food/[id]' }]]);
  } finally {
    jest.useRealTimers();
  }
});

it('#283 P2: 목적지가 지금 화면과 같으면(kbap://home on 홈) 세그먼트 변화가 없으니 상한(1.5s) 뒤 그 화면 1회', () => {
  jest.useFakeTimers();
  try {
    __resetDeeplinkForTest(false);
    handleDeeplink('kbap://home', 1);
    markEntryResolved();
    function Probe() {
      useScreenTracking();
      return null;
    }
    mockSegments = ['(tabs)'];
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<Probe />); });
    mounted.push(tree);
    act(() => setDeeplinkReady(true));
    act(() => tree.update(<Probe />));
    expect(mockTrack).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1500); });
    expect(mockTrack.mock.calls).toEqual([['screen_view', { screen: '(tabs)/index' }]]);
  } finally {
    jest.useRealTimers();
  }
});

it('KB-786: 보류 대기는 첫 기록만 — 이후 로그인 위 보류 중에도 화면 조회는 계속', () => {
  __resetDeeplinkForTest(true);
  function Probe() {
    useScreenTracking();
    return null;
  }
  mockSegments = ['(tabs)'];
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Probe />); });
  mounted.push(tree);
  act(() => setDeeplinkGate(true)); // 로그인
  act(() => { handleDeeplink('kbap://scan', 1); }); // 로그인 위에서 보류
  mockSegments = ['login'];
  act(() => tree.update(<Probe />));
  mockSegments = ['onboarding'];
  act(() => tree.update(<Probe />));
  expect(mockTrack.mock.calls.map((c) => (c[1] as { screen: string }).screen)).toEqual(['(tabs)/index', 'login', 'onboarding']);
  act(() => setDeeplinkGate(false));
});

it('KB-786: 내비게이터 마운트 전 빈 세그먼트(root)는 screen_view 0 — 첫 기록은 실제 화면', () => {
  __resetDeeplinkForTest(true);
  function Probe() {
    useScreenTracking();
    return null;
  }
  mockSegments = [];
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Probe />); });
  mounted.push(tree);
  expect(mockTrack).not.toHaveBeenCalled();
  mockSegments = ['(tabs)'];
  act(() => tree.update(<Probe />));
  expect(mockTrack.mock.calls).toEqual([['screen_view', { screen: '(tabs)/index' }]]);
});

it('포그라운드 복귀 재발화 없음 — 화면 조회 훅은 AppState를 구독하지 않는다(예진 10/14)', () => {
  expect(fs.readFileSync('src/lib/useScreenTracking.ts', 'utf8')).not.toMatch(/AppState/);
});

describe('components/Pressable — 자동 ui_click', () => {
  it('탭 = 핸들러보다 먼저 ui_click(현재 화면 + 정규화 target) 1건', () => {
    setCurrentScreen('(tabs)/profile');
    const order: string[] = [];
    mockTrack.mockImplementation(() => order.push('track'));
    const tree = mount(<Pressable testID="profile-menu-saved" onPress={() => order.push('handler')} />);
    act(() => tree.root.findAll((n) => typeof n.type === 'object' || typeof n.type === 'function').find((n) => typeof n.props.onPress === 'function' && n.props.testID === 'profile-menu-saved' && n.type !== Pressable)!.props.onPress({}));
    expect(order).toEqual(['track', 'handler']);
    expect(mockTrack).toHaveBeenCalledWith('ui_click', { screen: '(tabs)/profile', target: 'profile-menu-saved' });
  });
  it('uiTarget이 testID보다 우선(자유 텍스트 testID 보호) · 길게 누르기 = -long', () => {
    const tree = mount(<Pressable testID="place-pick-Myeongdong Kyoja" uiTarget="place-pick" onPress={() => {}} onLongPress={() => {}} />);
    const host = tree.root.findAll((n) => n.props.testID === 'place-pick-Myeongdong Kyoja' && n.type !== Pressable)[0];
    act(() => host.props.onPress({}));
    act(() => host.props.onLongPress({}));
    expect(mockTrack.mock.calls.map((c) => (c[1] as { target: string }).target)).toEqual(['place-pick', 'place-pick-long']);
  });
  it('onPress 없는 Pressable = 계측 0(핸들러 미부착 유지)', () => {
    const tree = mount(<Pressable testID="x" />);
    const host = tree.root.findAll((n) => n.props.testID === 'x' && n.type !== Pressable)[0];
    expect(host.props.onPress).toBeUndefined();
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

it('Txt onPress(링크 텍스트) = ui_click · onPress 없는 글자 = 무변', () => {
  setCurrentScreen('login');
  const tree = mount(<Txt testID="terms-tos" onPress={() => {}}>Terms</Txt>);
  act(() => tree.root.findAll((n) => n.props.testID === 'terms-tos' && n.type !== Txt)[0].props.onPress({}));
  expect(mockTrack).toHaveBeenCalledWith('ui_click', { screen: 'login', target: 'terms-tos' });
  const plain = mount(<Txt testID="plain">Hi</Txt>);
  expect(plain.root.findAll((n) => n.props.testID === 'plain' && n.type !== Txt)[0].props.onPress).toBeUndefined();
});
